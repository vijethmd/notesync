import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: `${BASE_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register');
    if (err.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  sendOTP: (data) => api.post('/auth/register/send-otp', data),
  verifyOTP: (data) => api.post('/auth/register/verify', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const notesAPI = {
  getAll: () => api.get('/notes'),
  getOne: (id) => api.get(`/notes/${id}`),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
  invite: (id, data) => api.post(`/notes/${id}/invite`, data),
  removeCollaborator: (id, userId) => api.delete(`/notes/${id}/collaborators/${userId}`),
};

export const foldersAPI = {
  getAll: () => api.get('/folders'),
  create: (data) => api.post('/folders', data),
  update: (id, data) => api.put(`/folders/${id}`, data),
  delete: (id) => api.delete(`/folders/${id}`),
  moveNote: (noteId, folderId) => api.patch(`/folders/move-note/${noteId}`, { folderId }),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: () => api.patch('/notifications/mark-read'),
  accept: (id) => api.post(`/notifications/${id}/accept`),
  decline: (id) => api.post(`/notifications/${id}/decline`),
};

export const imagesAPI = {
  upload: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/images/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export default api;
