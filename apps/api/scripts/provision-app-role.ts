import { PrismaClient } from '@prisma/client';

// Complemento operacional da migracao T035 (revoke_dml_on_append_only):
// a migracao cria "formops_app" como NOLOGIN (privilegio nao e segredo,
// pode ir em SQL versionado); LOGIN e senha, por serem segredo, nunca
// entram em SQL commitado — mesmo padrao ja usado para tableau_ro (T020).
// Roda apos "prisma migrate deploy" via scripts/manage.js e
// docker-entrypoint.sh; idempotente (ALTER ROLE), seguro para reexecutar
// a cada subida caso APP_DB_PASSWORD mude.
const APP_ROLE = 'formops_app';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}`);
  return value;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

async function main(): Promise<void> {
  const password = requireEnv('APP_DB_PASSWORD');
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      `ALTER ROLE "${APP_ROLE}" WITH LOGIN PASSWORD '${escapeSqlLiteral(password)}';`,
    );
    console.log(`Role "${APP_ROLE}" provisionada com LOGIN e senha operacional atualizados.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Falha ao provisionar a role de aplicacao "${APP_ROLE}":`, error);
  process.exit(1);
});
