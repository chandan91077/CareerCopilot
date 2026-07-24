import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'https://careercopilot-hu7q.onrender.com';
const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
const apiBaseUrl = normalizedBaseUrl.endsWith('/api') ? normalizedBaseUrl : `${normalizedBaseUrl}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Do not reload if the failure is on the login request itself
      if (error.config && error.config.url && error.config.url.includes('/auth/login')) {
        return Promise.reject(error);
      }

      // Clear local records - the AdminLayout will show its own login form
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Reload to show the admin login form instead of redirecting away
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
