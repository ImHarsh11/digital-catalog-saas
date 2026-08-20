import axios from 'axios';
import { getToken } from '@/utils/tokenStorage';

// Base URL for the FastAPI backend. Configured via Vite env var so it can
// differ between local development and deployed environments.
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the JWT to every outgoing request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
