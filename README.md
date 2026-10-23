# Skill Trail

Your AI/ML + Software Engineering tracker workbook as a website, with email and Google login. Each person's progress is saved to their own account.

```
skill-trail/
├── Backend/    Node + Express API, SQLite database, login (email + Google)
│   ├── src/               server code
│   ├── data/catalog.json  the workbook's content, generated from the .xlsx
│   ├── data/source/       the original Excel file
│   └── scripts/xlsx_to_json.py
└── Frontend/   React + Vite app (login page, dashboard, one page per sheet)
```

## What the site has

| Page | From the workbook sheet |
| --- | --- |
| Dashboard | Progress Dashboard + Start Here |
| SWE Roadmap, AI/ML Roadmap, AI + SWE Integration | the three roadmaps (status, confidence, notes) |
| Company roles, Apply links | Company Role Tracker, Live & Direct Apply Links (application status, applied date, next action) |
| Interview rounds | Interview Round Guide |
| Skills reference, Learning resources, Project ideas | All Skills Reference, All Learning Resources, All Project Ideas |
| Sources & notes | Sources & Notes |

The dashboard counts Done / Pending / Revision / Not Started the same way the workbook does (Done ÷ total), and the sidebar shows done/total beside each checklist.

## Run it on your computer

You need **Node.js 22 or newer** (the database library requires it).

**1. Backend** (terminal 1)

```bash
cd Backend
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```

Open `Backend/.env` and set `JWT_SECRET` to a long random string. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then start it:

```bash
npm run dev                 # API on http://localhost:4000
```

**2. Frontend** (terminal 2)

```bash
cd Frontend
npm install
npm run dev                 # site on http://localhost:5173
```

Open http://localhost:5173, create an account and you're in. Email and password login works straight away. Google login needs the next step.

## Set up Google login

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create or pick a project.
2. **APIs & Services → OAuth consent screen**: set the app name and your email. While the app is in "Testing", add your own Google address under **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
4. Under **Authorized JavaScript origins** add `http://localhost:5173` **and** `http://localhost` (Google asks for both when testing locally). Add your real site URL here too once you deploy. You don't need a redirect URI or the client secret.
5. Copy the **Client ID** into `Backend/.env`:
   ```
   GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```
6. Restart the backend. The "Continue with Google" button appears on the login page.

The browser gets a signed ID token from Google; the backend verifies it (signature, expiry and that it was issued for your client ID) and then starts its own session. The Client ID only lives in the backend's `.env`; the frontend asks the API for it.

## Deploy as one service

The backend serves the built frontend, so one process runs everything.

```bash
cd Frontend && npm install && npm run build      # creates Frontend/dist
cd ../Backend && npm install
NODE_ENV=production JWT_SECRET=... GOOGLE_CLIENT_ID=... TRUST_PROXY=1 npm start
```

- Put your site's URL in Google's **Authorized JavaScript origins**.
- `TRUST_PROXY=1` is for hosts that sit behind a proxy (Render, Railway, Fly, Heroku). It makes login rate limiting see real visitor IPs.
- The database is a single file (`Backend/data/tracker.db`, or `DATABASE_PATH`). Host it on storage that persists between deploys, and back it up.
- Serve it over HTTPS. In production the session cookie is marked `Secure`.

## Settings (`Backend/.env`)

| Variable | What it does |
| --- | --- |
| `JWT_SECRET` | Signs login sessions. Required in production. |
| `GOOGLE_CLIENT_ID` | Turns on Google login. |
| `PORT` | API port (default 4000). |
| `USE_WORKBOOK_PROGRESS` | `true` (default): new accounts start with the statuses saved in your Excel file. `false`: everything starts as "Not started". |
| `CLIENT_URL` | Only for CORS if the frontend is hosted on a different origin. |
| `DATABASE_PATH`, `TRUST_PROXY`, `COOKIE_SECURE` | Deployment options. |

## How progress is stored

`catalog.json` holds what is the same for everyone (tasks, companies, links) plus the default status and confidence from your workbook. When someone changes a status, note, date and so on, only that change is saved to the `user_progress` table for their account; everything else falls back to the default. Accounts never see each other's changes.

## Updating the content from Excel

Edit `Backend/data/source/AI_ML_SWE_Integrated_Development_Tracker_Automated_Progress.xlsx` (or point the script at another file), then:

```bash
pip install openpyxl
cd Backend && npm run convert
```

Restart the backend. Rows are matched by their text (for example `swe:dsa-big-o`), not their position, so people's saved progress stays attached when you add or reorder rows. If you rename a row's title, it counts as a new row.

Some workbook columns have no header (`Column1`, `Column2`...). They are mapped by their dropdowns and contents, as documented at the top of `scripts/xlsx_to_json.py`. Check that mapping if you restructure those sheets.

## API

All routes are under `/api`. Everything except login, register, config and health needs a session cookie.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/auth/config` | Public settings (the Google Client ID) |
| `POST` | `/auth/register` | `{ name, email, password }` |
| `POST` | `/auth/login` | `{ email, password }` |
| `POST` | `/auth/google` | `{ credential }`, the ID token from Google |
| `POST` | `/auth/logout` | Ends the session |
| `GET` | `/auth/me` | The signed-in user, or `{ "user": null }` |
| `GET` | `/tracker` | Every sheet with your progress merged in |
| `GET` | `/dashboard` | Totals, per-phase progress, "continue with" list |
| `PATCH` | `/items/:id` | Save changes, e.g. `{ "status": "Done", "confidence": 4 }` |

## Security notes

- Passwords are hashed with bcrypt. Sessions are a signed token in an `HttpOnly`, `SameSite=Lax` cookie, so page scripts can't read it.
- Login, register and Google endpoints are rate limited.
- If someone signs in with Google using an email that already has a password account, the password is removed and the account becomes Google-only. Password sign-ups aren't email-verified, so this stops anyone from pre-registering another person's email and keeping access.
- The security headers allow Google's sign-in script and popup; `Cross-Origin-Opener-Policy` is set to `same-origin-allow-popups` for that reason.
