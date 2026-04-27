import axios from 'axios';

const API_BASE = '/api';
const TENANT_ID = 'default';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'x-tenant-id': TENANT_ID },
});

// Inject JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/')) {
      localStorage.removeItem('qf_token');
      localStorage.removeItem('qf_admin');
      window.dispatchEvent(new Event('auth-logout'));
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authRegister = (data) => api.post('/auth/register', data);
export const authLogin = (data) => api.post('/auth/login', data);
export const authMe = () => api.get('/auth/me');

// Admin APIs
export const uploadPDF = (formData) =>
  api.post('/admin/upload-pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const getUploadStatus = (jobId) =>
  api.get(`/admin/upload-status/${jobId}`);

export const saveQuestions = (questions) =>
  api.post('/admin/questions', { questions });

export const getQuestions = (params) =>
  api.get('/admin/questions', { params });

export const updateQuestion = (id, data) =>
  api.put(`/admin/questions/${id}`, data);

export const deleteQuestion = (id) =>
  api.delete(`/admin/questions/${id}`);

export const deleteAllQuestions = () =>
  api.delete('/admin/questions');

export const getAdminStats = () =>
  api.get('/admin/stats');

// Quiz APIs
export const getQuizConfig = () => api.get('/quiz/config');
export const startQuiz = (data) => api.post('/quiz/start', data);
export const submitQuiz = (data) => api.post('/quiz/submit', data);
export const getQuizSession = (id) => api.get(`/quiz/session/${id}`);
export const getResult = (id) => api.get(`/quiz/result/${id}`);
export const getLeaderboard = () => api.get('/quiz/leaderboard');
export const joinQuizByCode = (code) => api.post('/quiz/join', { code });

// Quiz Template APIs (Admin)
export const createQuizTemplate = (data) => api.post('/admin/quiz-templates', data);
export const listQuizTemplates = () => api.get('/admin/quiz-templates');
export const toggleQuizTemplate = (id) => api.patch(`/admin/quiz-templates/${id}/toggle`);
export const deleteQuizTemplate = (id, mode = 'quiz-only') =>
  api.delete(`/admin/quiz-templates/${id}?mode=${mode}`);

export default api;
