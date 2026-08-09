import { apiGet, apiSend, buildQueryString } from '../lib/api-client';
import type { AdminUser, RoleName } from '../types/api';

export interface CreateUserInput {
  matricula: string;
  nome: string;
  sobrenome: string;
  email: string;
  password: string;
  role: RoleName;
  jobTitle?: string;
  primaryUnitId: string;
  extraUnitIds?: string[];
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password' | 'extraUnitIds'>>;

export function listUsers(includeInactive = false): Promise<AdminUser[]> {
  return apiGet<AdminUser[]>(`/admin/users${buildQueryString({ includeInactive })}`);
}

export function getUser(id: string): Promise<AdminUser> {
  return apiGet<AdminUser>(`/admin/users/${encodeURIComponent(id)}`);
}

export function createUser(input: CreateUserInput): Promise<AdminUser> {
  return apiSend<AdminUser>('POST', '/admin/users', input);
}

export function updateUser(id: string, input: UpdateUserInput): Promise<AdminUser> {
  return apiSend<AdminUser>('PATCH', `/admin/users/${encodeURIComponent(id)}`, input);
}

export function resetPassword(id: string, newPassword: string): Promise<{ success: boolean }> {
  return apiSend('PATCH', `/admin/users/${encodeURIComponent(id)}/reset-password`, { newPassword });
}

export function deactivateUser(id: string): Promise<AdminUser> {
  return apiSend<AdminUser>('PATCH', `/admin/users/${encodeURIComponent(id)}/deactivate`);
}

export function activateUser(id: string): Promise<AdminUser> {
  return apiSend<AdminUser>('PATCH', `/admin/users/${encodeURIComponent(id)}/activate`);
}

export function grantUnitAccess(id: string, unitId: string): Promise<AdminUser> {
  return apiSend<AdminUser>('POST', `/admin/users/${encodeURIComponent(id)}/unit-access`, { unitId });
}

export function revokeUnitAccess(id: string, unitId: string): Promise<AdminUser> {
  return apiSend<AdminUser>('POST', `/admin/users/${encodeURIComponent(id)}/unit-access/revoke`, { unitId });
}
