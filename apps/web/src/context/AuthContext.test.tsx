import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { UNAUTHORIZED_EVENT } from '../lib/api-client';
import * as authApi from '../api/auth';
import type { AuthenticatedUser } from '../types/api';

vi.mock('../api/auth');

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  matricula: '001',
  nome: 'Ana',
  sobrenome: 'Silva',
  email: 'ana@example.com',
  role: 'ELABORADOR',
  primaryUnitId: 'unit-1',
};

function Consumer() {
  const { user, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? user.nome : 'anon'}</span>
      <button onClick={() => login('001', 'senha')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('AuthProvider / useAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when useAuth is called outside an AuthProvider', () => {
    const BareConsumer = () => {
      useAuth();
      return null;
    };
    expect(() => render(<BareConsumer />)).toThrow('useAuth deve ser usado dentro de um AuthProvider');
  });

  it('starts loading and asks GET /auth/me, since the session cookie is not readable by JS', async () => {
    vi.mocked(authApi.fetchCurrentUser).mockRejectedValueOnce(new Error('unauthorized'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('anon');
  });

  it('sets the user when GET /auth/me succeeds on mount', async () => {
    vi.mocked(authApi.fetchCurrentUser).mockResolvedValueOnce(mockUser);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('Ana');
  });

  it('login stores the user returned by the API', async () => {
    vi.mocked(authApi.fetchCurrentUser).mockRejectedValueOnce(new Error('unauthorized'));
    vi.mocked(authApi.login).mockResolvedValueOnce({ user: mockUser });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => {
      fireEvent.click(screen.getByText('login'));
    });

    expect(screen.getByTestId('user').textContent).toBe('Ana');
  });

  it('logout clears the user locally and calls the API to invalidate the cookie', async () => {
    vi.mocked(authApi.fetchCurrentUser).mockResolvedValueOnce(mockUser);
    const logoutMock = vi.mocked(authApi.logout).mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Ana'));

    fireEvent.click(screen.getByText('logout'));

    expect(screen.getByTestId('user').textContent).toBe('anon');
    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
  });

  it('logs out automatically when an UNAUTHORIZED_EVENT is dispatched, without calling the API', async () => {
    vi.mocked(authApi.fetchCurrentUser).mockResolvedValueOnce(mockUser);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Ana'));

    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });

    expect(screen.getByTestId('user').textContent).toBe('anon');
    expect(authApi.logout).not.toHaveBeenCalled();
  });
});
