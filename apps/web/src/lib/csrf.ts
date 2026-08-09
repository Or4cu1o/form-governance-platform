// Nomes espelhados de apps/api/src/auth/session-cookies.constants.ts — os
// dois lados nao compartilham pacote, entao o contrato e o nome literal.
const CSRF_COOKIE_NAME = 'formops_csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

// O cookie CSRF nao tem HttpOnly de proposito (esquema de submissao dupla):
// o frontend precisa le-lo aqui e ecoa-lo no header em toda rota de escrita.
export function readCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
