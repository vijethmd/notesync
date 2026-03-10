import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: `${BASE_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Only redirect on 401 for non-auth routes
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
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const notesAPI = {
  getAll: () => api.get('/notes'),
  getOne: (id) => api.get(`/notes/${id}`),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
  addCollaborator: (id, data) => api.post(`/notes/${id}/collaborators`, data),
  removeCollaborator: (id, userId) => api.delete(`/notes/${id}/collaborators/${userId}`),
};

export const imagesAPI = {
  upload: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/images/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
