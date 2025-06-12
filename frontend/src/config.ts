// Determine if we're in development or production
const isProduction = process.env.NODE_ENV === 'production';

// Base URL for API calls
export const API_BASE_URL = isProduction 
  ? 'https://tapeutilsbk.octro.com'  // Production
  : 'http://localhost:8000';  // Development

// Base URL for auth redirects (must be same domain as frontend)
export const AUTH_BASE_URL = isProduction
  ? 'https://tapeutils.octro.com'  // Production
  : 'http://localhost:8000';  // Development

export const getApiUrl = (path: string) => {
  return `${API_BASE_URL}${path}`;
};

export const getAuthUrl = (path: string) => {
  return `${AUTH_BASE_URL}${path}`;
}; 