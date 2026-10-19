import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getToken());
  const [loading, setLoading] = useState(Boolean(getToken()));

  const saveSession = useCallback((data) => {
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  // All'avvio, se c'è un token salvato, recupera l'utente.
  useEffect(() => {
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(clearSession)
      .finally(() => setLoading(false));
  }, [clearSession]);

  const login = async (email, password) => saveSession(await api.post('/auth/login', { email, password }));
  const register = async (name, email, password) => saveSession(await api.post('/auth/register', { name, email, password }));

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // se il token è già scaduto basta ripulire la sessione locale
    }
    clearSession();
  };

  const value = useMemo(() => ({ user, token, loading, login, register, logout }), [user, token, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
