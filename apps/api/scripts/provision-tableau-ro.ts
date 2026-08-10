import { PrismaClient } from '@prisma/client';

// Complemento operacional de T020/T151 (mesmo padrao de provision-app-role.ts,
// T035): a migracao ja criou a role "tableau_ro" (NOLOGIN) e os GRANT SELECT
// em "analytics", mas LOGIN e senha sao segredo e por isso ficam fora do SQL
// versionado. Roda apos "prisma migrate deploy" via scripts/manage.js e
// docker-entrypoint.sh; idempotente (ALTER ROLE), seguro para reexecutar a
// cada subida caso TABLEAU_RO_DB_PASSWORD mude.
const ROLE = 'tableau_ro';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}`);
  return value;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

async function main(): Promise<void> {
  const password = requireEnv('TABLEAU_RO_DB_PASSWORD');
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`ALTER ROLE "${ROLE}" WITH LOGIN PASSWORD '${escapeSqlLiteral(password)}';`);
    console.log(`Role "${ROLE}" provisionada com LOGIN e senha operacional atualizados.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Falha ao provisionar a role "${ROLE}":`, error);
  process.exit(1);
});
