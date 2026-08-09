import { describe, expect, it, vi } from 'vitest';
import { fetchCurrentUser, login, logout, refreshSession } from './auth';
import { apiGet, apiSend } from '../lib/api-client';

vi.mock('../lib/api-client');

describe('auth api', () => {
  it('login sends identifier and password to /auth/login', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce({} as never);
    await login('12345', 'secret');
    expect(apiSend).toHaveBeenCalledWith('POST', '/auth/login', { identifier: '12345', password: 'secret' });
  });

  it('logout calls POST /auth/logout', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce(undefined as never);
    await logout();
    expect(apiSend).toHaveBeenCalledWith('POST', '/auth/logout');
  });

  it('refreshSession calls POST /auth/refresh', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce({} as never);
    await refreshSession();
    expect(apiSend).toHaveBeenCalledWith('POST', '/auth/refresh');
  });

  it('fetchCurrentUser calls GET /auth/me', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({} as never);
    await fetchCurrentUser();
    expect(apiGet).toHaveBeenCalledWith('/auth/me');
  });
});
