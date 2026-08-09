import { ForbiddenException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { UnitAccessService } from './unit-access.service';

describe('UnitAccessService', () => {
  let service: UnitAccessService;
  let findManyMock: jest.Mock;

  function buildUser(role: RoleName, primaryUnitId = 'unit-primary'): AuthenticatedUser {
    return { id: 'user-1', matricula: '1', nome: 'A', sobrenome: 'B', email: 'a@formops.local', role, primaryUnitId };
  }

  beforeEach(() => {
    findManyMock = jest.fn();
    const prisma = { userUnitAccess: { findMany: findManyMock } } as unknown as PrismaService;
    service = new UnitAccessService(prisma);
  });

  describe('hasOrgWideReadAccess', () => {
    test.each([RoleName.APROVADOR, RoleName.ADMINISTRADOR])('returns true for %s', (role) => {
      expect(service.hasOrgWideReadAccess(buildUser(role))).toBe(true);
    });

    test.each([RoleName.OBSERVADOR, RoleName.ELABORADOR, RoleName.REVISOR])('returns false for %s', (role) => {
      expect(service.hasOrgWideReadAccess(buildUser(role))).toBe(false);
    });
  });

  describe('getAccessibleUnitIds', () => {
    test('includes the primary unit plus any explicitly granted units', async () => {
      findManyMock.mockResolvedValue([{ unitId: 'unit-extra-1' }, { unitId: 'unit-extra-2' }]);

      const result = await service.getAccessibleUnitIds(buildUser(RoleName.OBSERVADOR));

      expect(result).toEqual(['unit-primary', 'unit-extra-1', 'unit-extra-2']);
      expect(findManyMock).toHaveBeenCalledWith({ where: { userId: 'user-1' }, select: { unitId: true } });
    });
  });

  describe('assertReadAccess', () => {
    test('allows org-wide roles to read any unit without querying explicit accesses', async () => {
      await expect(service.assertReadAccess('any-unit', buildUser(RoleName.ADMINISTRADOR))).resolves.toBeUndefined();
      expect(findManyMock).not.toHaveBeenCalled();
    });

    test('allows a scoped user to read their own primary unit', async () => {
      findManyMock.mockResolvedValue([]);

      await expect(service.assertReadAccess('unit-primary', buildUser(RoleName.OBSERVADOR))).resolves.toBeUndefined();
    });

    test('throws ForbiddenException when a scoped user has no access to the requested unit', async () => {
      findManyMock.mockResolvedValue([]);

      await expect(service.assertReadAccess('unit-forbidden', buildUser(RoleName.OBSERVADOR))).rejects.toThrow(
        ForbiddenException,
      );
    });

    // T092/US5-3/quickstart V15: revogar um acesso extra produz perda de
    // visibilidade imediata, sem intervalo de tolerancia — o service consulta
    // userUnitAccess diretamente a cada chamada (sem cache/memoizacao), entao
    // a proxima chamada apos a revogacao ja reflete o novo estado.
    test('loses access on the very next call after the grant is revoked, without any tolerance window', async () => {
      const user = buildUser(RoleName.OBSERVADOR);

      findManyMock.mockResolvedValueOnce([{ unitId: 'unit-extra' }]);
      await expect(service.assertReadAccess('unit-extra', user)).resolves.toBeUndefined();

      findManyMock.mockResolvedValueOnce([]);
      await expect(service.assertReadAccess('unit-extra', user)).rejects.toThrow(ForbiddenException);

      expect(findManyMock).toHaveBeenCalledTimes(2);
    });
  });
});
