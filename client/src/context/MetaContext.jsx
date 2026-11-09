import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

/** Vocabularies from the server (allergens, dietary tags, cuisines) + payment / translation config. */
const DEFAULT = {
  allergens: [], dietaryTags: [], cuisines: [], languages: ['ko', 'en'], autoTranslate: false,
  payment: { provider: 'mock', currency: 'KRW' },
};
const MetaContext = createContext(DEFAULT);

export function MetaProvider({ children }) {
  const [meta, setMeta] = useState(DEFAULT);
  useEffect(() => {
    // Retry a few times: on a cold start the first request can fail or time out.
    let cancelled = false;
    const load = (attempt) => api.get('/meta')
      .then((res) => { if (!cancelled) setMeta({ ...DEFAULT, ...res.data }); })
      .catch(() => { if (!cancelled && attempt < 4) setTimeout(() => load(attempt + 1), 1500 * 2 ** attempt); });
    load(0);
    return () => { cancelled = true; };
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);
