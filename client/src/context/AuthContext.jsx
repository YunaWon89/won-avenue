import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { markLanguageChosen } from '../i18n';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { i18n, t } = useTranslation();
  const toast = useToast();

  // Restore session from the httpOnly cookie.
  useEffect(() => {
    api.get('/auth/session')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Any 401 from a protected request means the session expired.
  useEffect(() => {
    const onExpired = () => {
      setUser((current) => {
        if (current) toast.info(t('auth.sessionExpired'));
        return null;
      });
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [toast, t]);

  const applyLanguage = useCallback((u) => {
    if (u?.preferredLanguage && u.preferredLanguage !== i18n.language) i18n.changeLanguage(u.preferredLanguage);
    markLanguageChosen();
  }, [i18n]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data);
    applyLanguage(res.data);
    return res.data;
  }, [applyLanguage]);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', { ...payload, preferredLanguage: i18n.language });
    setUser(res.data);
    return res.data;
  }, [i18n.language]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data) => {
    const res = await api.patch('/auth/me', data);
    setUser(res.data);
    return res.data;
  }, []);

  const value = useMemo(() => ({
    user, loading, login, register, logout, updateProfile, setUser,
    isCustomer: user?.role === 'customer', isManager: user?.role === 'manager', isAdmin: user?.role === 'admin', isCourier: user?.role === 'courier',
  }), [user, loading, login, register, logout, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
