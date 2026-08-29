import axios from 'axios';
import { API_BASE_URL } from './api';
import { getAnonymousSessionId } from '@/utils/anonymousSession';
import { getDeviceId } from '@/utils/deviceId';

// Separate axios instance for the unauthenticated customer catalog.
// Deliberately does NOT attach the shop-owner/super-admin JWT from
// `./api` -- a customer never logs in -- only an anonymous, ephemeral
// per-tab session id used solely to group customer_events server-side.
export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

publicApi.interceptors.request.use((config) => {
  config.headers['X-Anon-Session-Id'] = getAnonymousSessionId();
  config.headers['X-Device-Id'] = getDeviceId();
  return config;
});
