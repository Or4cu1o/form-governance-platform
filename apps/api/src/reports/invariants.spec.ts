import { RoleName } from '@prisma/client';
import { computeArtifactDigest } from '../sealing/canonical-serialization';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuditQueryService } from '../audit/audit-query.service';
import { AuditQueryDto } from '../audit/dto/audit-query.dto';
import { AccessLogService } from '../audit/access-log.service';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContextService } from '../common/services/audit-context.service';
import { FormIndicatorsService } from '../forms/form-indicators.service';
import { classifyIndicatorCell, isAbsentState, IndicatorCellState } from './absence.util';

// T157 — as cinco invariantes que a constituicao exige explicitamente
// (quickstart.md, "Invariantes com teste obrigatorio"). Cada uma ja e
// coberta em profundidade no proprio modulo (absence.util.spec.ts,
// audit-query.service.spec.ts, canonical-serialization.spec.ts,
// form-indicators.service.spec.ts); este arquivo e o portao consolidado que
// nomeia as cinco explicitamente, num unico lugar, para que nenhuma passe
// despercebida numa auditoria de conformidade.
describe('Invariantes obrigatorias da constituicao (T157)', () => {
  // 1. N/A nunca e 0, em nenhuma das cinco representacoes.
  it('1. N/A nunca e 0 em nenhuma das cinco representacoes de celula', () => {
    const states = [
      classifyIndicatorCell({ responseExists: false, indicatorActiveAtPeriod: true, calculatedValue: null }),
      classifyIndicatorCell({ responseExists: true, indicatorActiveAtPeriod: false, calculatedValue: null }),
      classifyIndicatorCell({ responseExists: true, indicatorActiveAtPeriod: true, calculatedValue: null }),
      classifyIndicatorCell({ responseExists: true, indicatorActiveAtPeriod: true, calculatedValue: 0 }),
      classifyIndicatorCell({ responseExists: true, indicatorActiveAtPeriod: true, calculatedValue: 42 }),
    ];

    expect(states).toEqual([
      IndicatorCellState.NAO_APLICAVEL_FORA_DO_NIVEL,
      IndicatorCellState.NAO_APLICAVEL_INDICADOR_INATIVO,
      IndicatorCellState.NAO_PREENCHIDO,
      IndicatorCellState.ZERO_MEDIDO,
      IndicatorCellState.VALOR_APURADO,
    ]);
    // As tres primeiras sao ausencia — nenhuma delas e o numero zero medido,
    // e nenhuma entra em denominador de agregacao (FR-086).
    expect(states.slice(0, 3).every(isAbsentState)).toBe(true);
    expect(isAbsentState(IndicatorCellState.ZERO_MEDIDO)).toBe(false);
    // As cinco sao par a par distintas — nenhuma representacao colapsa
    // sobre outra.
    expect(new Set(states)).toHaveProperty('size', 5);
  });

  // 2. Resultado vazio nunca relaxa filtro em silencio.
  it('2. resultado vazio na consulta de auditoria nao relaxa nenhum filtro automaticamente', async () => {
    const prisma = {
      reportInstance: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const unitAccessService = {
      hasOrgWideReadAccess: jest.fn().mockReturnValue(true),
      getAccessibleUnitIds: jest.fn().mockResolvedValue([]),
    } as unknown as UnitAccessService;
    const platformSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        auditMaxRangeMonths: 24,
        auditDetailedMaxRangeMonths: 12,
        auditExactCountThreshold: 10000,
        outlierRule: 'IQR',
      }),
    } as unknown as PlatformSettingsService;
    const accessLogService = { record: jest.fn().mockResolvedValue({}) } as unknown as AccessLogService;
    const service = new AuditQueryService(prisma, unitAccessService, platformSettingsService, accessLogService);
    const requestedFilters = { periodFrom: '2026-01', periodTo: '2026-06', unitIds: ['unit-x'] } as AuditQueryDto;
    const admin: AuthenticatedUser = {
      id: 'user-1',
      matricula: '10001',
      nome: 'Ana',
      sobrenome: 'Administradora',
      email: 'ana@formops.local',
      role: RoleName.ADMINISTRADOR,
      primaryUnitId: 'unit-x',
    };

    const result = await service.query(requestedFilters, admin);

    expect(result.isEmptyResult).toBe(true);
    expect(result.rows).toEqual([]);
    // Os filtros ecoados de volta sao exatamente os pedidos — nenhum foi
    // ampliado/removido para "encontrar algo".
    expect(prisma.reportInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ unitId: { in: ['unit-x'] } }) }),
    );
  });

  // 3. Matriz esparsa em consulta multi-nivel: toda ausencia carrega o
  // codigo exato, nunca uma celula vazia/omitida.
  it('3. consulta multi-unidade produz matriz esparsa com codigo de ausencia exato em toda celula sem resposta', async () => {
    const reportInstances = [
      {
        id: 'ri-1',
        unitId: 'unit-A',
        referenceMonth: new Date('2026-06-01'),
        indicatorResponses: [{ calculatedValue: 42, formIndicator: { catalogEntry: { code: 'IND-01', measurementUnit: 'unidades', name: 'IND-01' } } }],
      },
      { id: 'ri-2', unitId: 'unit-B', referenceMonth: new Date('2026-06-01'), indicatorResponses: [] },
    ];
    const prisma = {
      reportInstance: {
        findMany: jest.fn().mockResolvedValue(reportInstances),
        count: jest.fn().mockResolvedValue(reportInstances.length),
      },
    } as unknown as PrismaService;
    const unitAccessService = {
      hasOrgWideReadAccess: jest.fn().mockReturnValue(true),
      getAccessibleUnitIds: jest.fn().mockResolvedValue([]),
    } as unknown as UnitAccessService;
    const platformSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        auditMaxRangeMonths: 24,
        auditDetailedMaxRangeMonths: 12,
        auditExactCountThreshold: 10000,
        outlierRule: 'IQR',
      }),
    } as unknown as PlatformSettingsService;
    const accessLogService = { record: jest.fn().mockResolvedValue({}) } as unknown as AccessLogService;
    const service = new AuditQueryService(prisma, unitAccessService, platformSettingsService, accessLogService);
    const admin: AuthenticatedUser = {
      id: 'user-1',
      matricula: '10001',
      nome: 'Ana',
      sobrenome: 'Administradora',
      email: 'ana@formops.local',
      role: RoleName.ADMINISTRADOR,
      primaryUnitId: 'unit-A',
    };

    const result = await service.query({ periodFrom: '2026-06', periodTo: '2026-06' } as AuditQueryDto, admin);

    const rowB = result.rows.find((r) => r.unitId === 'unit-B')!;
    expect(rowB.cells['IND-01']).toEqual({ kind: 'NA_FORA_DO_NIVEL', value: null, isOutlier: false });
  });

  // 4. Regressao de selagem por byte unico: qualquer alteracao, mesmo de um
  // byte, muda o digest — nunca colide.
  it('4. um byte alterado no conteudo canonico produz um digest diferente (regressao de selagem)', () => {
    const original = 'a'.repeat(10_000);
    const oneByteChanged = `${'a'.repeat(9_999)}b`;

    expect(computeArtifactDigest(original)).not.toEqual(computeArtifactDigest(oneByteChanged));
    // Mesmo conteudo, mesmo digest — a funcao e determinista, condicao
    // necessaria para a comparacao acima ser significativa.
    expect(computeArtifactDigest(original)).toEqual(computeArtifactDigest('a'.repeat(10_000)));
  });

  // 5. Soma dos pesos ativos = 10,00 e condicao de operabilidade — nunca
  // aceita silenciosamente um formulario desbalanceado.
  describe('5. soma dos pesos ativos deve ser exatamente 10,00 para o formulario ser operavel', () => {
    function buildService(activeIndicators: Array<{ id: string; scoreWeight: number }>) {
      const prisma = {
        formTemplate: { findUnique: jest.fn().mockResolvedValue({ id: 'template-1' }) },
        formIndicator: {
          findMany: jest
            .fn()
            .mockResolvedValue(activeIndicators.map((i) => ({ ...i, title: i.id, isActive: true }))),
        },
      } as unknown as PrismaService;
      const auditContextService = {} as unknown as AuditContextService;
      return new FormIndicatorsService(prisma, auditContextService);
    }

    it('rejects a form template whose active weights do not sum to 10', async () => {
      const service = buildService([
        { id: 'ind-1', scoreWeight: 4 },
        { id: 'ind-2', scoreWeight: 4 },
      ]);

      await expect(service.assertBalanced('template-1')).rejects.toThrow();
    });

    it('accepts a form template whose active weights sum exactly to 10', async () => {
      const service = buildService([
        { id: 'ind-1', scoreWeight: 6 },
        { id: 'ind-2', scoreWeight: 4 },
      ]);

      await expect(service.assertBalanced('template-1')).resolves.toBeUndefined();
    });
  });
});
