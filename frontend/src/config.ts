// Environment detection
const isProduction = import.meta.env.VITE_NODE_ENV === 'production';

// API Configuration
export const API_BASE_URL = isProduction 
  ? 'https://tapeutilsbk.octro.com'  // Production
  : 'http://localhost:8000';  // Development

// Auth Configuration
export const AUTH_BASE_URL = isProduction
  ? 'https://tapeutils.octro.com'  // Production
  : 'http://localhost:8000';  // Development

// Cookie Configuration
export const COOKIE_CONFIG = {
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  domain: isProduction ? '.octro.com' : undefined,
  path: '/'
};

// API URL helpers
export const getApiUrl = (path: string) => {
  return `${API_BASE_URL}${path}`;
};

export const getAuthUrl = (path: string) => {
  return `${AUTH_BASE_URL}${path}`;
}; 