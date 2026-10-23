import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { StackedBar } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTracker } from '../context/TrackerContext.jsx';

const percent = (fraction) => `${Math.round(fraction * 100)}%`;

function Route({ track, tones }) {
  return (
    <article className="route">
      <div className="route-head">
        <h3><Link to={`/sheet/${track.key}`}>{track.title}</Link></h3>
        <p>
          <strong>{track.counts.Done}</strong> of {track.total} done ({percent(track.completion)})
        </p>
      </div>

      <div className="rail">
        {track.phases.map((phase) => (
          <div key={phase.name} className="rail-seg" style={{ flex: phase.total }}>
            <StackedBar
              tall
              counts={phase.counts}
              tones={tones}
              label={`${phase.name}: ${phase.counts.Done} of ${phase.total} done`}
            />
          </div>
        ))}
      </div>

      <ul className="phase-list">
        {track.phases.map((phase) => (
          <li key={phase.name}>
            <span>{phase.name}</span>
            <b>{phase.counts.Done}/{phase.total}</b>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data } = useTracker();
  const [dash, setDash] = useState(null);
  const [error, setError] = useState('');

  // Reload whenever you open the dashboard so it reflects the changes you just made.
  useEffect(() => {
    api.get('/dashboard').then(setDash).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="state-message">{error}</p>;
  if (!dash) return <p className="state-message">Loading your dashboard…</p>;

  const learningTones = data.statusSets.learning.tones;
  const appTones = data.statusSets.application.tones;
  const { totals } = dash;
  const firstName = user.name.trim().split(/\s+/)[0];

  return (
    <>
      <header className="page-head">
        <h1>Hi {firstName}</h1>
        <p className="lede">
          {totals.counts.Done} of {totals.total} roadmap tasks are done. {totals.counts.Pending} in progress,{' '}
          {totals.counts.Revision} to revise.
        </p>
      </header>

      <section className="section" aria-labelledby="next-heading">
        <h2 id="next-heading">{dash.nextUp.kind === 'continue' ? 'Pick up where you left off' : 'Good places to start'}</h2>
        {dash.nextUp.items.length === 0 ? (
          <p className="muted">Nothing is waiting. Every roadmap task is done.</p>
        ) : (
          <ul className="next-list">
            {dash.nextUp.items.map((item) => (
              <li key={item.id}>
                <Link to={`/sheet/${item.sheetKey}#${encodeURIComponent(item.id)}`}>
                  <span className={`status-dot tone-${learningTones[item.status]}`} aria-hidden="true" />
                  <span className="next-title">{item.title}</span>
                  <span className="next-meta">{item.sheetTitle}, {item.phase}</span>
                  <span className={`chip tone-${learningTones[item.status]}`}>{item.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="routes-heading">
        <h2 id="routes-heading">Your routes</h2>
        <p className="muted section-note">Each segment is a phase, sized by how many tasks it holds.</p>
        <div className="routes">
          {dash.tracks.map((track) => (
            <Route key={track.key} track={track} tones={learningTones} />
          ))}
        </div>
        <ul className="legend" aria-label="Colour key">
          {['Done', 'Pending', 'Revision'].map((status) => (
            <li key={status}><span className={`status-dot tone-${learningTones[status]}`} aria-hidden="true" />{status}</li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="apps-heading">
        <h2 id="apps-heading">Applications</h2>
        <div className="mini-list">
          {dash.applications.map((list) => (
            <article key={list.key} className="mini">
              <div className="mini-head">
                <h3><Link to={`/sheet/${list.key}`}>{list.title}</Link></h3>
                <span>{list.total} listed</span>
              </div>
              <StackedBar counts={list.counts} tones={appTones} label={`${list.title} by application status`} />
              <ul className="chips">
                {Object.entries(list.counts)
                  .filter(([status, n]) => n > 0 && status !== 'Not started')
                  .map(([status, n]) => (
                    <li key={status} className={`chip tone-${appTones[status]}`}>{status} {n}</li>
                  ))}
                {Object.entries(list.counts).every(([status, n]) => status === 'Not started' || n === 0) && (
                  <li className="muted">None started yet</li>
                )}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="lists-heading">
        <h2 id="lists-heading">Library progress</h2>
        <div className="mini-list">
          {dash.lists.map((list) => (
            <article key={list.key} className="mini">
              <div className="mini-head">
                <h3><Link to={`/sheet/${list.key}`}>{list.title}</Link></h3>
                <span>{list.done} of {list.total} done</span>
              </div>
              <StackedBar counts={list.counts} tones={data.statusSets[list.statusSet].tones} label={`${list.title} progress`} />
            </article>
          ))}
        </div>
      </section>

      <details className="section how-to">
        <summary>How this tracker works</summary>
        <ol>
          <li>Work through the roadmaps in order: SWE, then AI/ML, then the AI + SWE integration project.</li>
          <li>Set each task's status. Mark it Done only when you can explain and reproduce it, and use Revision for topics that need another pass.</li>
          <li>Rate your confidence from 1 to 5 and keep notes or proof links as you go. Everything saves automatically to your account.</li>
          <li>Track applications under Company roles and Apply links. Verify that a role is open and that you meet the eligibility rules before you apply.</li>
        </ol>
      </details>
    </>
  );
}
