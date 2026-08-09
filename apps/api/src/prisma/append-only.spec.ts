import { PrismaService } from './prisma.service';

// Teste de integracao contra um Postgres real (T035/T036, quickstart V5):
// PrismaService conecta com APP_DATABASE_URL — a role restrita "formops_app"
// (T035), nunca a role de migracao/dona das tabelas — entao este e
// literalmente "com a credencial da aplicacao" exigido pelo enunciado. A
// checagem de privilegio do Postgres roda antes da tabela ser varrida, entao
// nao e preciso semear linha alguma: WHERE 1 = 0 e suficiente para provar
// a recusa sem tocar dado real. "A tentativa fica registrada" (FR-047,
// FR-070) e garantia do proprio Postgres — todo erro de permissao negada
// entra no log do servidor por padrao, nao ha caminho de aplicacao para
// interceptar uma tentativa que a contornou por completo.
const APPEND_ONLY_TABLES = [
  { schema: 'public', table: 'indicator_response_version' },
  { schema: 'public', table: 'validation_records' },
  { schema: 'audit', table: 'audit_logs' },
  { schema: 'audit', table: 'access_log' },
  { schema: 'public', table: 'export_seal' },
  { schema: 'public', table: 'export_seal_revocation' },
];

describe('append-only: UPDATE/DELETE revogados na role de aplicacao (integration)', () => {
  const prisma = new PrismaService();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test.each(APPEND_ONLY_TABLES)(
    'UPDATE em $schema.$table falha por privilegio, com a credencial da aplicacao',
    async ({ schema, table }) => {
      await expect(
        prisma.$executeRawUnsafe(`UPDATE "${schema}"."${table}" SET "id" = "id" WHERE 1 = 0`),
      ).rejects.toThrow(/permission denied/i);
    },
  );

  test.each(APPEND_ONLY_TABLES)(
    'DELETE em $schema.$table falha por privilegio, com a credencial da aplicacao',
    async ({ schema, table }) => {
      await expect(prisma.$executeRawUnsafe(`DELETE FROM "${schema}"."${table}" WHERE 1 = 0`)).rejects.toThrow(
        /permission denied/i,
      );
    },
  );
});
