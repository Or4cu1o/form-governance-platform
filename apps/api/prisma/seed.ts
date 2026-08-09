import { Prisma, PrismaClient, RoleName, UnitLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditContextService } from '../src/common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../src/common/services/system-actor';
import type { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
const auditContextService = new AuditContextService(prisma as unknown as PrismaService);

const SALT_ROUNDS = 10;
const DEV_TEST_PASSWORD = 'FormOpsTeste@2026';

const DEV_ROLE_USERS: Array<{ matricula: string; nome: string; sobrenome: string; role: RoleName }> = [
  { matricula: '10001', nome: 'Teste', sobrenome: 'Observador', role: RoleName.OBSERVADOR },
  { matricula: '10002', nome: 'Teste', sobrenome: 'Elaborador', role: RoleName.ELABORADOR },
  { matricula: '10003', nome: 'Teste', sobrenome: 'Revisor', role: RoleName.REVISOR },
  { matricula: '10004', nome: 'Teste', sobrenome: 'Aprovador', role: RoleName.APROVADOR },
  { matricula: '10005', nome: 'Teste', sobrenome: 'Administrador', role: RoleName.ADMINISTRADOR },
];

async function ensureMatrizUnit(db: Prisma.TransactionClient) {
  return db.unit.upsert({
    where: { sigla: 'MATRIZ' },
    update: {},
    create: { sigla: 'MATRIZ', nome: 'Matriz', level: UnitLevel.A },
  });
}

async function ensureInitialAdmin(db: Prisma.TransactionClient, matrizUnitId: string) {
  const matricula = process.env.INITIAL_ADMIN_MATRICULA;
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!matricula || !email || !password) {
    throw new Error(
      'INITIAL_ADMIN_MATRICULA, INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD sao obrigatorios para o seed.',
    );
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await db.user.upsert({
    where: { matricula },
    update: { email, passwordHash, role: RoleName.ADMINISTRADOR, primaryUnitId: matrizUnitId, isActive: true },
    create: {
      matricula,
      nome: 'Administrador',
      sobrenome: 'Inicial',
      email,
      passwordHash,
      role: RoleName.ADMINISTRADOR,
      primaryUnitId: matrizUnitId,
    },
  });

  console.log(`[seed] Admin inicial garantido: matricula=${matricula} email=${email}`);
}

async function ensureDevRoleUsers(db: Prisma.TransactionClient, matrizUnitId: string) {
  const passwordHash = await bcrypt.hash(DEV_TEST_PASSWORD, SALT_ROUNDS);

  for (const roleUser of DEV_ROLE_USERS) {
    const email = `${roleUser.role.toLowerCase()}@matriz.dev`;
    await db.user.upsert({
      where: { matricula: roleUser.matricula },
      update: {
        email,
        passwordHash,
        role: roleUser.role,
        primaryUnitId: matrizUnitId,
        isActive: true,
      },
      create: {
        matricula: roleUser.matricula,
        nome: roleUser.nome,
        sobrenome: roleUser.sobrenome,
        email,
        passwordHash,
        role: roleUser.role,
        primaryUnitId: matrizUnitId,
      },
    });
  }

  console.log(`[seed] ${DEV_ROLE_USERS.length} usuarios de teste (1 por role) garantidos na unidade MATRIZ.`);
  console.log(`[seed] Senha padrao dos usuarios de teste: ${DEV_TEST_PASSWORD}`);
}

async function main() {
  // ensureMatrizUnit/ensureInitialAdmin/ensureDevRoleUsers escrevem em
  // users/units — auditadas a partir de T167. Sem contexto ativo o gatilho
  // rejeitaria a escrita (T028b).
  await runAsSystemActor(auditContextService, 'Seed core — usuarios e unidade inicial', AUDIT_ORIGIN_SEED, () =>
    auditContextService.runWithAuditContext(async (tx) => {
      const matriz = await ensureMatrizUnit(tx);
      await ensureInitialAdmin(tx, matriz.id);

      if (process.env.NODE_ENV !== 'production') {
        await ensureDevRoleUsers(tx, matriz.id);
      }
    }),
  );
}

main()
  .catch((error) => {
    console.error('[seed] Falha ao executar seed core:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
