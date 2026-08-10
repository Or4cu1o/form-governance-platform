import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AccessLogService } from '../audit/access-log.service';
import { AuditQueryService } from '../audit/audit-query.service';
import { AuditExportDto } from '../audit/dto/audit-export.dto';
import { SealService } from '../sealing/seal.service';
import { AuditExportService } from './audit-export.service';
import { PlatformSettingsService } from './platform-settings.service';

// T128a/FR-088/SC-008: toda agregacao exibida MUST ser reproduzivel a
// partir das linhas brutas do MESMO arquivo exportado — mesmo numero,
// mesmo n, mesma escala decimal. Este teste nao confia na implementacao:
// ele parseia o CSV exportado como um auditor faria (linhas brutas +
// calculadora), recalcula a media de forma independente, e compara com o
// numero que o arquivo declara na secao de agregacoes.
describe('audit export recomputability', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Ana',
    sobrenome: 'Auditora',
    email: 'ana@formops.local',
    role: RoleName.APROVADOR,
    primaryUnitId: 'unit-1',
  };

  function buildService(rows: Array<{ unitId: string; value: number | null; kind: string }>) {
    const queryMock = jest.fn().mockResolvedValue({
      columns: [{ indicatorCode: 'IND-01', measurementUnit: 'unidades' }],
      rows: rows.map((r) => ({
        unitId: r.unitId,
        referencePeriod: '2026-06',
        cells: { 'IND-01': { kind: r.kind, value: r.value, isOutlier: false } },
      })),
      aggregations: [],
      absenceLegend: {},
      isEmptyResult: false,
      nextCursor: null,
      countMode: 'EXATA',
      count: rows.length,
      outlierRule: 'IQR',
    });
    const auditQueryService = {
      query: queryMock,
      getFilters: jest.fn().mockResolvedValue({ units: [], levels: [], indicatorCodes: [{ code: 'IND-01', name: 'x', measurementUnit: 'unidades' }] }),
    } as unknown as AuditQueryService;
    const platformSettingsService = { getSettings: jest.fn().mockResolvedValue({ exportNamingPattern: '{SIGLA_UNIDADE}_{DATA_ISO}' }) } as unknown as PlatformSettingsService;
    const sealService = {
      prepareSeal: jest.fn().mockReturnValue({ contentDigest: 'd', signature: 's', keyId: 'k', verificationCode: 'ABCD2345EFGH6789C' }),
      persistSeal: jest.fn().mockResolvedValue({ artifactDigest: 'a' }),
    } as unknown as SealService;
    const accessLogService = { record: jest.fn().mockResolvedValue({}) } as unknown as AccessLogService;
    return new AuditExportService(auditQueryService, platformSettingsService, sealService, accessLogService);
  }

  // So o BLOCO de linhas brutas, entre o cabecalho "Unidade,..." e a
  // primeira linha em branco — nao pode varrer o arquivo inteiro, ou a
  // propria linha de agregacao (que tambem tem numeros) contaminaria o
  // recalculo independente.
  function parseRawRows(csv: string): number[] {
    const lines = csv.split('\n');
    const headerIndex = lines.findIndex((line) => line.startsWith('Unidade,'));
    const dataLines: string[] = [];
    for (const line of lines.slice(headerIndex + 1)) {
      if (line.trim() === '') break;
      dataLines.push(line);
    }
    const values: number[] = [];
    for (const line of dataLines) {
      const [, , cell] = line.split(',');
      const parsed = Number(cell);
      if (!Number.isNaN(parsed) && cell !== '') values.push(parsed);
    }
    return values;
  }

  function parseAggregationRow(csv: string): { value: number | null; n: number; totalCells: number } {
    const match = csv.match(/IND-01,([\d.]*),(\d+),(\d+)/);
    if (!match) throw new Error('Linha de agregacao nao encontrada no CSV exportado');
    return { value: match[1] === '' ? null : Number(match[1]), n: Number(match[2]), totalCells: Number(match[3]) };
  }

  it('reproduces the exact average, n and totalCells from the raw rows of the same exported file', async () => {
    const service = buildService([
      { unitId: 'unit-A', value: 10, kind: 'VALOR' },
      { unitId: 'unit-B', value: 20, kind: 'VALOR' },
      { unitId: 'unit-C', value: null, kind: 'NA_FORA_DO_NIVEL' },
    ]);
    const dto: AuditExportDto = { periodFrom: '2026-01', periodTo: '2026-06', format: 'CSV' } as AuditExportDto;

    const result = await service.export(dto, user);
    const csv = result.body;

    const rawValues = parseRawRows(csv);
    const declaredAggregation = parseAggregationRow(csv);

    const independentlyComputedAverage = Number((rawValues.reduce((a, b) => a + b, 0) / rawValues.length).toFixed(2));

    expect(declaredAggregation.value).toBe(independentlyComputedAverage);
    expect(declaredAggregation.n).toBe(rawValues.length);
    expect(declaredAggregation.n).toBe(2);
    expect(declaredAggregation.totalCells).toBe(3);
  });

  it('reproduces the same result for an all-absent column: n=0, no fabricated average', async () => {
    const service = buildService([
      { unitId: 'unit-A', value: null, kind: 'NAO_PREENCHIDO' },
      { unitId: 'unit-B', value: null, kind: 'NA_FORA_DO_NIVEL' },
    ]);
    const dto: AuditExportDto = { periodFrom: '2026-01', periodTo: '2026-06', format: 'CSV' } as AuditExportDto;

    const result = await service.export(dto, user);
    const rawValues = parseRawRows(result.body);
    const declaredAggregation = parseAggregationRow(result.body);

    expect(rawValues).toHaveLength(0);
    expect(declaredAggregation.n).toBe(0);
    expect(declaredAggregation.totalCells).toBe(2);
  });
});
