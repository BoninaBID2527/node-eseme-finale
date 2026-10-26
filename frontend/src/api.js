// Piccolo client per le API REST: aggiunge il token e trasforma gli errori in Error con messaggio.
// error.status = codice HTTP · error.fields = { campo: messaggio } per i form · error.code = identificativo stabile.
const TOKEN_KEY = 'taskflow_token';
// Chiave di sessione invariata dopo il cambio di nome in BONTASK: così chi ha già fatto l'accesso resta connesso.

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // browser con storage bloccato: la sessione dura finché la pagina resta aperta
  }
};

// Con un token presente, un 401 (o un 403 "account bloccato") significa che la sessione non è più valida:
// lo segnaliamo all'app, che riporta l'utente al login.
export const SESSION_EVENT = 'taskflow:session-ended';
const endSession = (reason) => window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { reason } }));

async function request(method, path, body) {
  const headers = {};
  const token = getToken();
  // Demo statica (GitHub Pages): nessun server, risponde il backend simulato in memoria.
  if (import.meta.env.MODE === 'demo') {
    const { demoRequest } = await import('./demo/server');
    try {
      return await demoRequest(method, path, body, token);
    } catch (error) {
      if (token && error.code === 'session_invalid') endSession('ended');
      throw error;
    }
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const options = { method, headers };
  if (body instanceof FormData) {
    options.body = body; // il browser imposta da solo il multipart
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    const error = new Error('Impossibile contattare il server. Controlla la connessione e riprova.');
    error.network = true;
    throw error;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || 'Si è verificato un errore imprevisto');
    error.status = res.status;
    error.fields = data.errors;
    error.code = data.code;
    const isCredentialsCall = path.startsWith('/auth/login') || path.startsWith('/auth/register');
    if (token && !isCredentialsCall) {
      if (data.code === 'session_invalid') endSession(res.status === 401 && /scadut/i.test(data.message) ? 'expired' : 'ended');
      if (data.code === 'account_blocked') endSession('blocked');
    }
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body ?? {}),
  delete: (path) => request('DELETE', path),
};

// Costruisce una query string ignorando i valori vuoti.
export function toQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}
