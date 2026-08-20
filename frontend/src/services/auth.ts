import { api } from './api';
import type { LoginRequest, MeResponse, TokenResponse } from '@/types/auth';

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/api/auth/login', payload);
  return data;
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/api/auth/me');
  return data;
}
