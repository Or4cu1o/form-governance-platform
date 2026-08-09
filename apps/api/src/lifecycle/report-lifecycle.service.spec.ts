import { BadRequestException } from '@nestjs/common';
import { GoalOperator, InheritanceState, UnitLevel } from '@prisma/client';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { FormIndicatorsService } from '../forms/form-indicators.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContextService } from '../common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../common/services/system-actor';
import { InheritanceService } from '../reports/inheritance.service';
import { ReportLifecycleService } from './report-lifecycle.service';

// Teste de integracao contra um Postgres real (nao mockado) — segue o
// padrao ja usado no restante do projeto de validar contra o banco de
// dev em vez de dublês, para pegar bugs reais de constraint/transacao.
// openPeriodForUnit agora exige um AuditContext ativo (T028b): todo o corpo
// do teste roda dentro de runAsSystemActor.
describe('ReportLifecycleService (integration)', () => {
  const prisma = new PrismaService();
  const platformSettingsService = new PlatformSettingsService(prisma);
  const auditContextService = new AuditContextService(prisma);
  const inheritanceService = new InheritanceService();
  const formIndicatorsService = new FormIndicatorsService(prisma);
  const service = new ReportLifecycleService(
    prisma,
    platformSettingsService,
    auditContextService,
    inheritanceService,
    formIndicatorsService,
  );

  let unitId: string;
  let formTemplateId: string;
  let residentIndicatorId: string;
  let volatileIndicatorId: string;

  const july2026 = new Date(Date.UTC(2026, 6, 1));
  const august2026 = new Date(Date.UTC(2026, 7, 1));

  beforeAll(async () => {
    await prisma.$connect();

    const template = await prisma.formTemplate.create({
      data: { name: 'Template Lifecycle Test' },
    });
    formTemplateId = template.id;

    const topic = await prisma.formTopic.create({
      data: { formTemplateId, title: 'Infra' },
    });

    const residentCatalogEntry = await prisma.indicatorCatalog.create({
      data: { code: `LIFECYCLE_RESIDENT_${Date.now()}`, name: 'Servidores Fisicos', measurementUnit: 'UNIDADE' },
    });
    const volatileCatalogEntry = await prisma.indicatorCatalog.create({
      data: { code: `LIFECYCLE_VOLATILE_${Date.now()}`, name: 'Uptime', measurementUnit: 'PERCENTUAL' },
    });

    const residentIndicator = await prisma.formIndicator.create({
      data: {
        formTopicId: topic.id,
        title: 'Servidores Fisicos',
        objective: 'Inventario',
        variableKeys: ['QTD'],
        formulaExpression: 'QTD',
        goalOperator: GoalOperator.GTE,
        goalValue: 0,
        isResidentState: true,
        catalogEntryId: residentCatalogEntry.id,
        scoreWeight: 5,
      },
    });
    residentIndicatorId = residentIndicator.id;

    const volatileIndicator = await prisma.formIndicator.create({
      data: {
        formTopicId: topic.id,
        title: 'Uptime',
        objective: 'Disponibilidade',
        variableKeys: ['A', 'B'],
        formulaExpression: '(A/(A+B))*100',
        goalOperator: GoalOperator.GTE,
        goalValue: 95,
        isResidentState: false,
        catalogEntryId: volatileCatalogEntry.id,
        scoreWeight: 5,
      },
    });
    volatileIndicatorId = volatileIndicator.id;

    const unit = await prisma.unit.create({
      data: { sigla: 'LIFE-TEST', nome: 'Unidade Teste Lifecycle', level: UnitLevel.A, formTemplateId },
    });
    unitId = unit.id;
    // Timeout maior que o default de 5s: sob a suite completa em paralelo
    // (varios workers Jest disputando o mesmo Postgres), as 5 chamadas
    // sequenciais deste setup podem passar do limite padrao.
  }, 20000);

  afterAll(async () => {
    await prisma.indicatorResponse.deleteMany({ where: { reportInstance: { unitId } } });
    await prisma.reportInstance.deleteMany({ where: { unitId } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.formIndicator.deleteMany({ where: { id: { in: [residentIndicatorId, volatileIndicatorId] } } });
    await prisma.formTopic.deleteMany({ where: { formTemplateId } });
    await prisma.formTemplate.delete({ where: { id: formTemplateId } });
    await prisma.$disconnect();
  });

  function openPeriodAsTestActor(unit: Parameters<typeof service.openPeriodForUnit>[0], referenceMonth: Date) {
    return runAsSystemActor(auditContextService, 'Teste de integracao — abertura de periodo', AUDIT_ORIGIN_SEED, () =>
      service.openPeriodForUnit(unit, referenceMonth),
    );
  }

  test('opens a period with correct DU due dates and empty snapshots for a unit with no history', async () => {
    const unit = await prisma.unit.findUniqueOrThrow({ where: { id: unitId } });
    const report = await openPeriodAsTestActor(unit, july2026);

    expect(report).not.toBeNull();
    expect(report!.status).toBe('PENDENTE');
    expect(report!.elaborationDueDate.toISOString().slice(0, 10)).toBe('2026-07-08');
    expect(report!.reviewDueDate.toISOString().slice(0, 10)).toBe('2026-07-10');
    expect(report!.approvalDueDate.toISOString().slice(0, 10)).toBe('2026-07-14');

    const responses = await prisma.indicatorResponse.findMany({ where: { reportInstanceId: report!.id } });
    expect(responses).toHaveLength(2);
    expect(responses.every((r) => !r.isClonedFromResident)).toBe(true);
    expect(responses.every((r) => r.inheritanceState === InheritanceState.NAO_HERDADO)).toBe(true);
    expect(responses.every((r) => r.currentVersionId !== null)).toBe(true);
  });

  test('is idempotent: calling it again for the same unit/month returns the existing instance', async () => {
    const unit = await prisma.unit.findUniqueOrThrow({ where: { id: unitId } });
    const first = await openPeriodAsTestActor(unit, july2026);
    const second = await openPeriodAsTestActor(unit, july2026);

    expect(second!.id).toBe(first!.id);
    const count = await prisma.reportInstance.count({ where: { unitId, referenceMonth: july2026 } });
    expect(count).toBe(1);
  });

  test('clones the resident-state indicator value into the next month, but not the volatile one', async () => {
    const julyReport = await prisma.reportInstance.findUniqueOrThrow({
      where: { unitId_referenceMonth: { unitId, referenceMonth: july2026 } },
    });
    await runAsSystemActor(auditContextService, 'Teste de integracao — preparacao de fixture', AUDIT_ORIGIN_SEED, () =>
      auditContextService.runWithAuditContext((tx) =>
        tx.indicatorResponse.updateMany({
          where: { reportInstanceId: julyReport.id, formIndicatorId: residentIndicatorId },
          data: { variableValues: { QTD: 42 } },
        }),
      ),
    );
    await runAsSystemActor(auditContextService, 'Teste de integracao — preparacao de fixture', AUDIT_ORIGIN_SEED, () =>
      auditContextService.runWithAuditContext((tx) =>
        tx.indicatorResponse.updateMany({
          where: { reportInstanceId: julyReport.id, formIndicatorId: volatileIndicatorId },
          data: { variableValues: { A: 10, B: 1 } },
        }),
      ),
    );

    const unit = await prisma.unit.findUniqueOrThrow({ where: { id: unitId } });
    const augustReport = await openPeriodAsTestActor(unit, august2026);

    const residentResponse = await prisma.indicatorResponse.findFirstOrThrow({
      where: { reportInstanceId: augustReport!.id, formIndicatorId: residentIndicatorId },
    });
    expect(residentResponse.isClonedFromResident).toBe(true);
    expect(residentResponse.variableValues).toEqual({ QTD: 42 });
    expect(residentResponse.inheritanceState).toBe(InheritanceState.HERDADO);

    const volatileResponse = await prisma.indicatorResponse.findFirstOrThrow({
      where: { reportInstanceId: augustReport!.id, formIndicatorId: volatileIndicatorId },
    });
    expect(volatileResponse.isClonedFromResident).toBe(false);
    expect(volatileResponse.variableValues).toEqual({});
    expect(volatileResponse.inheritanceState).toBe(InheritanceState.NAO_HERDADO);
  });

  // T081/FR-064/US4-3: instanciacao recusada quando a soma dos pesos ativos
  // do formulario nao fecha em 10,00 — o vinculo unit->template pode existir,
  // mas nenhum periodo abre a partir dele ate a pontuacao ser corrigida.
  test('rejects opening a period when the active indicator weights do not sum to 10', async () => {
    const unbalancedTemplate = await prisma.formTemplate.create({ data: { name: 'Template Desbalanceado' } });
    const unbalancedTopic = await prisma.formTopic.create({ data: { formTemplateId: unbalancedTemplate.id, title: 'Infra' } });
    const unbalancedCatalogEntry = await prisma.indicatorCatalog.create({
      data: { code: `LIFECYCLE_UNBALANCED_${Date.now()}`, name: 'Indicador Unico', measurementUnit: 'UNIDADE' },
    });
    const unbalancedIndicator = await prisma.formIndicator.create({
      data: {
        formTopicId: unbalancedTopic.id,
        title: 'Indicador Unico',
        objective: 'Teste',
        variableKeys: ['QTD'],
        formulaExpression: 'QTD',
        goalOperator: GoalOperator.GTE,
        goalValue: 0,
        catalogEntryId: unbalancedCatalogEntry.id,
        scoreWeight: 4,
      },
    });
    const unbalancedUnit = await prisma.unit.create({
      data: { sigla: 'LIFE-UNBAL', nome: 'Unidade Desbalanceada', level: UnitLevel.A, formTemplateId: unbalancedTemplate.id },
    });

    try {
      await expect(openPeriodAsTestActor(unbalancedUnit, july2026)).rejects.toThrow(BadRequestException);
      const count = await prisma.reportInstance.count({ where: { unitId: unbalancedUnit.id } });
      expect(count).toBe(0);
    } finally {
      await prisma.unit.delete({ where: { id: unbalancedUnit.id } });
      await prisma.formIndicator.delete({ where: { id: unbalancedIndicator.id } });
      await prisma.formTopic.delete({ where: { id: unbalancedTopic.id } });
      await prisma.formTemplate.delete({ where: { id: unbalancedTemplate.id } });
    }
  });
});
