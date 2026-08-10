import { BadRequestException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLogService } from './access-log.service';
import { AuditQueryService } from './audit-query.service';
import { AuditQueryDto } from './dto/audit-query.dto';

const DEFAULT_SETTINGS = {
  id: 'settings-1',
  auditMaxRangeMonths: 24,
  auditDetailedMaxRangeMonths: 12,
  auditExactCountThreshold: 10000,
  outlierRule: 'IQR',
};

function indicatorResponse(code: string, measurementUnit: string, calculatedValue: number | null) {
  return {
    calculatedValue,
    formIndicator: { catalogEntry: { code, measurementUnit, name: code } },
  };
}

function reportInstance(id: string, unitId: string, referenceMonth: string, indicatorResponses: unknown[]) {
  return { id, unitId, referenceMonth: new Date(referenceMonth), indicatorResponses };
}

describe('AuditQueryService', () => {
  let service: AuditQueryService;
  let findManyMock: jest.Mock;
  let countMock: jest.Mock;
  let getSettingsMock: jest.Mock;
  let hasOrgWideReadAccessMock: jest.Mock;
  let getAccessibleUnitIdsMock: jest.Mock;
  let recordMock: jest.Mock;

  const aprovador: AuthenticatedUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Ana',
    sobrenome: 'Aprovadora',
    email: 'ana@formops.local',
    role: RoleName.APROVADOR,
    primaryUnitId: 'unit-1',
  };

  const observador: AuthenticatedUser = { ...aprovador, id: 'user-2', role: RoleName.OBSERVADOR };

  beforeEach(() => {
    findManyMock = jest.fn().mockResolvedValue([]);
    countMock = jest.fn().mockResolvedValue(0);
    getSettingsMock = jest.fn().mockResolvedValue(DEFAULT_SETTINGS);
    hasOrgWideReadAccessMock = jest.fn().mockReturnValue(true);
    getAccessibleUnitIdsMock = jest.fn().mockResolvedValue([]);
    recordMock = jest.fn().mockResolvedValue({});

    const prisma = { reportInstance: { findMany: findManyMock, count: countMock } } as unknown as PrismaService;
    const unitAccessService = {
      hasOrgWideReadAccess: hasOrgWideReadAccessMock,
      getAccessibleUnitIds: getAccessibleUnitIdsMock,
    } as unknown as UnitAccessService;
    const platformSettingsService = { getSettings: getSettingsMock } as unknown as PlatformSettingsService;
    const accessLogService = { record: recordMock } as unknown as AccessLogService;

    service = new AuditQueryService(prisma, unitAccessService, platformSettingsService, accessLogService);
  });

  function baseDto(overrides: Partial<AuditQueryDto> = {}): AuditQueryDto {
    return { periodFrom: '2026-01', periodTo: '2026-06', ...overrides } as AuditQueryDto;
  }

  // T099/FR-082/FR-084: matriz esparsa com codigo de ausencia exato — nunca
  // 0, nunca vazio silencioso — em toda celula sem resposta correspondente.
  it('produces a sparse matrix with the exact absence code in every cell without a matching response', async () => {
    countMock.mockResolvedValue(2);
    findManyMock.mockResolvedValue([
      reportInstance('ri-1', 'unit-A', '2026-06-01', [indicatorResponse('IND-01', 'unidades', 42), indicatorResponse('IND-02', 'pct', 0)]),
      reportInstance('ri-2', 'unit-B', '2026-06-01', [indicatorResponse('IND-01', 'unidades', null)]),
    ]);

    const result = await service.query(baseDto(), aprovador);

    expect(result.columns.map((c) => c.indicatorCode)).toEqual(['IND-01', 'IND-02']);
    const rowB = result.rows.find((r) => r.unitId === 'unit-B')!;
    // unit-B nunca teve resposta para IND-02 — fora do nivel, nunca 0.
    expect(rowB.cells['IND-02']).toEqual({ kind: 'NA_FORA_DO_NIVEL', value: null, isOutlier: false });
    expect(rowB.cells['IND-01']).toEqual({ kind: 'NAO_PREENCHIDO', value: null, isOutlier: false });
    const rowA = result.rows.find((r) => r.unitId === 'unit-A')!;
    expect(rowA.cells['IND-02']).toEqual({ kind: 'ZERO_MEDIDO', value: 0, isOutlier: false });
    expect(rowA.cells['IND-01']).toEqual({ kind: 'VALOR', value: 42, isOutlier: false });
  });

  // T100/US6-3: unidade que mudou de nivel no meio do intervalo reporta
  // NA_FORA_DO_NIVEL antes da transicao e valores depois.
  it('reports NA_FORA_DO_NIVEL before a mid-range level transition and VALOR after it', async () => {
    countMock.mockResolvedValue(2);
    findManyMock.mockResolvedValue([
      reportInstance('ri-2', 'unit-A', '2026-03-01', [indicatorResponse('IND-NIVEL-NOVO', 'unidades', 7)]),
      reportInstance('ri-1', 'unit-A', '2026-01-01', []),
    ]);

    const result = await service.query(baseDto(), aprovador);

    const early = result.rows.find((r) => r.referencePeriod === '2026-01')!;
    const later = result.rows.find((r) => r.referencePeriod === '2026-03')!;
    expect(early.cells['IND-NIVEL-NOVO'].kind).toBe('NA_FORA_DO_NIVEL');
    expect(later.cells['IND-NIVEL-NOVO']).toEqual({ kind: 'VALOR', value: 7, isOutlier: false });
  });

  // T101/FR-083: conjunto vazio -> isEmptyResult, sem ampliar periodo,
  // remover unidade, afrouxar recorte nem sugerir alternativa.
  it('reports isEmptyResult without relaxing any filter when nothing matches', async () => {
    countMock.mockResolvedValue(0);
    findManyMock.mockResolvedValue([]);

    const dto = baseDto({ unitIds: ['unit-only'] });
    const result = await service.query(dto, aprovador);

    expect(result.isEmptyResult).toBe(true);
    expect(result.rows).toEqual([]);
    expect(result.columns).toEqual([]);
    // O filtro original (unit-only) segue no WHERE efetivamente executado —
    // nada foi ampliado para tentar achar resultado.
    const calledWhere = findManyMock.mock.calls[0][0].where;
    expect(calledWhere.unitId).toEqual({ in: ['unit-only'] });
  });

  // T102/FR-085/FR-086/FR-065: toda agregacao declara n e totalCells,
  // celulas ausentes ficam fora do denominador, sem interpolacao; colunas
  // de measurementUnit distintas nunca se misturam numa unica agregacao.
  it('excludes absent cells from aggregation denominators and never mixes distinct measurementUnits', async () => {
    countMock.mockResolvedValue(2);
    findManyMock.mockResolvedValue([
      reportInstance('ri-1', 'unit-A', '2026-06-01', [indicatorResponse('IND-01', 'unidades', 10), indicatorResponse('IND-02', 'R$', 100)]),
      reportInstance('ri-2', 'unit-B', '2026-06-01', [indicatorResponse('IND-01', 'unidades', 20)]),
    ]);

    const result = await service.query(baseDto(), aprovador);

    const aggIND01 = result.aggregations.find((a) => a.label === 'IND-01')!;
    const aggIND02 = result.aggregations.find((a) => a.label === 'IND-02')!;
    expect(aggIND01).toMatchObject({ n: 2, totalCells: 2, value: 15, measurementUnit: 'unidades' });
    // unit-B nunca teve IND-02: fica fora do denominador (n=1), nao vira 0.
    expect(aggIND02).toMatchObject({ n: 1, totalCells: 2, value: 100, measurementUnit: 'R$' });
  });

  // T103/FR-089/US6-9: duas execucoes identicas produzem resultado
  // byte-identico, inclusive na ordem das linhas.
  it('is fully deterministic across two identical executions', async () => {
    countMock.mockResolvedValue(2);
    const rows = [
      reportInstance('ri-1', 'unit-A', '2026-06-01', [indicatorResponse('IND-01', 'unidades', 10)]),
      reportInstance('ri-2', 'unit-B', '2026-06-01', [indicatorResponse('IND-01', 'unidades', 20)]),
    ];
    findManyMock.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows);

    const first = await service.query(baseDto(), aprovador);
    const second = await service.query(baseDto(), aprovador);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  // T104/US6-10: usuario de escopo restrito enxerga exatamente as unidades
  // que ja enxergava — pedir unidade fora do escopo nunca alarga o acesso.
  it('never widens a scope-restricted user access, even if extra unitIds are requested', async () => {
    hasOrgWideReadAccessMock.mockReturnValue(false);
    getAccessibleUnitIdsMock.mockResolvedValue(['unit-1']);
    countMock.mockResolvedValue(0);

    await service.query(baseDto({ unitIds: ['unit-1', 'unit-outside-scope'] }), observador);

    const calledWhere = findManyMock.mock.calls[0][0].where;
    expect(calledWhere.unitId).toEqual({ in: ['unit-1'] });
  });

  it('returns an empty scope result without querying the database when the user has access to nothing requested', async () => {
    hasOrgWideReadAccessMock.mockReturnValue(false);
    getAccessibleUnitIdsMock.mockResolvedValue(['unit-1']);

    const result = await service.query(baseDto({ unitIds: ['unit-outside-scope'] }), observador);

    expect(result.isEmptyResult).toBe(true);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  // T105/FR-091: amplitude acima do limite -> 400 com orientacao, jamais
  // truncamento silencioso.
  it('rejects a range wider than auditMaxRangeMonths with a 400, never truncating silently', async () => {
    const dto = baseDto({ periodFrom: '2020-01', periodTo: '2026-06' });

    await expect(service.query(dto, aprovador)).rejects.toThrow(BadRequestException);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('applies the stricter DETALHADO range limit instead of the BASICO one', async () => {
    const dto = baseDto({ periodFrom: '2025-01', periodTo: '2026-06', mode: 'DETALHADO' as AuditQueryDto['mode'] });

    await expect(service.query(dto, aprovador)).rejects.toThrow(BadRequestException);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  // T113a/FR-092: a busca dentro do resultado alcanca o conjunto inteiro na
  // propria consulta ao banco — nunca um filtro aplicado so sobre a pagina
  // corrente ja carregada.
  it('applies search as a database-level filter, not as a client-side filter over the current page', async () => {
    countMock.mockResolvedValue(0);
    findManyMock.mockResolvedValue([]);

    await service.query(baseDto({ search: 'quantitativo', pageSize: 1 }), aprovador);

    const calledWhere = findManyMock.mock.calls[0][0].where;
    expect(calledWhere.OR).toBeDefined();
    expect(JSON.stringify(calledWhere.OR)).toContain('quantitativo');
  });

  it('records an AccessLog entry with the full filters, scope, and result volume for every query', async () => {
    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([reportInstance('ri-1', 'unit-A', '2026-06-01', [])]);

    await service.query(baseDto({ unitIds: ['unit-A'] }), aprovador);

    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ scopeUnitIds: ['unit-A'], resultVolume: 1 }),
    );
  });
});
