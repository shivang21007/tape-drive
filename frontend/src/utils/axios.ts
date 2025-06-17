import axios from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  maxContentLength: 100 * 1024 * 1024 * 1024, // 100GB
  maxBodyLength: 100 * 1024 * 1024 * 1024, // 100GB
  timeout: 0, // No timeout for large file uploads
});

export default instance; 