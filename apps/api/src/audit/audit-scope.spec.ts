import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLogService } from './access-log.service';
import { AuditQueryService } from './audit-query.service';

// T104/US6-10: um usuario de escopo restrito, ao consultar a area de
// auditoria, enxerga EXATAMENTE as unidades que ja enxergava nas demais
// telas — nenhum acesso novo e introduzido, e nenhum unitIds pedido na
// consulta consegue alargar esse escopo (a mesma garantia estrutural de
// UnitAccessService, reafirmada aqui no ponto de entrada da area).
describe('AuditQueryService scope restriction', () => {
  function buildService(hasOrgWideReadAccess: boolean, accessibleUnitIds: string[]) {
    const findManyMock = jest.fn().mockResolvedValue([]);
    const countMock = jest.fn().mockResolvedValue(0);
    const prisma = { reportInstance: { findMany: findManyMock, count: countMock } } as unknown as PrismaService;
    const unitAccessService = {
      hasOrgWideReadAccess: () => hasOrgWideReadAccess,
      getAccessibleUnitIds: jest.fn().mockResolvedValue(accessibleUnitIds),
    } as unknown as UnitAccessService;
    const platformSettingsService = {
      getSettings: async () => ({ auditMaxRangeMonths: 24, auditDetailedMaxRangeMonths: 12, auditExactCountThreshold: 10000, outlierRule: 'IQR' }),
    } as unknown as PlatformSettingsService;
    const accessLogService = { record: jest.fn().mockResolvedValue({}) } as unknown as AccessLogService;
    return { service: new AuditQueryService(prisma, unitAccessService, platformSettingsService, accessLogService), findManyMock };
  }

  const observador: AuthenticatedUser = {
    id: 'user-2',
    matricula: '10002',
    nome: 'Bruno',
    sobrenome: 'Observador',
    email: 'bruno@formops.local',
    role: RoleName.OBSERVADOR,
    primaryUnitId: 'unit-1',
  };

  it('restricts the query to exactly the accessible units when no unitIds filter is given', async () => {
    const { service, findManyMock } = buildService(false, ['unit-1', 'unit-2']);

    await service.query({ periodFrom: '2026-01', periodTo: '2026-06' } as never, observador);

    expect(findManyMock.mock.calls[0][0].where.unitId).toEqual({ in: ['unit-1', 'unit-2'] });
  });

  it('never introduces a new unit beyond what the user already saw, even when it is explicitly requested', async () => {
    const { service, findManyMock } = buildService(false, ['unit-1', 'unit-2']);

    await service.query(
      { periodFrom: '2026-01', periodTo: '2026-06', unitIds: ['unit-1', 'unit-99-never-granted'] } as never,
      observador,
    );

    expect(findManyMock.mock.calls[0][0].where.unitId).toEqual({ in: ['unit-1'] });
  });

  it('does not restrict by unit for roles with org-wide read access (APROVADOR/ADMINISTRADOR)', async () => {
    const aprovador: AuthenticatedUser = { ...observador, id: 'user-3', role: RoleName.APROVADOR };
    const { service, findManyMock } = buildService(true, []);

    await service.query({ periodFrom: '2026-01', periodTo: '2026-06' } as never, aprovador);

    expect(findManyMock.mock.calls[0][0].where.unitId).toBeUndefined();
  });

  it('short-circuits without hitting the database when the requested unit is entirely outside the scope', async () => {
    const { service, findManyMock } = buildService(false, ['unit-1']);

    const result = await service.query(
      { periodFrom: '2026-01', periodTo: '2026-06', unitIds: ['unit-99-never-granted'] } as never,
      observador,
    );

    expect(result.isEmptyResult).toBe(true);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
