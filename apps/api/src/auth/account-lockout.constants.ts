// T159 (FR-009, SC-017): o bloqueio por conta e o mecanismo primario — limiar
// baixo, janela mais longa. O bloqueio por endereco e so uma camada
// secundaria de defesa em profundidade — limiar bem mais alto (um endereco
// compartilhado por uma unidade inteira gera muito mais tentativas legitimas
// por minuto) e janela curta, para nao derrubar o acesso de uma unidade
// inteira por muito tempo.
export const ACCOUNT_LOCKOUT_THRESHOLD = 5;
export const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const IP_LOCKOUT_THRESHOLD = 30;
export const IP_LOCKOUT_DURATION_MS = 5 * 60 * 1000;
