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

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': getAdminKey(),
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
};

export { getAdminKey, setAdminKey, clearAdminKey, BASE_URL };
