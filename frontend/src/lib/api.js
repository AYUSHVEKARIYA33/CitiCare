import axios from 'axios';

const rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim().replace(/\/+$/, '');
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

// Automatically remove default Content-Type header when sending FormData
// so browser sets multipart/form-data with exact boundary parameter
api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Log in dev if API URL is wrong (Vite only injects env at build/start - restart dev server after changing .env)
if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.warn('[api] VITE_API_URL not set in .env; using fallback:', API_URL);
}

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export function getAuthToken() {
  return localStorage.getItem('token');
}

export function clearAuthToken() {
  localStorage.removeItem('token');
  setAuthToken(null);
}

export function resolveAssetUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${API_ORIGIN}${normalizedPath}`;
}

// Initialize token from storage on load
const stored = getAuthToken();
if (stored) setAuthToken(stored);
