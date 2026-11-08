import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Load data with loading / error state.
 * const { data, loading, error, reload } = useApi(() => api.get('/x'), [dep]);
 */
export function useApi(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const id = ++seq.current;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === seq.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ data: quiet ? s.data : null, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

/**
 * Keep list filters in the URL (shareable, survives reload and back button).
 * Arrays are stored as comma lists. Changing any filter except `page` resets page to 1.
 */
export function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();
  const state = {};
  Object.entries(defaults).forEach(([k, def]) => {
    const raw = params.get(k);
    if (raw === null) state[k] = def;
    else if (Array.isArray(def)) state[k] = raw ? raw.split(',') : [];
    else if (typeof def === 'number') state[k] = Number(raw) || def;
    else state[k] = raw;
  });

  const update = useCallback((patch) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => {
        const def = defaults[k];
        const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
        if (empty || String(v) === String(def)) next.delete(k);
        else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
      });
      if (!('page' in patch)) next.delete('page');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setParams]);

  return [state, update];
}

/** Persisted per-device preference. */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial; } catch { return initial; }
  });
  const set = useCallback((v) => {
    setValue(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
  }, [key]);
  return [value, set];
}
