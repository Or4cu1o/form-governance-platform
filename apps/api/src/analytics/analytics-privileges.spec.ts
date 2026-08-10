import { PrismaClient } from '@prisma/client';

// Teste de integracao contra um Postgres real (T147, contracts/analytics-layer.md,
// secao "Acesso") — mesmo padrao de prisma/append-only.spec.ts: nao roda
// neste sandbox (rede Docker isolada, TABLEAU_RO_DATABASE_URL/APP_DATABASE_URL
// ausentes), mas e o teste correto contra o Postgres real de CI/dev
// (docker-compose up, com scripts/provision-tableau-ro.ts e
// scripts/provision-app-role.ts ja rodados).
//
// tableau_ro so pode SELECT em "analytics" (FR-118, cenario US8-4):
// INSERT/UPDATE/DELETE falham por privilegio, e a role da aplicacao NAO tem
// SELECT em "analytics" — a aplicacao nao le a propria projecao.
const ANALYTICS_VIEWS = ['v_report_fact', 'v_absence_semantics', 'v_indicator_dim', 'v_unit_dim', 'v_evidence_link', 'v_load_marker'];

describe('camada analitica: privilegios de "tableau_ro" e da role da aplicacao (integration)', () => {
  const tableauRo = new PrismaClient({ datasources: { db: { url: process.env.TABLEAU_RO_DATABASE_URL as string } } });
  const appRole = new PrismaClient({ datasources: { db: { url: process.env.APP_DATABASE_URL as string } } });

  beforeAll(async () => {
    await tableauRo.$connect();
    await appRole.$connect();
  });

  afterAll(async () => {
    await tableauRo.$disconnect();
    await appRole.$disconnect();
  });

  test.each(ANALYTICS_VIEWS)('tableau_ro consegue SELECT em analytics.%s', async (view) => {
    await expect(tableauRo.$queryRawUnsafe(`SELECT 1 FROM "analytics"."${view}" LIMIT 0`)).resolves.toBeDefined();
  });

  test('INSERT em analytics.v_report_fact como tableau_ro falha por privilegio', async () => {
    await expect(
      tableauRo.$executeRawUnsafe(
        `INSERT INTO "analytics"."v_report_fact" ("unit_id") VALUES ('00000000-0000-0000-0000-000000000000')`,
      ),
    ).rejects.toThrow(/permission denied|cannot insert/i);
  });

  test('UPDATE em analytics.v_report_fact como tableau_ro falha por privilegio', async () => {
    await expect(
      tableauRo.$executeRawUnsafe(`UPDATE "analytics"."v_report_fact" SET "unit_id" = "unit_id" WHERE 1 = 0`),
    ).rejects.toThrow(/permission denied|cannot update/i);
  });

  test('DELETE em analytics.v_report_fact como tableau_ro falha por privilegio', async () => {
    await expect(tableauRo.$executeRawUnsafe(`DELETE FROM "analytics"."v_report_fact" WHERE 1 = 0`)).rejects.toThrow(
      /permission denied|cannot delete/i,
    );
  });

  test.each(ANALYTICS_VIEWS)('a role da aplicacao (formops_app) NAO consegue SELECT em analytics.%s', async (view) => {
    await expect(appRole.$queryRawUnsafe(`SELECT 1 FROM "analytics"."${view}" LIMIT 0`)).rejects.toThrow(/permission denied/i);
  });
});
