import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLogService } from './access-log.service';
import { AuditQueryService } from './audit-query.service';

// T103/FR-089/US6-9: duas execucoes da mesma consulta sobre o mesmo acervo
// MUST produzir resultado identico, inclusive na ordem das linhas — o
// ultimo componente da chave de paginacao (id do ReportInstance) e o
// desempate estavel que garante isso mesmo quando referenceMonth/unitId
// empatam entre linhas (research.md D5).
describe('AuditQueryService determinism', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Ana',
    sobrenome: 'Aprovadora',
    email: 'ana@formops.local',
    role: RoleName.APROVADOR,
    primaryUnitId: 'unit-1',
  };

  function buildService(rowsToReturn: unknown[]) {
    const findManyMock = jest.fn().mockResolvedValue(rowsToReturn);
    const countMock = jest.fn().mockResolvedValue(rowsToReturn.length);
    const prisma = { reportInstance: { findMany: findManyMock, count: countMock } } as unknown as PrismaService;
    const unitAccessService = {
      hasOrgWideReadAccess: () => true,
      getAccessibleUnitIds: async () => [],
    } as unknown as UnitAccessService;
    const platformSettingsService = {
      getSettings: async () => ({ auditMaxRangeMonths: 24, auditDetailedMaxRangeMonths: 12, auditExactCountThreshold: 10000, outlierRule: 'IQR' }),
    } as unknown as PlatformSettingsService;
    const accessLogService = { record: jest.fn().mockResolvedValue({}) } as unknown as AccessLogService;
    return new AuditQueryService(prisma, unitAccessService, platformSettingsService, accessLogService);
  }

  it('returns byte-identical rows, in the same order, across two runs over unit/period ties', async () => {
    // Duas unidades no mesmo mes (referenceMonth e unitId nao desempatam
    // sozinhos entre "unit-A"/"unit-B" — soh a ordenacao ASC por unitId,
    // combinada ao id como criterio final, garante ordem estavel).
    const rows = [
      { id: 'ri-2', unitId: 'unit-B', referenceMonth: new Date('2026-06-01'), indicatorResponses: [] },
      { id: 'ri-1', unitId: 'unit-A', referenceMonth: new Date('2026-06-01'), indicatorResponses: [] },
      { id: 'ri-3', unitId: 'unit-A', referenceMonth: new Date('2026-05-01'), indicatorResponses: [] },
    ];

    const runOnce = async () => {
      const service = buildService(rows);
      return service.query({ periodFrom: '2026-01', periodTo: '2026-06' } as never, user);
    };

    const first = await runOnce();
    const second = await runOnce();

    expect(JSON.stringify(first.rows)).toBe(JSON.stringify(second.rows));
    expect(first.rows.map((r) => `${r.unitId}:${r.referencePeriod}`)).toEqual(
      second.rows.map((r) => `${r.unitId}:${r.referencePeriod}`),
    );
  });

  it('requests the database in the declared keyset order — never an implicit or unstable order', async () => {
    const findManyMock = jest.fn().mockResolvedValue([]);
    const prisma = { reportInstance: { findMany: findManyMock, count: jest.fn().mockResolvedValue(0) } } as unknown as PrismaService;
    const unitAccessService = { hasOrgWideReadAccess: () => true, getAccessibleUnitIds: async () => [] } as unknown as UnitAccessService;
    const platformSettingsService = {
      getSettings: async () => ({ auditMaxRangeMonths: 24, auditDetailedMaxRangeMonths: 12, auditExactCountThreshold: 10000, outlierRule: 'IQR' }),
    } as unknown as PlatformSettingsService;
    const accessLogService = { record: jest.fn().mockResolvedValue({}) } as unknown as AccessLogService;
    const service = new AuditQueryService(prisma, unitAccessService, platformSettingsService, accessLogService);

    await service.query({ periodFrom: '2026-01', periodTo: '2026-06' } as never, user);

    expect(findManyMock.mock.calls[0][0].orderBy).toEqual([{ referenceMonth: 'desc' }, { unitId: 'asc' }, { id: 'asc' }]);
  });
});
