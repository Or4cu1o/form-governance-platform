import { PrismaService } from './prisma.service';

// Teste de integracao contra um Postgres real (T167): falha se qualquer
// tabela auditavel ficar sem o gatilho fn_write_audit_log — a lista abaixo e
// a mesma enumerada em tasks.md (T167) e deve ser atualizada junto com
// qualquer nova migracao que adicione cobertura de auditoria.
const EXPECTED_AUDITED_TABLES = [
  'evidence_files',
  'form_indicators',
  'form_templates',
  'form_topics',
  'indicator_responses',
  'system_settings',
  'units',
  'user_unit_access',
  'users',
  'validation_records',
].sort();

describe('cobertura do gatilho de auditoria (integration)', () => {
  const prisma = new PrismaService();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('fn_write_audit_log esta associada a todas as tabelas auditaveis, nenhuma a menos', async () => {
    const rows = await prisma.$queryRaw<Array<{ event_object_table: string }>>`
      SELECT DISTINCT event_object_table
      FROM information_schema.triggers
      WHERE action_statement LIKE '%fn_write_audit_log%'
      ORDER BY event_object_table
    `;

    const auditedTables = rows.map((r) => r.event_object_table).sort();

    expect(auditedTables).toEqual(EXPECTED_AUDITED_TABLES);
  });
});
