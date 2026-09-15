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

// Attach JWT token automatically
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

// Global response interceptor for 401 Unauthorized handling with silent refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const res = await axios.post(`${apiBaseUrl}/auth/refresh`, { refreshToken });
          const { token: newToken, refreshToken: newRefreshToken, user } = res.data;

          localStorage.setItem('token', newToken);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }
          if (user) {
            localStorage.setItem('user', JSON.stringify(user));
          }

          // Also synchronize with desktop persistent storage if running in Electron
          if (typeof window !== 'undefined' && (window as any).electronAPI?.setStoredAuth) {
            (window as any).electronAPI.setStoredAuth({
              token: newToken,
              refreshToken: newRefreshToken || refreshToken,
              user,
            }).catch(console.error);
          }

          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          console.warn('[AUTH] Silent refresh failed:', refreshErr);
        }
      }

      // If no refresh token or refresh failed, clear session and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      if (typeof window !== 'undefined' && (window as any).electronAPI?.clearStoredAuth) {
        (window as any).electronAPI.clearStoredAuth().catch(console.error);
      }

      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/api/')) {
    const relativePath = cleanPath.slice(4);
    return `${apiBaseUrl}${relativePath}`;
  }
  return `${apiBaseUrl}${cleanPath}`;
}

// ── Single Source of Truth for Desktop Installer Download ────────────
export const DEFAULT_DESKTOP_DOWNLOAD_URL = 
  import.meta.env.VITE_DESKTOP_DOWNLOAD_URL || 
  'https://github.com/chandan91077/CareerCopilot/releases/latest/download/CareerCopilotSetup.exe';

export function getDesktopDownloadUrl(): string {
  return DEFAULT_DESKTOP_DOWNLOAD_URL;
}

export default api;
