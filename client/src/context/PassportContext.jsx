import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { EMPTY_PASSPORT, isActive, isConfigured } from '../utils/passport';

/**
 * Food passport. Stored on the server for logged-in customers (follows them across devices)
 * and in localStorage for guests (copied to the account when they sign up).
 */
const PassportContext = createContext(null);
const KEY = 'passport.v1';

const readLocal = () => {
  try { return { ...EMPTY_PASSPORT, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return null; }
};

export function PassportProvider({ children }) {
  const { user, setUser, isCustomer } = useAuth();
  const [local, setLocal] = useState(() => readLocal() || EMPTY_PASSPORT);

  // Logged-in customers: the server copy is the source of truth.
  const passport = isCustomer && user?.passport ? { ...EMPTY_PASSPORT, ...user.passport } : local;
  const usable = !user || isCustomer; // owners/admins don't order

  /** `consent` is stored with the local copy; the server keeps its own consent date (passportConsentAt). */
  const save = useCallback(async (next, { consent } = {}) => {
    const { consent: localConsent, ...value } = { ...EMPTY_PASSPORT, ...next };
    const stored = { ...value, consent: Boolean(localConsent || consent) };
    setLocal(stored);
    try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch { /* ignore */ }
    if (isCustomer) {
      const res = await api.patch('/auth/me', { passport: value, ...(consent ? { passportConsent: true } : {}) });
      setUser(res.data);
    }
    return value;
  }, [isCustomer, setUser]);

  const setEnabled = useCallback((enabled) => save({ ...passport, enabled }), [passport, save]);

  // After signing up as a customer, move the guest passport to the account (only if the guest agreed to keep it).
  useEffect(() => {
    if (isCustomer && user && !user.passport && isConfigured(local) && local.consent) {
      const { consent, ...value } = local;
      api.patch('/auth/me', { passport: value, passportConsent: true }).then((res) => setUser(res.data)).catch(() => {});
    }
  }, [isCustomer, user, local, setUser]);

  const value = useMemo(() => ({
    passport,
    usable,
    configured: usable && isConfigured(passport),
    active: usable && isActive(passport),
    save,
    setEnabled,
  }), [passport, usable, save, setEnabled]);

  return <PassportContext.Provider value={value}>{children}</PassportContext.Provider>;
}

export const usePassport = () => useContext(PassportContext);
