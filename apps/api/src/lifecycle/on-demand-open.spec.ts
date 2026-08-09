import { BadRequestException } from '@nestjs/common';
import { GoalOperator, RoleName, UnitLevel } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuditContextService } from '../common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../common/services/system-actor';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { FormIndicatorsService } from '../forms/form-indicators.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { InheritanceService } from '../reports/inheritance.service';
import { ReportInstancesController } from '../reports/report-instances.controller';
import { ReportInstancesService } from '../reports/report-instances.service';
import { ReportSubmissionService } from '../reports/report-submission.service';
import { ReportLifecycleService } from './report-lifecycle.service';

// T045a — a idempotencia de openPeriodForUnit ja esta provada em
// report-lifecycle.service.spec.ts:98-99, chamando o service diretamente.
// Este teste de integracao (Postgres real, mesma limitacao de sandbox das
// demais suites de integracao ja documentadas) prova o MESMO comportamento
// pelo caminho real que o elaborador usa: POST /report-instances/start-current,
// atravessando o controller e os services reais (nao mockados) — unidade
// inativa, unidade sem formulario e segunda chamada idempotente (FR-011,
// FR-012).
describe('POST /report-instances/start-current (abertura sob demanda, integration)', () => {
  const prisma = new PrismaService();
  const auditContextService = new AuditContextService(prisma);
  const platformSettingsService = new PlatformSettingsService(prisma, auditContextService);
  const inheritanceService = new InheritanceService();
  const formIndicatorsService = new FormIndicatorsService(prisma, auditContextService);
  const reportLifecycleService = new ReportLifecycleService(
    prisma,
    platformSettingsService,
    auditContextService,
    inheritanceService,
    formIndicatorsService,
  );
  // Nao usados pelo caminho exercitado aqui (startCurrentPeriodForElaborador
  // nao le acesso por unidade nem envia notificacao) — presentes so para
  // satisfazer o construtor real do service.
  const unitAccessService = {} as UnitAccessService;
  const notificationsService = {} as NotificationsService;
  const reportSubmissionService = new ReportSubmissionService();
  const reportInstancesService = new ReportInstancesService(
    prisma,
    unitAccessService,
    notificationsService,
    reportLifecycleService,
    auditContextService,
    reportSubmissionService,
  );
  const controller = new ReportInstancesController(reportInstancesService);

  let formTemplateId: string;
  let activeUnitId: string;
  let inactiveUnitId: string;
  let unitWithoutFormId: string;

  function elaboradorFor(unitId: string): AuthenticatedUser {
    return {
      id: 'on-demand-elaborador',
      matricula: '99999',
      nome: 'Elza',
      sobrenome: 'Elaboradora',
      email: 'ondemand@formops.local',
      role: RoleName.ELABORADOR,
      primaryUnitId: unitId,
    };
  }

  beforeAll(async () => {
    await prisma.$connect();
    const template = await prisma.formTemplate.create({ data: { name: 'Template On-Demand Open Test' } });
    formTemplateId = template.id;

    // FR-053/T086: instanciar relatorio exige soma de pesos ativos = 10 —
    // um unico indicador com peso 10 mantem o template balanceado.
    const topic = await prisma.formTopic.create({ data: { formTemplateId, title: 'Infra' } });
    const catalogEntry = await prisma.indicatorCatalog.create({
      data: { code: `ODO_${Date.now()}`, name: 'Indicador On-Demand', measurementUnit: 'UNIDADE' },
    });
    await prisma.formIndicator.create({
      data: {
        formTopicId: topic.id,
        title: 'Indicador On-Demand',
        objective: 'Teste',
        variableKeys: ['QTD'],
        formulaExpression: 'QTD',
        goalOperator: GoalOperator.GTE,
        goalValue: 0,
        catalogEntryId: catalogEntry.id,
        scoreWeight: 10,
      },
    });

    const activeUnit = await prisma.unit.create({
      data: { sigla: `ODO-ATIVA-${Date.now()}`, nome: 'Unidade Ativa', level: UnitLevel.A, formTemplateId, isActive: true },
    });
    activeUnitId = activeUnit.id;
    const inactiveUnit = await prisma.unit.create({
      data: { sigla: `ODO-INATIVA-${Date.now()}`, nome: 'Unidade Inativa', level: UnitLevel.A, formTemplateId, isActive: false },
    });
    inactiveUnitId = inactiveUnit.id;
    const unitWithoutForm = await prisma.unit.create({
      data: { sigla: `ODO-SEMFORM-${Date.now()}`, nome: 'Unidade Sem Formulario', level: UnitLevel.A, isActive: true },
    });
    unitWithoutFormId = unitWithoutForm.id;
  }, 20000);

  afterAll(async () => {
    await prisma.indicatorResponse.deleteMany({ where: { reportInstance: { unitId: activeUnitId } } });
    await prisma.reportInstance.deleteMany({ where: { unitId: activeUnitId } });
    await prisma.unit.deleteMany({ where: { id: { in: [activeUnitId, inactiveUnitId, unitWithoutFormId] } } });
    await prisma.formIndicator.deleteMany({ where: { formTopic: { formTemplateId } } });
    await prisma.formTopic.deleteMany({ where: { formTemplateId } });
    await prisma.formTemplate.delete({ where: { id: formTemplateId } });
    await prisma.$disconnect();
  });

  function startCurrentAsTestActor(user: AuthenticatedUser) {
    return runAsSystemActor(auditContextService, 'Teste de integracao — abertura sob demanda', AUDIT_ORIGIN_SEED, () =>
      controller.startCurrent(user),
    );
  }

  test('throws BadRequestException when the caller unit is inactive (FR-011)', async () => {
    await expect(startCurrentAsTestActor(elaboradorFor(inactiveUnitId))).rejects.toThrow(BadRequestException);
  });

  test('throws BadRequestException when the caller unit has no form template (FR-011)', async () => {
    await expect(startCurrentAsTestActor(elaboradorFor(unitWithoutFormId))).rejects.toThrow(BadRequestException);
  });

  test('is idempotent through the controller: the second call for the same unit/month returns the same instance (FR-012)', async () => {
    const first = await startCurrentAsTestActor(elaboradorFor(activeUnitId));
    const second = await startCurrentAsTestActor(elaboradorFor(activeUnitId));

    expect(second!.id).toBe(first!.id);
    const count = await prisma.reportInstance.count({ where: { unitId: activeUnitId } });
    expect(count).toBe(1);
  });
});
