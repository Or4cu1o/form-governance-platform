import { IndicatorValidationStatus, ReportStatus, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuditContextService } from '../common/services/audit-context.service';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { ValidationService } from '../validation/validation.service';
import { IndicatorResponsesService } from './indicator-responses.service';
import { ReportSubmissionService } from './report-submission.service';

// T070/US3-7 (quickstart V6): alterar peso, meta ou formula no catalogo
// (FormIndicator) depois que um periodo foi aberto NAO PODE alterar a nota
// ja emitida — a composicao usa exclusivamente os campos snapshot* que
// report-lifecycle.service.ts grava uma unica vez, na abertura do periodo
// (nunca reescritos depois, ver grep de snapshotScoreWeight/snapshotGoalValue/
// snapshotFormulaExpression no restante do backend). Os fixtures abaixo
// OMITEM deliberadamente qualquer relacao `formIndicator` no retorno
// mockado do Prisma: se a implementacao algum dia regredisse para ler a
// definicao ao vivo do indicador, o acesso a um campo inexistente faria o
// teste quebrar por excecao, nao aprovar silenciosamente um valor errado.
describe('congelamento de nota (US3-7)', () => {
  const elaborador: AuthenticatedUser = {
    id: 'elaborador-1',
    matricula: '001',
    nome: 'Ana',
    sobrenome: 'Elaboradora',
    email: 'ana@formops.local',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
  };

  test('updateValues recalcula um indicador usando apenas os campos snapshot congelados na abertura do periodo', async () => {
    const findUniqueMock = jest.fn().mockResolvedValue({
      id: 'response-1',
      // Snapshot congelado quando o periodo foi aberto — deliberadamente
      // diferente do que um FormIndicator "vivo" teria se o catalogo tivesse
      // sido alterado depois (ex.: meta apertada de 99 para 99.5).
      snapshotVariableKeys: ['uptimeMinutos', 'totalMinutos'],
      snapshotFormulaExpression: '(uptimeMinutos / totalMinutos) * 100',
      snapshotGoalOperator: 'GTE',
      snapshotGoalValue: 99,
      variableValues: {},
      currentVersionId: 'version-0',
      validationStatus: IndicatorValidationStatus.PENDENTE_VALIDACAO,
      criticalAnalysis: null,
      actionPlan: null,
      reportInstance: { status: ReportStatus.PENDENTE, unitId: 'unit-1' },
    });
    const versionCreateMock = jest.fn().mockResolvedValue({ id: 'version-1' });
    const responseUpdateMock = jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data));

    const prisma = { indicatorResponse: { findUnique: findUniqueMock } } as unknown as PrismaService;
    const auditContextService = {
      runWithAuditContext: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({
          indicatorResponseVersion: { create: versionCreateMock },
          indicatorResponse: { update: responseUpdateMock },
        }),
      ),
    } as unknown as AuditContextService;
    const unitAccessService = {} as unknown as UnitAccessService;

    const service = new IndicatorResponsesService(prisma, auditContextService, unitAccessService);

    const result = await service.updateValues('response-1', elaborador, {
      expectedVersionId: 'version-0',
      variableValues: { uptimeMinutos: 1430, totalMinutos: 1440 }, // 99.3055...%
    } as never);

    // 99.3055...% >= 99 (meta do snapshot). Se a implementacao tivesse lido
    // uma meta "ao vivo" de 99.5, isCompliant teria de ser false.
    expect(result.isCompliant).toBe(true);
    expect(result.calculatedValue).toBeCloseTo(99.305, 2);
  });

  test('finalizeReport soma exclusivamente snapshotScoreWeight, sem jamais consultar a definicao viva do FormIndicator', async () => {
    const findUniqueReportMock = jest.fn().mockResolvedValue({
      id: 'report-1',
      status: ReportStatus.PENDENTE_APROVACAO,
      approvalDueDate: new Date('2026-08-20T00:00:00.000Z'),
      reprovalCount: 0,
      unit: { id: 'unit-1' },
      indicatorResponses: [
        // snapshotScoreWeight=6 e o peso que o catalogo tinha na abertura do
        // periodo. Ainda que o FormIndicator vivo tenha sido alterado para
        // outro peso depois, esta linha (congelada) nunca e reescrita.
        { isCompliant: true, validationStatus: IndicatorValidationStatus.APROVADO, snapshotScoreWeight: 6 },
      ],
    });
    const updateReportMock = jest
      .fn()
      .mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'report-1', ...(data as object) }));

    const prisma = {
      reportInstance: { findUnique: findUniqueReportMock },
      reportSubmission: {
        findMany: jest.fn().mockResolvedValue([
          { stage: 'ELABORACAO', wasOnTime: true, submittedAt: new Date('2026-08-05T00:00:00.000Z') },
          { stage: 'REVISAO', wasOnTime: true, submittedAt: new Date('2026-08-10T00:00:00.000Z') },
        ]),
      },
    } as unknown as PrismaService;
    const auditContextService = {
      runWithAuditContext: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({ reportInstance: { update: updateReportMock }, indicatorResponse: { updateMany: jest.fn() } }),
      ),
    } as unknown as AuditContextService;
    const platformSettingsService = {
      getSettings: jest.fn().mockResolvedValue({ slaDeflatorScore: 2, slaReprovalExtensionDays: 2 }),
    } as unknown as PlatformSettingsService;
    const s3Service = {} as unknown as S3Service;
    const notificationsService = {
      notifyReportConcluded: jest.fn(),
      notifyReportReproved: jest.fn(),
    } as unknown as NotificationsService;
    const reportSubmissionService = { recordSubmission: jest.fn() } as unknown as ReportSubmissionService;
    const aprovador: AuthenticatedUser = { ...elaborador, id: 'aprovador-1', role: RoleName.APROVADOR };

    const service = new ValidationService(
      prisma,
      s3Service,
      notificationsService,
      platformSettingsService,
      auditContextService,
      reportSubmissionService,
    );

    const result = await service.finalizeReport('report-1', aprovador);

    expect(result.indicatorScore).toBe(6);
    expect(result.totalScore).toBe(6);
  });
});
