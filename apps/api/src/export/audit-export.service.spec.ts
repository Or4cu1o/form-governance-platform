import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AccessLogService } from '../audit/access-log.service';
import { AuditQueryService } from '../audit/audit-query.service';
import { AuditExportDto } from '../audit/dto/audit-export.dto';
import { SealService } from '../sealing/seal.service';
import { AuditExportService } from './audit-export.service';
import { PlatformSettingsService } from './platform-settings.service';

describe('AuditExportService', () => {
  let service: AuditExportService;
  let queryMock: jest.Mock;
  let getFiltersMock: jest.Mock;
  let getSettingsMock: jest.Mock;
  let prepareSealMock: jest.Mock;
  let persistSealMock: jest.Mock;
  let recordAccessLogMock: jest.Mock;

  const user: AuthenticatedUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Ana',
    sobrenome: 'Auditora',
    email: 'ana@formops.local',
    role: RoleName.APROVADOR,
    primaryUnitId: 'unit-1',
  };

  function baseDto(overrides: Partial<AuditExportDto> = {}): AuditExportDto {
    return { periodFrom: '2026-01', periodTo: '2026-06', format: 'CSV', ...overrides } as AuditExportDto;
  }

  const columns = [{ indicatorCode: 'IND-01', measurementUnit: 'unidades' }];

  beforeEach(() => {
    getFiltersMock = jest.fn().mockResolvedValue({
      units: [],
      levels: ['A'],
      indicatorCodes: [{ code: 'IND-01', name: 'Indicador 1', measurementUnit: 'unidades' }],
    });
    getSettingsMock = jest.fn().mockResolvedValue({ exportNamingPattern: '{SIGLA_UNIDADE}_{DATA_ISO}' });
    prepareSealMock = jest
      .fn()
      .mockReturnValue({ contentDigest: 'digest', signature: 'sig', keyId: 'seal-2026-01', verificationCode: 'ABCD2345EFGH6789C' });
    persistSealMock = jest.fn().mockResolvedValue({ artifactDigest: 'artifact-digest' });
    recordAccessLogMock = jest.fn().mockResolvedValue({});
    queryMock = jest.fn().mockResolvedValue({
      columns,
      rows: [
        { unitId: 'unit-A', referencePeriod: '2026-06', cells: { 'IND-01': { kind: 'VALOR', value: 10, isOutlier: false } } },
        { unitId: 'unit-B', referencePeriod: '2026-06', cells: { 'IND-01': { kind: 'NA_FORA_DO_NIVEL', value: null, isOutlier: false } } },
      ],
      aggregations: [],
      absenceLegend: { NA_FORA_DO_NIVEL: 'Fora do nivel.' },
      isEmptyResult: false,
      nextCursor: null,
      countMode: 'EXATA',
      count: 2,
      outlierRule: 'IQR',
    });

    const auditQueryService = { query: queryMock, getFilters: getFiltersMock } as unknown as AuditQueryService;
    const platformSettingsService = { getSettings: getSettingsMock } as unknown as PlatformSettingsService;
    const sealService = { prepareSeal: prepareSealMock, persistSeal: persistSealMock } as unknown as SealService;
    const accessLogService = { record: recordAccessLogMock } as unknown as AccessLogService;

    service = new AuditExportService(auditQueryService, platformSettingsService, sealService, accessLogService);
  });

  // T128/FR-107: filtros na integra (inclusive os que nao retornaram
  // dados), modo, colunas, escopo e autoria acompanham a exportacao.
  it('embeds the full filters, mode, columns, scope and authorship in the exported CSV', async () => {
    const dto = baseDto({ statuses: ['CONCLUIDO'] as never, unitIds: ['unit-A'] });

    const result = await service.export(dto, user);

    expect(result.body).toContain('CONCLUIDO');
    expect(result.body).toContain('BASICO');
    expect(result.body).toContain('unit-A');
    expect(result.body).toContain('IND-01');
    expect(result.body).toContain('Ana Auditora');
  });

  it('carries the full filter set even when the queried range returned no data at all', async () => {
    queryMock.mockResolvedValue({
      columns: [],
      rows: [],
      aggregations: [],
      absenceLegend: {},
      isEmptyResult: true,
      nextCursor: null,
      countMode: 'EXATA',
      count: 0,
      outlierRule: 'IQR',
    });
    const dto = baseDto({ unitIds: ['unit-never-had-data'] });

    const result = await service.export(dto, user);

    expect(result.body).toContain('unit-never-had-data');
  });

  // n de cada agregacao (FR-107) — recalculado sobre TODAS as linhas
  // exportadas, nao sobre uma pagina.
  it('reports n and totalCells for every aggregation, computed over the whole exported set', async () => {
    const result = await service.export(baseDto(), user);

    expect(result.body).toContain('IND-01');
    // unit-A tem valor, unit-B esta ausente: n=1, totalCells=2.
    expect(result.body).toMatch(/IND-01,10,1,2/);
  });

  it('always includes the absence legend in the exported file', async () => {
    const result = await service.export(baseDto(), user);

    expect(result.body).toContain('Fora do nivel.');
  });

  // Paginacao interna: percorre TODAS as paginas antes de selar — o
  // arquivo nunca reflete so a primeira pagina de um recorte grande.
  it('follows nextCursor across pages before sealing, instead of exporting only the first page', async () => {
    queryMock
      .mockResolvedValueOnce({
        columns,
        rows: [{ unitId: 'unit-A', referencePeriod: '2026-06', cells: { 'IND-01': { kind: 'VALOR', value: 10, isOutlier: false } } }],
        aggregations: [],
        absenceLegend: {},
        isEmptyResult: false,
        nextCursor: 'cursor-2',
        countMode: 'EXATA',
        count: 2,
        outlierRule: 'IQR',
      })
      .mockResolvedValueOnce({
        columns,
        rows: [{ unitId: 'unit-B', referencePeriod: '2026-06', cells: { 'IND-01': { kind: 'VALOR', value: 20, isOutlier: false } } }],
        aggregations: [],
        absenceLegend: {},
        isEmptyResult: false,
        nextCursor: null,
        countMode: 'EXATA',
        count: 2,
        outlierRule: 'IQR',
      });

    const result = await service.export(baseDto(), user);

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(result.body).toContain('unit-A');
    expect(result.body).toContain('unit-B');
  });

  it('records an AccessLog entry of type EXPORTACAO for every audit export', async () => {
    await service.export(baseDto({ unitIds: ['unit-A'] }), user);

    expect(recordAccessLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ scopeUnitIds: ['unit-A'] }),
    );
  });
});
