
// API Configuration
// export const API_BASE_URL = isProduction 
//   ? 'https://tapeutilsbk.octro.com'  // Production
//   : 'http://localhost:8000';  // Development

export const API_BASE_URL = import.meta.env.VITE_API_URL;

// // Auth Configuration
// export const AUTH_BASE_URL = isProduction
//   ? 'https://tapeutils.octro.com'  // Production
//   : 'http://localhost:8000';  // Development

export const AUTH_BASE_URL = import.meta.env.VITE_API_URL;

// API URL helpers
export const getApiUrl = (path: string) => {
  return `${API_BASE_URL}${path}`;
};

export const getAuthUrl = (path: string) => {
  return `${AUTH_BASE_URL}${path}`;
}; 