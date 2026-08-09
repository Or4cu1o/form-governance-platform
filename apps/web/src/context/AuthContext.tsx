import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest } from '../api/auth';
import { UNAUTHORIZED_EVENT } from '../lib/api-client';
import type { AuthenticatedUser } from '../types/api';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type Props = {
  children: ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Apenas limpa o estado local — usado tambem como handler de
  // UNAUTHORIZED_EVENT, entao nao pode chamar a API (um 401 na propria
  // chamada de logout dispararia o evento de novo, um loop).
  const clearSession = useCallback(() => setUser(null), []);

  const logout = useCallback(() => {
    clearSession();
    // A sessao vive em cookie HttpOnly (F16.2): o cliente ja limpou seu
    // proprio estado, mas so o servidor consegue invalidar o cookie.
    void logoutRequest().catch(() => undefined);
  }, [clearSession]);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, clearSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, clearSession);
  }, [clearSession]);

  const login = useCallback(async (identifier: string, password: string) => {
    const response = await loginRequest(identifier, password);
    setUser(response.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
