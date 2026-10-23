// Small presentational pieces shared by several pages.

export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M7 22l6-8 5 4 7-9" fill="none" stroke="var(--on-brand)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Chevron({ open }) {
  return (
    <svg className={`chevron${open ? ' is-open' : ''}`} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function External() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Avatar({ user }) {
  if (user.picture) {
    return <img className="avatar" src={user.picture} alt="" referrerPolicy="no-referrer" width="36" height="36" />;
  }
  return <span className="avatar avatar-fallback" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>;
}

export function StatusSelect({ value, options, tones, onChange, label }) {
  return (
    <span className={`pill-select tone-${tones[value] ?? 'idle'}`}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </span>
  );
}

export function Confidence({ value, onChange, label }) {
  const move = (e, n) => {
    const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? Math.min(5, n + 1) : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? Math.max(1, n - 1) : null;
    if (next === null) return;
    e.preventDefault();
    onChange(next);
    e.currentTarget.parentElement.querySelectorAll('button')[next - 1].focus();
  };
  return (
    <div className="confidence" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} of 5`}
          tabIndex={n === value ? 0 : -1}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(n)}
          onKeyDown={(e) => move(e, n)}
        />
      ))}
    </div>
  );
}

export function Badge({ children }) {
  const strong = /^(must|priority)/i.test(children);
  return <span className={`badge${strong ? ' strong' : ''}`}>{children}</span>;
}

const TONE_ORDER = ['done', 'progress', 'info', 'review'];

// Draws a segment for every non-idle status, done first so progress reads left to right.
// What's left over is the empty track (the idle share).
export function StackedBar({ counts, tones, label, tall }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className={`bar${tall ? ' bar-tall' : ''}`} role="img" aria-label={label}>
      {total > 0 &&
        Object.entries(counts)
          .filter(([status, n]) => n > 0 && tones[status] !== 'idle')
          .sort(([a], [b]) => TONE_ORDER.indexOf(tones[a]) - TONE_ORDER.indexOf(tones[b]))
          .map(([status, n]) => (
            <span key={status} className={`tone-${tones[status]}`} style={{ width: `${(n / total) * 100}%` }} title={`${status}: ${n}`} />
          ))}
    </div>
  );
}

export function Notice({ tone = 'info', children }) {
  return <p className={`notice notice-${tone}`}>{children}</p>;
}
