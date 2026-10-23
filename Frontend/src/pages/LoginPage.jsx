import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Logo, Notice } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Decorative preview of the three learning routes shown on the brand panel.
const PREVIEW = [
  { name: 'SWE Roadmap', phases: [6, 7, 4], filled: [1, 0.5, 0] },
  { name: 'AI/ML Roadmap', phases: [5, 5, 8, 3], filled: [1, 0.6, 0, 0] },
  { name: 'AI + SWE Integration', phases: [1, 3, 3, 3, 2, 2, 3], filled: [1, 0.4, 0, 0, 0, 0, 0] },
];

function GoogleButton({ clientId, onCredential, onFailure }) {
  const box = useRef(null);
  const [width, setWidth] = useState(340);

  useEffect(() => {
    if (box.current) setWidth(Math.max(200, Math.min(400, Math.floor(box.current.clientWidth))));
  }, []);

  if (!clientId) {
    return (
      <Notice>
        Google sign-in isn't available right now.
        {import.meta.env.DEV && ' Add GOOGLE_CLIENT_ID to Backend/.env to turn it on.'}
      </Notice>
    );
  }
  return (
    <div className="google-slot" ref={box}>
      <GoogleOAuthProvider clientId={clientId}>
        <GoogleLogin
          width={String(width)}
          text="continue_with"
          shape="rectangular"
          size="large"
          onSuccess={(res) => res.credential && onCredential(res.credential)}
          onError={onFailure}
        />
      </GoogleOAuthProvider>
    </div>
  );
}

export default function LoginPage() {
  const { user, googleClientId, login, register, loginWithGoogle } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;

  const isRegister = mode === 'register';
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const run = async (action) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    run(() => (isRegister ? register(form.name, form.email, form.password) : login(form.email, form.password)));
  };

  return (
    <div className="login">
      <section className="login-brand">
        <div className="brand brand-light"><Logo /> Skill Trail</div>
        <div className="login-pitch">
          <h1>Learn the skills. Track the applications. See what's next.</h1>
          <p>Your SWE and AI/ML roadmaps, company roles and project milestones in one place, saved to your account.</p>
        </div>
        <div className="login-routes" aria-hidden="true">
          {PREVIEW.map((route) => (
            <div key={route.name} className="login-route">
              <span>{route.name}</span>
              <div className="rail">
                {route.phases.map((n, i) => (
                  <div key={i} className="rail-seg" style={{ flex: n }}>
                    <div className="bar bar-tall bar-ghost">
                      <span style={{ width: `${route.filled[i] * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="brand brand-mobile"><Logo size={26} /> Skill Trail</div>
          <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>

          <div className="segmented" role="group" aria-label="Sign in or create an account">
            <button type="button" aria-pressed={!isRegister} onClick={() => { setMode('signin'); setError(''); }}>Sign in</button>
            <button type="button" aria-pressed={isRegister} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
          </div>

          <GoogleButton
            clientId={googleClientId}
            onCredential={(credential) => run(() => loginWithGoogle(credential))}
            onFailure={() => setError('Google sign-in was cancelled or could not start. Try again.')}
          />

          <p className="divider"><span>or use your email</span></p>

          <form onSubmit={submit} noValidate>
            {isRegister && (
              <label className="field">
                <span>Name</span>
                <input type="text" value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} />
              </label>
            )}
            <label className="field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={isRegister ? 8 : undefined}
              />
              {isRegister && <small>At least 8 characters.</small>}
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" className="button button-primary button-block" disabled={busy}>
              {busy ? (isRegister ? 'Creating account…' : 'Signing in…') : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
