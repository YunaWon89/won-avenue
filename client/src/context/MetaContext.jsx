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
    api.get('/meta').then((res) => setMeta(res.data)).catch(() => {});
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);
