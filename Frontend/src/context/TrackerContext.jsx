import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const TrackerContext = createContext(null);

const withRowValues = (data, rowId, changes) => ({
  ...data,
  sheets: data.sheets.map((sheet) =>
    sheet.rows.some((r) => r.id === rowId)
      ? { ...sheet, rows: sheet.rows.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, ...changes } } : r)) }
      : sheet,
  ),
});

export function TrackerProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [toast, setToast] = useState(null);
  const dataRef = useRef(null);
  const queue = useRef(Promise.resolve());

  dataRef.current = state.data;

  const load = useCallback(() => {
    setState({ status: 'loading', data: null, error: null });
    api
      .get('/tracker')
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((err) => setState({ status: 'error', data: null, error: err.message }));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user?.id, load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Updates the screen immediately, then saves. Saves run one after another so they can't arrive out of order;
  // if one fails, that row goes back to what it was and a message explains why.
  const update = useCallback((rowId, changes) => {
    const row = dataRef.current?.sheets.flatMap((s) => s.rows).find((r) => r.id === rowId);
    if (!row) return;
    const previous = Object.fromEntries(Object.keys(changes).map((k) => [k, row.values[k]]));

    setState((s) => ({ ...s, data: withRowValues(s.data, rowId, changes) }));
    queue.current = queue.current
      .then(() => api.patch(`/items/${encodeURIComponent(rowId)}`, changes))
      .catch((err) => {
        setState((s) => (s.data ? { ...s, data: withRowValues(s.data, rowId, previous) } : s));
        setToast(`Couldn't save that change. ${err.message}`);
      });
  }, []);

  const value = useMemo(() => ({ ...state, reload: load, update }), [state, load, update]);

  return (
    <TrackerContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">×</button>
        </div>
      )}
    </TrackerContext.Provider>
  );
}

export const useTracker = () => useContext(TrackerContext);
