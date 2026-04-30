import axios from 'axios';

// In production: VITE_API_URL = https://quizforge-production-41b2.up.railway.app
// In development: falls back to /api (handled by Vite proxy or relative path)
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';
const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'default';
const TENANT_API_KEY = import.meta.env.VITE_TENANT_API_KEY || (import.meta.env.DEV ? 'qf_default_key_2024' : '');

const defaultHeaders = { 'x-tenant-id': TENANT_ID };
if (TENANT_API_KEY) {
  defaultHeaders['x-api-key'] = TENANT_API_KEY;
}

const api = axios.create({
  baseURL: API_BASE,
  headers: defaultHeaders,
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
export const getLeaderboard = (params) => api.get('/quiz/leaderboard', { params });
export const joinQuizByCode = (code) => api.post('/quiz/join', { code });

// Quiz Template APIs (Admin)
export const createQuizTemplate = (data) => api.post('/admin/quiz-templates', data);
export const listQuizTemplates = () => api.get('/admin/quiz-templates');
export const toggleQuizTemplate = (id) => api.patch(`/admin/quiz-templates/${id}/toggle`);
export const updateQuizTemplate = (id, data) => api.put(`/admin/quiz-templates/${id}`, data);
export const deleteQuizTemplate = (id, mode = 'quiz-only') =>
  api.delete(`/admin/quiz-templates/${id}?mode=${mode}`);

// Tenant Settings
export const getTenantSettings = () => api.get('/admin/settings');
export const updateTenantSettings = (settings) => api.put('/admin/settings', settings);

// Quiz Reports (Admin)
export const listQuizReports = () => api.get('/admin/reports/quizzes');
export const getQuizReport = (code) => api.get(`/admin/reports/quizzes/${code}`);

export default api;
