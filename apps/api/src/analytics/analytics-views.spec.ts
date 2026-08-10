import { PrismaClient, UnitLevel, GoalOperator, ReportStatus } from '@prisma/client';
import { AuditContextService } from '../common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../common/services/system-actor';
import { PrismaService } from '../prisma/prisma.service';

// Teste de integracao contra um Postgres real (T144, T145, T146,
// contracts/analytics-layer.md) — mesmo padrao de prisma/append-only.spec.ts
// e prisma/seed.ts: nao roda neste sandbox (rede Docker isolada,
// APP_DATABASE_URL/TABLEAU_RO_DATABASE_URL ausentes), mas e o teste correto
// contra o Postgres real de CI/dev.
//
// Escreve fixture pela role da aplicacao (APP_DATABASE_URL, mesma role que a
// API usa em runtime) dentro de um AuditContext de sistema — replica
// prisma/seed.ts, ja que o gatilho de auditoria rejeita escrita sem
// app.origin ativo (T028b). Le o resultado pela role "tableau_ro" — "como o
// BI veria" e literalmente a asserção.
describe('analytics.v_report_fact / v_absence_semantics (integration)', () => {
  const appPrisma = new PrismaClient({ datasources: { db: { url: process.env.APP_DATABASE_URL as string } } }) as unknown as PrismaService;
  const tableauRo = new PrismaClient({ datasources: { db: { url: process.env.TABLEAU_RO_DATABASE_URL as string } } });
  // Limpeza roda pela role dona ("formops") — validation_records/audit_logs
  // sao append-only para "formops_app" (20260809090000_revoke_dml_on_append_only).
  const ownerPrisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL as string } } });
  const auditContextService = new AuditContextService(appPrisma);

  const suffix = `TST${Date.now()}`;
  const fixture = { unitId: '', unit2Id: '', formTemplateId: '', formIndicatorId: '', catalogId: '', concludedReportId: '', pendingReportId: '', concludedReport2Id: '' };

  beforeAll(async () => {
    await appPrisma.$connect();
    await tableauRo.$connect();
    await ownerPrisma.$connect();

    await runAsSystemActor(auditContextService, 'Teste de integracao — camada analitica', AUDIT_ORIGIN_SEED, () =>
      auditContextService.runWithAuditContext(async (tx) => {
        const unit = await tx.unit.create({ data: { sigla: `${suffix}A`, nome: 'Unidade Teste A', level: UnitLevel.A } });
        const unit2 = await tx.unit.create({ data: { sigla: `${suffix}B`, nome: 'Unidade Teste B', level: UnitLevel.A } });
        const formTemplate = await tx.formTemplate.create({ data: { name: `Formulario ${suffix}`, units: { connect: [{ id: unit.id }, { id: unit2.id }] } } });
        const formTopic = await tx.formTopic.create({ data: { formTemplateId: formTemplate.id, title: 'Topico Teste' } });
        const catalogEntry = await tx.indicatorCatalog.create({ data: { code: `IND-${suffix}`, name: 'Indicador Teste', measurementUnit: 'unidade' } });
        const formIndicator = await tx.formIndicator.create({
          data: {
            formTopicId: formTopic.id,
            title: 'Indicador Teste',
            objective: 'Objetivo de teste',
            variableKeys: ['x'],
            formulaExpression: 'x',
            goalOperator: GoalOperator.GTE,
            goalValue: 5,
            scoreWeight: 10,
            catalogEntryId: catalogEntry.id,
          },
        });

        const dueDates = { elaborationDueDate: new Date('2026-01-06'), reviewDueDate: new Date('2026-01-08'), approvalDueDate: new Date('2026-01-10') };

        const concludedReport = await tx.reportInstance.create({
          data: { unitId: unit.id, formTemplateId: formTemplate.id, referenceMonth: new Date('2026-01-01'), status: ReportStatus.CONCLUIDO, totalScore: 8.5, ...dueDates },
        });
        const concludedReport2 = await tx.reportInstance.create({
          data: { unitId: unit2.id, formTemplateId: formTemplate.id, referenceMonth: new Date('2026-01-01'), status: ReportStatus.CONCLUIDO, totalScore: 6, ...dueDates },
        });
        const pendingReport = await tx.reportInstance.create({
          data: { unitId: unit.id, formTemplateId: formTemplate.id, referenceMonth: new Date('2026-02-01'), status: ReportStatus.PENDENTE, ...dueDates },
        });

        const snapshotBase = {
          formIndicatorId: formIndicator.id,
          snapshotTitle: formIndicator.title,
          snapshotObjective: formIndicator.objective,
          snapshotVariableKeys: formIndicator.variableKeys,
          snapshotFormulaExpression: formIndicator.formulaExpression,
          snapshotGoalOperator: formIndicator.goalOperator,
          snapshotGoalValue: formIndicator.goalValue,
          snapshotScoreWeight: formIndicator.scoreWeight,
          updatedAt: new Date(),
        };

        // T145: uma resposta com valor apurado, outra NAO_PREENCHIDO — a
        // media so deve considerar a primeira.
        await tx.indicatorResponse.create({ data: { ...snapshotBase, reportInstanceId: concludedReport.id, calculatedValue: 10, isCompliant: true } });
        await tx.indicatorResponse.create({ data: { ...snapshotBase, reportInstanceId: concludedReport2.id, calculatedValue: null } });
        // T144: resposta de relatorio NAO concluido — nunca deve aparecer em view alguma.
        await tx.indicatorResponse.create({ data: { ...snapshotBase, reportInstanceId: pendingReport.id, calculatedValue: 99 } });

        fixture.unitId = unit.id;
        fixture.unit2Id = unit2.id;
        fixture.formTemplateId = formTemplate.id;
        fixture.formIndicatorId = formIndicator.id;
        fixture.catalogId = catalogEntry.id;
        fixture.concludedReportId = concludedReport.id;
        fixture.concludedReport2Id = concludedReport2.id;
        fixture.pendingReportId = pendingReport.id;
      }),
    );
  });

  afterAll(async () => {
    await ownerPrisma.indicatorResponseVersion.deleteMany({ where: { indicatorResponse: { formIndicatorId: fixture.formIndicatorId } } });
    await ownerPrisma.indicatorResponse.deleteMany({ where: { formIndicatorId: fixture.formIndicatorId } });
    await ownerPrisma.formIndicator.deleteMany({ where: { id: fixture.formIndicatorId } });
    await ownerPrisma.reportInstance.deleteMany({ where: { formTemplateId: fixture.formTemplateId } });
    await ownerPrisma.formTopic.deleteMany({ where: { formTemplateId: fixture.formTemplateId } });
    await ownerPrisma.formTemplate.deleteMany({ where: { id: fixture.formTemplateId } });
    await ownerPrisma.indicatorCatalog.deleteMany({ where: { id: fixture.catalogId } });
    await ownerPrisma.unit.deleteMany({ where: { id: { in: [fixture.unitId, fixture.unit2Id] } } });
    await appPrisma.$disconnect();
    await tableauRo.$disconnect();
    await ownerPrisma.$disconnect();
  });

  // T144/FR-115
  test('relatorio nao concluido nao aparece em v_report_fact', async () => {
    const rows = await tableauRo.$queryRaw<Array<{ report_total_score: number | null }>>`
      SELECT "report_total_score" FROM "analytics"."v_report_fact"
      WHERE "response_id" IN (SELECT "id" FROM "public"."indicator_responses" WHERE "report_instance_id" = ${fixture.pendingReportId})
    `;
    expect(rows).toHaveLength(0);
  });

  // T145/FR-116/SC-019
  test('media sobre o recorte ignora a celula ausente no denominador', async () => {
    const rows = await tableauRo.$queryRaw<Array<{ calculated_value: string | null; absence_kind: string }>>`
      SELECT "calculated_value", "absence_kind" FROM "analytics"."v_report_fact"
      WHERE "indicator_code" = ${`IND-${suffix}`}
    `;
    expect(rows).toHaveLength(2);
    const semantics = await tableauRo.$queryRaw<Array<{ absence_kind: string; counts_in_denominator: boolean }>>`
      SELECT "absence_kind", "counts_in_denominator" FROM "analytics"."v_absence_semantics"
    `;
    const countable = new Set(semantics.filter((s) => s.counts_in_denominator).map((s) => s.absence_kind));
    const numericRows = rows.filter((r) => countable.has(r.absence_kind));
    expect(numericRows).toHaveLength(1);
    expect(Number(numericRows[0].calculated_value)).toBe(10);
  });

  // T146/FR-117
  test('meta alterada apos a emissao nao altera o que a view le do relatorio concluido', async () => {
    await runAsSystemActor(auditContextService, 'Teste de integracao — alterar meta apos emissao', AUDIT_ORIGIN_SEED, () =>
      auditContextService.runWithAuditContext((tx) => tx.formIndicator.update({ where: { id: fixture.formIndicatorId }, data: { goalValue: 999 } })),
    );

    const rows = await tableauRo.$queryRaw<Array<{ snapshot_goal_value: string }>>`
      SELECT "snapshot_goal_value" FROM "analytics"."v_report_fact"
      WHERE "response_id" IN (SELECT "id" FROM "public"."indicator_responses" WHERE "report_instance_id" = ${fixture.concludedReportId})
    `;
    expect(Number(rows[0].snapshot_goal_value)).toBe(5);
  });

  test('analytics.v_load_marker devolve uma linha com loaded_at recente', async () => {
    const rows = await tableauRo.$queryRaw<Array<{ loaded_at: Date; load_mode: string }>>`SELECT * FROM "analytics"."v_load_marker"`;
    expect(rows).toHaveLength(1);
    expect(rows[0].load_mode).toBe('NAO_MATERIALIZADO');
    expect(Date.now() - new Date(rows[0].loaded_at).getTime()).toBeLessThan(60_000);
  });
});
