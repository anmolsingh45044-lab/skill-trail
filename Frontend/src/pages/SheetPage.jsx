import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Badge, Chevron, Confidence, External, StackedBar, StatusSelect } from '../components/ui.jsx';
import { useTracker } from '../context/TrackerContext.jsx';
import NotFoundPage from './NotFoundPage.jsx';

const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

function LinkValue({ href, label }) {
  return (
    <a className="ext-link" href={href} target="_blank" rel="noopener noreferrer">
      {label ?? href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')} <External />
    </a>
  );
}

// An editable text box that saves when you leave it (or, for dates, as soon as you pick one).
function EditableField({ col, value, onSave, label }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = (next) => {
    if (next !== value) onSave(next);
  };

  if (col.type === 'note') {
    return <textarea aria-label={label} rows={3} maxLength={2000} value={draft} placeholder="Add a note" onChange={(e) => setDraft(e.target.value)} onBlur={() => commit(draft)} />;
  }
  if (col.type === 'date') {
    return <input aria-label={label} type="date" value={draft} onChange={(e) => { setDraft(e.target.value); commit(e.target.value); }} />;
  }
  return <input aria-label={label} type="text" maxLength={300} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit(draft)} />;
}

function TableCell({ col, value, spec, title, onChange }) {
  switch (col.type) {
    case 'status':
      return <StatusSelect value={value} options={spec.options} tones={spec.tones} label={`Status for ${title}`} onChange={(v) => onChange({ status: v })} />;
    case 'confidence':
      return <Confidence value={value} label={`Confidence for ${title}`} onChange={(v) => onChange({ confidence: v })} />;
    case 'badge':
      return value ? <Badge>{value}</Badge> : null;
    case 'link':
      return isUrl(value) ? <LinkValue href={value} label="Open" /> : null;
    default:
      return <span className="clamp">{value}</span>;
  }
}

function DetailValue({ col, value, title, onChange }) {
  if (col.editable) {
    return <EditableField col={col} value={value} label={`${col.label} for ${title}`} onSave={(v) => onChange({ [col.key]: v })} />;
  }
  if (isUrl(value)) return <LinkValue href={value} />;
  return <>{value || <span className="muted">None</span>}</>;
}

