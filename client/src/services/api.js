import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 620000,
});

api.interceptors.request.use((config) => {
  if (config.data === null) {
    config.data = {};
  }
  return config;
});

export default api;
