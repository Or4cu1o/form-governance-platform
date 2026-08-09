import { apiGet, apiSend } from '../lib/api-client';
import type { AuthenticatedUser, LoginResponse } from '../types/api';

export function login(identifier: string, password: string): Promise<LoginResponse> {
  return apiSend<LoginResponse>('POST', '/auth/login', { identifier, password });
}

// A sessao vive em cookie HttpOnly (F16.2): o cliente nao consegue apaga-lo
// nem inspeciona-lo, entao encerrar e renovar a sessao so podem ser
// operacoes de servidor.
export function logout(): Promise<void> {
  return apiSend<void>('POST', '/auth/logout');
}

export function refreshSession(): Promise<LoginResponse> {
  return apiSend<LoginResponse>('POST', '/auth/refresh');
}

export function fetchCurrentUser(): Promise<AuthenticatedUser> {
  return apiGet<AuthenticatedUser>('/auth/me');
}
