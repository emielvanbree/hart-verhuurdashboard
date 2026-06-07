const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (res.status === 401) {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Niet ingelogd');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const dashboard = { get: () => api.get('/dashboard') };

export const articles = {
  list: () => api.get('/articles'),
  available: (due_date) => api.get(`/articles/available?due_date=${due_date}`),
  create: (data) => api.post('/articles', data),
  update: (id, data) => api.put(`/articles/${id}`, data),
  deactivate: (id) => api.del(`/articles/${id}`),
};

export const clients = {
  list: (q) => api.get(`/clients${q ? '?q=' + encodeURIComponent(q) : ''}`),
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
};

export const reservations = {
  list: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return api.get(`/reservations${q ? '?' + q : ''}`);
  },
  get: (id) => api.get(`/reservations/${id}`),
  create: (data) => api.post('/reservations', data),
  cancel: (id) => api.patch(`/reservations/${id}/cancel`),
  confirm: (id) => api.patch(`/reservations/${id}/confirm`),
  generateAgreement: (id, sendEmail) => api.post(`/reservations/${id}/agreement`, { send_email: sendEmail }),
};

export const rentals = {
  list: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return api.get(`/rentals${q ? '?' + q : ''}`);
  },
  get: (id) => api.get(`/rentals/${id}`),
  create: (data) => api.post('/rentals', data),
  generateInvoice: (id, sendEmail) => api.post(`/rentals/${id}/invoice`, { send_email: sendEmail }),
  generateSettlementDocs: (id) => api.post(`/rentals/${id}/settlement-docs`),
  updateBirthDate: (id, birth_date) => api.patch(`/rentals/${id}/birth-date`, { birth_date }),
  processReturn: (id, data) => api.post(`/returns/${id}/return`, data),
  createExtraInvoice: (id, data) => api.post(`/returns/${id}/extra-invoice`, data),
  generateReturnReceipt: (id) => api.post(`/rentals/${id}/return-receipt`),
};

export const documents = {
  downloadUrl: (id) => `/api/documents/${id}/download`,
  viewUrl: (id) => `/api/documents/${id}/view`,
  email: (id, to, cc) => api.post(`/documents/${id}/email`, { to, cc }),
};

// Extend rentals with return receipt


export const users = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
};

export const settings = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  testEmail: () => api.post('/settings/test-email'),
};

export const waitlist = {
  list: () => api.get('/waitlist'),
  add: (data) => api.post('/waitlist', data),
  resolve: (id) => api.patch(`/waitlist/${id}/resolve`),
  remove: (id) => api.del(`/waitlist/${id}`),
};
