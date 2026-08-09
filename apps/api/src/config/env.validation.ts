const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'INITIAL_ADMIN_MATRICULA',
  'INITIAL_ADMIN_EMAIL',
  'INITIAL_ADMIN_PASSWORD',
  // Custodia da chave de selagem (Fase 1, T005): referencia ao material —
  // nunca o material em si. Ver key-custody.service.ts (T005a).
  'SEALING_PRIVATE_KEY_PATH',
  'SEALING_KEY_ID',
  // Segredo HMAC do resolver de evidencia exposto ao BI (US8, FR-119).
  'EVIDENCE_RESOLVER_HMAC_SECRET',
  // Buckets de evidencia com ciclo de vida distinto (D7): quarentena
  // mutavel ate veredito do antivirus, imutavel com Object Lock apos.
  'S3_BUCKET_QUARANTINE',
  'S3_BUCKET_IMMUTABLE',
  // Endpoint do daemon ClamAV (T004/T050).
  'CLAMAV_HOST',
  'CLAMAV_PORT',
  // Origem(ns) explicita(s) da SPA (T171): sessao agora vive em cookie
  // (T032), e requisicao com credencial e incompativel com CORS curinga —
  // sem esta variavel nao ha modo aberto de fallback possivel.
  'CORS_ORIGIN',
  // Conexao de runtime da aplicacao pela role de privilegio minimo
  // "formops_app" (T035) — distinta de DATABASE_URL, usada so por
  // migracao/seed (role "formops", dona das tabelas). PrismaService le
  // esta variavel diretamente; sem ela a API nao teria como saber que
  // role usar e cairia de volta silenciosamente para a role dona,
  // esvaziando o REVOKE UPDATE/DELETE da migracao.
  'APP_DATABASE_URL',
] as const;

// Falha rapido na inicializacao se algum segredo/config obrigatorio nao
// estiver presente, em vez de deixar o erro estourar no primeiro uso.
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Variaveis de ambiente obrigatorias ausentes: ${missing.join(', ')}`);
  }
  return config;
}
