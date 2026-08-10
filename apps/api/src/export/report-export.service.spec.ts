import { NotFoundException } from '@nestjs/common';
import { GoalOperator, IndicatorValidationStatus, ReportStatus, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AccessLogService } from '../audit/access-log.service';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { SealService } from '../sealing/seal.service';
import { PdfService } from './pdf.service';
import { PlatformSettingsService } from './platform-settings.service';
import { ReportExportService } from './report-export.service';

describe('ReportExportService', () => {
  let service: ReportExportService;
  let findUniqueMock: jest.Mock;
  let assertReadAccessMock: jest.Mock;
  let getSettingsMock: jest.Mock;
  let prepareSealMock: jest.Mock;
  let persistSealMock: jest.Mock;
  let pdfRenderMock: jest.Mock;
  let recordAccessLogMock: jest.Mock;

  const user: AuthenticatedUser = {
    id: 'aprovador-1',
    matricula: '10004',
    nome: 'Ana',
    sobrenome: 'Aprovadora',
    email: 'aprovador@formops.local',
    role: RoleName.APROVADOR,
    primaryUnitId: 'unit-matriz',
  };

  function buildReport(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'report-1',
      unitId: 'unit-1',
      unit: { id: 'unit-1', sigla: 'FIL01', nome: 'Filial Um' },
      referenceMonth: new Date('2026-07-01T00:00:00.000Z'),
      status: ReportStatus.CONCLUIDO,
      reprovalCount: 0,
      slaExtensionDueDate: null,
      submittedForReviewAt: null,
      submittedForApprovalAt: null,
      concludedAt: new Date('2026-07-10T00:00:00.000Z'),
      totalScore: null,
      indicatorScore: null,
      slaDeflatorApplied: null,
      indicatorResponses: [
        {
          formIndicatorId: 'indicator-1',
          snapshotTitle: 'Chamados: Backlog',
          snapshotObjective: 'Medir backlog',
          variableValues: { CA: 10, CB: 1 },
          calculatedValue: 10,
          snapshotGoalOperator: GoalOperator.LTE,
          snapshotGoalValue: 5,
          snapshotScoreWeight: 2,
          isCompliant: false,
          validationStatus: IndicatorValidationStatus.APROVADO,
          validationRecords: [
            {
              createdAt: new Date('2026-07-09T00:00:00.000Z'),
              aprovadorUser: {
                nome: 'Ana',
                sobrenome: 'Aprovadora',
                role: RoleName.APROVADOR,
                jobTitle: 'Gerente de Governanca de Tecnologia da Informacao',
                primaryUnit: { sigla: 'MATRIZ' },
              },
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    findUniqueMock = jest.fn();
    assertReadAccessMock = jest.fn();
    getSettingsMock = jest.fn().mockResolvedValue({ exportNamingPattern: '{SIGLA_UNIDADE}_{DATA_ISO}' });
    prepareSealMock = jest
      .fn()
      .mockReturnValue({ contentDigest: 'digest-abc', signature: 'sig-abc', keyId: 'seal-2026-01', verificationCode: 'ABCD2345EFGH6789C' });
    persistSealMock = jest.fn().mockResolvedValue({ artifactDigest: 'artifact-digest-abc' });
    pdfRenderMock = jest.fn().mockResolvedValue(Buffer.from('%PDF-fake'));
    recordAccessLogMock = jest.fn().mockResolvedValue({});

    const prisma = { reportInstance: { findUnique: findUniqueMock } } as unknown as PrismaService;
    const unitAccessService = { assertReadAccess: assertReadAccessMock } as unknown as UnitAccessService;
    const platformSettingsService = { getSettings: getSettingsMock } as unknown as PlatformSettingsService;
    const sealService = { prepareSeal: prepareSealMock, persistSeal: persistSealMock } as unknown as SealService;
    const pdfService = { render: pdfRenderMock } as unknown as PdfService;
    const accessLogService = { record: recordAccessLogMock } as unknown as AccessLogService;

    service = new ReportExportService(
      prisma,
      unitAccessService,
      platformSettingsService,
      sealService,
      pdfService,
      accessLogService,
    );
  });

  test('throws NotFoundException when the report does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(service.export('missing', 'json', user)).rejects.toThrow(NotFoundException);
  });

  test('enforces unit read access before exporting', async () => {
    findUniqueMock.mockResolvedValue(buildReport());

    await service.export('report-1', 'json', user);

    expect(assertReadAccessMock).toHaveBeenCalledWith('unit-1', user);
  });

  test('builds a JSON export with report, indicadores and rodape sections', async () => {
    findUniqueMock.mockResolvedValue(buildReport());

    const result = await service.export('report-1', 'json', user);

    expect(result.contentType).toBe('application/json');
    expect(result.filename).toMatch(/^FIL01_\d{4}-\d{2}-\d{2}\.json$/);
    const payload = JSON.parse(result.body as string);
    expect(payload.report.unidadeSigla).toBe('FIL01');
    expect(payload.indicadores).toHaveLength(1);
    expect(payload.rodape.veredictoFinal).toBe('Aprovado');
    expect(payload.rodape.aprovadorResponsavel).toEqual({
      nome: 'Ana',
      sobrenome: 'Aprovadora',
      cargo: 'Gerente de Governanca de Tecnologia da Informacao',
      unidade: 'MATRIZ',
    });
  });

  test('omits cargo from aprovadorResponsavel when the approver has no jobTitle set (T169)', async () => {
    findUniqueMock.mockResolvedValue(
      buildReport({
        indicatorResponses: [
          {
            formIndicatorId: 'indicator-1',
            snapshotTitle: 'Chamados: Backlog',
            snapshotObjective: 'Medir backlog',
            variableValues: { CA: 10, CB: 1 },
            calculatedValue: 10,
            snapshotGoalOperator: GoalOperator.LTE,
            snapshotGoalValue: 5,
            snapshotScoreWeight: 2,
            isCompliant: false,
            validationStatus: IndicatorValidationStatus.APROVADO,
            validationRecords: [
              {
                createdAt: new Date('2026-07-09T00:00:00.000Z'),
                aprovadorUser: {
                  nome: 'Ana',
                  sobrenome: 'Aprovadora',
                  role: RoleName.APROVADOR,
                  jobTitle: null,
                  primaryUnit: { sigla: 'MATRIZ' },
                },
              },
            ],
          },
        ],
      }),
    );

    const result = await service.export('report-1', 'json', user);

    const payload = JSON.parse(result.body as string);
    expect(payload.rodape.aprovadorResponsavel).toEqual({
      nome: 'Ana',
      sobrenome: 'Aprovadora',
      unidade: 'MATRIZ',
    });
    expect(payload.rodape.aprovadorResponsavel).not.toHaveProperty('cargo');
  });

  test('builds a CSV export with header, indicator rows and footer', async () => {
    findUniqueMock.mockResolvedValue(buildReport());

    const result = await service.export('report-1', 'csv', user);

    expect(result.contentType).toBe('text/csv');
    expect(result.filename).toMatch(/^FIL01_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.body).toContain('Chamados: Backlog');
    expect(result.body).toContain('Aprovado');
  });

  test('flags the veredicto as "reprovado pela Matriz" when the report bounced back from approval', async () => {
    findUniqueMock.mockResolvedValue(
      buildReport({ status: ReportStatus.EM_REVISAO, reprovalCount: 1, concludedAt: null }),
    );

    const result = await service.export('report-1', 'json', user);

    const payload = JSON.parse(result.body as string);
    expect(payload.rodape.veredictoFinal).toBe('Em revisao (reprovado pela Matriz)');
  });

  test('reports no aprovadorResponsavel when no indicator has been validated yet', async () => {
    findUniqueMock.mockResolvedValue(
      buildReport({
        indicatorResponses: [
          {
            formIndicatorId: 'indicator-1',
            snapshotTitle: 'Chamados: Backlog',
            snapshotObjective: 'Medir backlog',
            variableValues: {},
            calculatedValue: null,
            snapshotGoalOperator: GoalOperator.LTE,
            snapshotGoalValue: 5,
            snapshotScoreWeight: 2,
            isCompliant: null,
            validationStatus: IndicatorValidationStatus.PENDENTE_VALIDACAO,
            validationRecords: [],
          },
        ],
      }),
    );

    const result = await service.export('report-1', 'json', user);

    const payload = JSON.parse(result.body as string);
    expect(payload.rodape.aprovadorResponsavel).toBeNull();
  });

  // FR-097/FR-098: todo artefato recebe selo, inclusive PDF; os tres
  // formatos do mesmo recorte usam o MESMO contentDigest preparado (a
  // mesma chamada a prepareSeal serve para os tres, pois o envelope so
  // depende do dado, nunca do formato).
  test('seals every format (csv, json, pdf) and returns the seal metadata to the caller', async () => {
    findUniqueMock.mockResolvedValue(buildReport());

    const jsonResult = await service.export('report-1', 'json', user);
    const csvResult = await service.export('report-1', 'csv', user);
    const pdfResult = await service.export('report-1', 'pdf', user);

    expect(jsonResult.seal.verificationCode).toBe('ABCD2345EFGH6789C');
    expect(csvResult.seal.artifactDigest).toBe('artifact-digest-abc');
    expect(pdfResult.contentType).toBe('application/pdf');
    expect(pdfResult.body).toEqual(Buffer.from('%PDF-fake'));
    expect(pdfRenderMock).toHaveBeenCalledTimes(1);
    expect(persistSealMock).toHaveBeenCalledTimes(3);
  });

  // FR-097/US7-8: relatorio ainda nao concluido (parcial) tambem recebe
  // selo — nenhuma excecao, nenhum bloqueio.
  test('seals a partial (not-yet-concluded) report without throwing', async () => {
    findUniqueMock.mockResolvedValue(buildReport({ status: ReportStatus.PENDENTE, concludedAt: null }));

    await service.export('report-1', 'json', user);

    expect(persistSealMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isPartial: true }),
    );
  });

  test('records an AccessLog entry of type EXPORTACAO for every export', async () => {
    findUniqueMock.mockResolvedValue(buildReport());

    await service.export('report-1', 'json', user);

    expect(recordAccessLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ scopeUnitIds: ['unit-1'], resultVolume: 1 }),
    );
  });
});
