import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
      // Clear local records and redirect if unauthorized
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      const mainAppUrl = import.meta.env.VITE_MAIN_APP_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:5173'
          : window.location.origin.replace('-admin', ''));
          
      window.location.href = `${mainAppUrl}/login`;
    }
    return Promise.reject(error);
  }
);

export default api;
