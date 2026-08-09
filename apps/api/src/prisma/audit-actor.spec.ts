import { GoalOperator, UnitLevel } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AuditContextService } from '../common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../common/services/system-actor';

// Teste de integracao contra um Postgres real (T166): prova que o gatilho
// fn_write_audit_log (migration 20260808120500) rejeita qualquer escrita em
// tabela auditada que nao passe por AuditContextService — nunca grava um
// audit_logs anonimo em silencio (Principio I, FR-071).
describe('escrita sem contexto de auditoria (integration)', () => {
  const prisma = new PrismaService();
  const auditContextService = new AuditContextService(prisma);

  let unitId: string;
  let formTemplateId: string;
  let indicatorId: string;
  let reportInstanceId: string;
  let indicatorResponseId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const template = await prisma.formTemplate.create({ data: { name: 'Template Audit Actor Test' } });
    formTemplateId = template.id;

    const topic = await prisma.formTopic.create({ data: { formTemplateId, title: 'Infra' } });

    const catalogEntry = await prisma.indicatorCatalog.create({
      data: { code: `AUDIT_ACTOR_${Date.now()}`, name: 'Indicador Teste', measurementUnit: 'UNIDADE' },
    });

    const indicator = await prisma.formIndicator.create({
      data: {
        formTopicId: topic.id,
        title: 'Indicador Teste',
        objective: 'Teste',
        variableKeys: ['A'],
        formulaExpression: 'A',
        goalOperator: GoalOperator.GTE,
        goalValue: 0,
        catalogEntryId: catalogEntry.id,
      },
    });
    indicatorId = indicator.id;

    const unit = await prisma.unit.create({
      data: { sigla: 'AUDIT-ACTOR', nome: 'Unidade Teste Audit Actor', level: UnitLevel.A, formTemplateId },
    });
    unitId = unit.id;

    // Cria o ReportInstance e o IndicatorResponse iniciais atraves do
    // proprio mecanismo em teste, ja que indicator_responses e auditada:
    // uma escrita sem contexto aqui ja falharia o setup.
    const created = await runAsSystemActor(
      auditContextService,
      'Teste de integracao — fixture audit-actor',
      AUDIT_ORIGIN_SEED,
      () =>
        auditContextService.runWithAuditContext(async (tx) => {
          const reportInstance = await tx.reportInstance.create({
            data: {
              unitId,
              formTemplateId,
              referenceMonth: new Date(Date.UTC(2026, 6, 1)),
              status: 'PENDENTE',
              elaborationDueDate: new Date(Date.UTC(2026, 6, 8)),
              reviewDueDate: new Date(Date.UTC(2026, 6, 10)),
              approvalDueDate: new Date(Date.UTC(2026, 6, 14)),
            },
          });
          const response = await tx.indicatorResponse.create({
            data: {
              reportInstanceId: reportInstance.id,
              formIndicatorId: indicatorId,
              snapshotTitle: indicator.title,
              snapshotObjective: indicator.objective,
              snapshotVariableKeys: indicator.variableKeys,
              snapshotFormulaExpression: indicator.formulaExpression,
              snapshotGoalOperator: indicator.goalOperator,
              snapshotGoalValue: indicator.goalValue,
              snapshotScoreWeight: indicator.scoreWeight,
              variableValues: {},
              updatedAt: new Date(),
            },
          });
          return { reportInstance, response };
        }),
    );
    reportInstanceId = created.reportInstance.id;
    indicatorResponseId = created.response.id;
  }, 20000);

  afterAll(async () => {
    await prisma.indicatorResponse.deleteMany({ where: { reportInstanceId } });
    await prisma.reportInstance.deleteMany({ where: { id: reportInstanceId } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.formIndicator.deleteMany({ where: { id: indicatorId } });
    await prisma.formTopic.deleteMany({ where: { formTemplateId } });
    await prisma.formTemplate.delete({ where: { id: formTemplateId } });
    await prisma.$disconnect();
  });

  test('a plain write to an audited table without AuditContextService is rejected, never recorded anonymously', async () => {
    await expect(
      prisma.indicatorResponse.update({
        where: { id: indicatorResponseId },
        data: { variableValues: { A: 1 } },
      }),
    ).rejects.toThrow(/app\.origin/);

    const auditRows = await prisma.auditLog.findMany({
      where: { tableName: 'indicator_responses', recordId: indicatorResponseId, action: 'UPDATE' },
    });
    expect(auditRows).toHaveLength(0);
  });

  test('the same write succeeds and is recorded once routed through AuditContextService', async () => {
    await runAsSystemActor(
      auditContextService,
      'Teste de integracao — escrita autorizada',
      AUDIT_ORIGIN_SEED,
      () =>
        auditContextService.runWithAuditContext((tx) =>
          tx.indicatorResponse.update({
            where: { id: indicatorResponseId },
            data: { variableValues: { A: 2 } },
          }),
        ),
    );

    const auditRows = await prisma.auditLog.findMany({
      where: { tableName: 'indicator_responses', recordId: indicatorResponseId, action: 'UPDATE' },
    });
    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows[0].origin).toBe(AUDIT_ORIGIN_SEED);
    expect(auditRows[0].userId).toBeNull();
    expect(auditRows[0].actorNameSnapshot).toContain('Sistema');
  });
});
