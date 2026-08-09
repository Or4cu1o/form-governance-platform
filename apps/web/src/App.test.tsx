import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
