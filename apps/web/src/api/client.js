const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function getAdminKey() {
  return localStorage.getItem('adminKey') || '';
}

function setAdminKey(key) {
  localStorage.setItem('adminKey', key);
}

function clearAdminKey() {
  localStorage.removeItem('adminKey');
}

// Token JWT de usuário (2026-08-05) — convive com ADMIN_KEY, não substitui.
// requireAdmin no backend aceita os dois; se authToken existir, ele manda
// (Authorization: Bearer), a x-admin-key vai junto por retrocompatibilidade.
function getAuthToken() {
  return localStorage.getItem('authToken') || '';
}

function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

function clearAuthToken() {
  localStorage.removeItem('authToken');
}

function getCurrentUser() {
  const raw = localStorage.getItem('authUser');
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  localStorage.setItem('authUser', JSON.stringify(user));
}

function clearSession() {
  clearAdminKey();
  clearAuthToken();
  localStorage.removeItem('authUser');
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const authHeaders = { 'x-admin-key': getAdminKey() };
  const token = getAuthToken();
  if (token) authHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status} ao chamar ${path}`);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export {
  getAdminKey, setAdminKey, clearAdminKey,
  getAuthToken, setAuthToken, clearAuthToken,
  getCurrentUser, setCurrentUser, clearSession,
  BASE_URL,
};
