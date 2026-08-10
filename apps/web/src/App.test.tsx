import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    // AuthProvider sempre pergunta GET /auth/me no mount (cookie HttpOnly nao
    // e legivel pelo JS) — sem esse stub o teste faria uma chamada de rede real.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem sessao')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('redirects an unauthenticated visitor to the login screen', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('renders the login form directly when navigating to /login', async () => {
    window.history.pushState({}, '', '/login');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('renders a 404 page for an unknown route', async () => {
    window.history.pushState({}, '', '/rota-inexistente');
    render(<App />);
    expect(await screen.findByText('404')).toBeInTheDocument();
  });

  // T142/FR-102: /verificar/:codigo e publica — nunca redireciona para o
  // login, mesmo sem nenhuma sessao ativa (o fetch global esta stubado
  // para sempre rejeitar, simulando exatamente essa ausencia de sessao).
  it('renders /verificar/:codigo without redirecting to login, even with no active session', async () => {
    window.history.pushState({}, '', '/verificar/ABCD-2345-EFGH-6789-C');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Verificação pública de selo')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});
