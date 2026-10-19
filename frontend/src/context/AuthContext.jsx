import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, SESSION_EVENT } from '../api';

const AuthContext = createContext(null);

const NOTICES = {
  expired: 'La tua sessione è scaduta. Accedi di nuovo per continuare.',
  ended: 'La sessione è terminata. Accedi di nuovo per continuare.',
  blocked: 'Il tuo account è stato bloccato da un amministratore.',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getToken());
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [notice, setNotice] = useState('');

  const saveSession = useCallback((data) => {
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    setNotice('');
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

  // Sessione scaduta, revocata o account bloccato: pulisce tutto e spiega il motivo nella pagina di accesso.
  useEffect(() => {
    const onEnded = (e) => {
      if (!getToken()) return;
      clearSession();
      setNotice(NOTICES[e.detail.reason] || NOTICES.ended);
    };
    window.addEventListener(SESSION_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_EVENT, onEnded);
  }, [clearSession]);

  const login = async (email, password) => saveSession(await api.post('/auth/login', { email, password }));
  const register = async (name, email, password) => saveSession(await api.post('/auth/register', { name, email, password }));

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // se il token è già scaduto basta ripulire la sessione locale
    }
    clearSession();
    setNotice('');
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, token, loading, notice, clearNotice: () => setNotice(''), login, register, logout, saveSession, setUser }),
    [user, token, loading, notice, logout, saveSession] // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
