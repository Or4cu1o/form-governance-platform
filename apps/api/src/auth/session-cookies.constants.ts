// Nomes de cookie/header do transporte de sessao (F16.2 do Master Technical
// Spec): o JWT deixa de residir em armazenamento acessivel a script.
export const ACCESS_TOKEN_COOKIE = 'formops_access_token';

// Cookie do esquema de submissao dupla anti-CSRF — deliberadamente sem
// HttpOnly, pois o frontend precisa le-lo e ecoa-lo no header abaixo.
export const CSRF_COOKIE_NAME = 'formops_csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