function Row({ sheet, row, spec, open, flash, tableCols, detailCols, colSpan, onToggle, onChange }) {
  const v = row.values;
  const title = v[sheet.primary];
  const secondary = sheet.secondary ? v[sheet.secondary] : '';

  return (
    <>
      <tr id={`row-${row.id}`} className={`item${open ? ' is-open' : ''}${flash ? ' is-flash' : ''}`}>
        {spec?.checkable && (
          <td className="cell-check">
            <input
              type="checkbox"
              aria-label={`Mark "${title}" as done`}
              checked={v.status === spec.done}
              onChange={(e) => onChange({ status: e.target.checked ? spec.done : spec.initial })}
            />
          </td>
        )}
        <td className="cell-primary">
          <button type="button" className="title-button" aria-expanded={open} aria-controls={`detail-${row.id}`} onClick={onToggle}>
            <span className="primary">{title}</span>
            {secondary && <span className="secondary">{secondary}</span>}
          </button>
        </td>
        {tableCols.map((col) => (
          <td key={col.key} data-label={col.label} className={`cell-${col.type}`}>
            <TableCell col={col} value={v[col.key]} spec={spec} title={title} onChange={onChange} />
          </td>
        ))}
        <td className="cell-toggle" aria-hidden="true" onClick={onToggle}>
          <Chevron open={open} />
        </td>
      </tr>

      {open && (
        <tr id={`detail-${row.id}`} className="detail">
          <td colSpan={colSpan}>
            <dl className="detail-grid">
              {detailCols.map((col) => (
                <div key={col.key} className={`detail-item${col.type === 'note' || col.type === 'input' ? ' wide' : ''}`}>
                  <dt>{col.label}</dt>
                  <dd><DetailValue col={col} value={v[col.key]} title={title} onChange={onChange} /></dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

function SheetView({ sheet, statusSets, update }) {
  const spec = sheet.statusSet ? statusSets[sheet.statusSet] : null;
  const { hash } = useLocation();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState({});
  const [openIds, setOpenIds] = useState(() => new Set());
  const [flashId, setFlashId] = useState(null);

  const col = (key) => sheet.columns.find((c) => c.key === key);
  const tableCols = sheet.columns.filter((c) => c.table);
  const detailCols = sheet.columns.filter((c) => !c.table && ![sheet.primary, sheet.secondary, sheet.groupBy].includes(c.key));
  const colSpan = tableCols.length + 2 + (spec?.checkable ? 1 : 0);

  const filterOptions = useMemo(
    () => sheet.filters.map((key) => ({ key, label: col(key).label, values: [...new Set(sheet.rows.map((r) => r.values[key]).filter(Boolean))] })),
    [sheet],
  );

  // Opening a link from the dashboard lands on the right row, expanded.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id || !sheet.rows.some((r) => r.id === id)) return undefined;
    setQuery('');
    setStatus('');
    setFilters({});
    setOpenIds((prev) => new Set(prev).add(id));
    setFlashId(id);
    const scroll = setTimeout(() => document.getElementById(`row-${id}`)?.scrollIntoView({ block: 'center' }), 60);
    const clear = setTimeout(() => setFlashId(null), 2200);
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  }, [hash, sheet.key]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sheet.rows.filter((row) => {
      const v = row.values;
      if (status && v.status !== status) return false;
      if (Object.entries(filters).some(([key, wanted]) => wanted && v[key] !== wanted)) return false;
      return !needle || Object.values(v).some((x) => String(x).toLowerCase().includes(needle));
    });
  }, [sheet, query, status, filters]);

  const groups = useMemo(() => {
    if (!sheet.groupBy) return [{ name: null, rows: visible }];
    const byName = new Map();
    for (const row of visible) {
      const name = row.values[sheet.groupBy];
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(row);
    }
    return [...byName].map(([name, rows]) => ({ name, rows }));
  }, [visible, sheet.groupBy]);

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtering = query || status || Object.values(filters).some(Boolean);
  const clearFilters = () => {
    setQuery('');
    setStatus('');
    setFilters({});
  };

  const statusCounts = spec ? Object.fromEntries(spec.options.map((o) => [o, sheet.rows.filter((r) => r.values.status === o).length])) : null;

  return (
    <>
      <header className="page-head">
        <h1>{sheet.title}</h1>
        {sheet.subtitle && <p className="lede">{sheet.subtitle}</p>}

        {spec?.checkable && (
          <div className="sheet-progress">
            <StackedBar counts={statusCounts} tones={spec.tones} label={`${statusCounts[spec.done]} of ${sheet.rows.length} done`} />
            <p><strong>{statusCounts[spec.done]}</strong> of {sheet.rows.length} done</p>
          </div>
        )}

        {sheet.help && (
          <details className="help">
            <summary>{sheet.help.title}</summary>
            <dl>
              {sheet.help.items.map((item) => (
                <div key={item.term}><dt>{item.term}</dt><dd>{item.text}</dd></div>
              ))}
            </dl>
          </details>
        )}
      </header>

      {(sheet.rows.length > 8 || spec) && (
        <div className="toolbar" role="search">
          <label className="search">
            <span className="sr-only">Search this list</span>
            <input type="search" placeholder="Search this list" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>

          {spec && (
            <label className="select-filter">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                {spec.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}

          {filterOptions.map((f) => (
            <label key={f.key} className="select-filter">
              <span>{f.label}</span>
              <select value={filters[f.key] ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}>
                <option value="">All</option>
                {f.values.map((val) => <option key={val} value={val}>{val}</option>)}
              </select>
            </label>
          ))}

          {filtering && <button type="button" className="link-button" onClick={clearFilters}>Clear filters</button>}
          <p className="result-count" aria-live="polite">{visible.length} of {sheet.rows.length} shown</p>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="state-message">
          <p>Nothing matches those filters.</p>
          <button type="button" className="button" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                {spec?.checkable && <th className="col-check"><span className="sr-only">Done</span></th>}
                <th>{col(sheet.primary).label}</th>
                {tableCols.map((c) => <th key={c.key}>{c.label}</th>)}
                <th className="col-toggle"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.name ?? 'all'}>
                {group.name && (
                  <tr className="group-row">
                    <th colSpan={colSpan} scope="colgroup">
                      {group.name}
                      <span>
                        {spec?.checkable
                          ? `${group.rows.filter((r) => r.values.status === spec.done).length} of ${group.rows.length} done`
                          : `${group.rows.length} ${group.rows.length === 1 ? 'item' : 'items'}`}
                      </span>
                    </th>
                  </tr>
                )}
                {group.rows.map((row) => (
                  <Row
                    key={row.id}
                    sheet={sheet}
                    row={row}
                    spec={spec}
                    open={openIds.has(row.id)}
                    flash={flashId === row.id}
                    tableCols={tableCols}
                    detailCols={detailCols}
                    colSpan={colSpan}
                    onToggle={() => toggle(row.id)}
                    onChange={(changes) => update(row.id, changes)}
                  />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {sheet.footnotes?.length > 0 && (
        <section className="footnotes" aria-label="Notes">
          <dl>
            {sheet.footnotes.map((n) => (
              <div key={n.label}><dt>{n.label}</dt><dd>{n.text}</dd></div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

export default function SheetPage() {
  const { key } = useParams();
  const { data, update } = useTracker();
  const sheet = data.sheets.find((s) => s.key === key);
  if (!sheet) return <NotFoundPage />;
  // Keyed by sheet so search, filters and open rows reset when you switch lists.
  return <SheetView key={sheet.key} sheet={sheet} statusSets={data.statusSets} update={update} />;
}
