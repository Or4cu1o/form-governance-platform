const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'INITIAL_ADMIN_MATRICULA',
  'INITIAL_ADMIN_EMAIL',
  'INITIAL_ADMIN_PASSWORD',
  'LDAP_CONFIG_ENCRYPTION_KEY',
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
