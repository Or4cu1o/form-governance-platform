import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthSource, RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LdapAuthService, UnitSelectionRequiredException } from './ldap-auth.service';
import { LdapClientService } from './ldap-client.service';
import { LdapConfigsService } from './ldap-configs.service';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

describe('LdapAuthService', () => {
  let service: LdapAuthService;
  let unitFindManyMock: jest.Mock;
  let userCreateMock: jest.Mock;
  let userUpdateMock: jest.Mock;
  let ldapConfigFindManyMock: jest.Mock;
  let groupMappingFindManyMock: jest.Mock;
  let authenticateMock: jest.Mock;
  let getConnectionConfigMock: jest.Mock;
  let findActiveByDomainMock: jest.Mock;
  let ensurePendingRequestMock: jest.Mock;
  let revokeStaleMock: jest.Mock;

  const connection = {
    id: 'cfg-1',
    unitId: 'unit-1',
    hosts: ['dc1.empresa.local'],
    port: 636,
    useTls: true,
    bindDn: 'CN=svc,DC=empresa,DC=local',
    bindPassword: 'senha-servico',
    baseDn: 'DC=empresa,DC=local',
  };

  beforeEach(() => {
    unitFindManyMock = jest.fn();
    userCreateMock = jest.fn();
    userUpdateMock = jest.fn();
    ldapConfigFindManyMock = jest.fn();
    groupMappingFindManyMock = jest.fn();
    authenticateMock = jest.fn();
    getConnectionConfigMock = jest.fn();
    findActiveByDomainMock = jest.fn();
    ensurePendingRequestMock = jest.fn().mockResolvedValue(undefined);
    revokeStaleMock = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      unit: { findMany: unitFindManyMock },
      user: { create: userCreateMock, update: userUpdateMock },
      ldapConfig: { findMany: ldapConfigFindManyMock },
      ldapGroupMapping: { findMany: groupMappingFindManyMock },
    } as unknown as PrismaService;
    const ldapClientService = { authenticate: authenticateMock } as unknown as LdapClientService;
    const ldapConfigsService = {
      getConnectionConfig: getConnectionConfigMock,
      findActiveByDomain: findActiveByDomainMock,
    } as unknown as LdapConfigsService;
    const roleElevationRequestsService = {
      ensurePendingRequest: ensurePendingRequestMock,
      revokeStalePendingRequests: revokeStaleMock,
    } as unknown as RoleElevationRequestsService;

    service = new LdapAuthService(prisma, ldapClientService, ldapConfigsService, roleElevationRequestsService);
  });

  describe('listBootstrapUnits', () => {
    test('lists only active units with ldapEnabled=true', async () => {
      unitFindManyMock.mockResolvedValue([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);

      const result = await service.listBootstrapUnits();

      expect(unitFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ldapEnabled: true, isActive: true } }),
      );
      expect(result).toEqual([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);
    });
  });

  describe('authenticateExistingLdapUser', () => {
    const existingUser = {
      id: 'user-1',
      role: RoleName.ELABORADOR,
      ldapConfigId: 'cfg-1',
      ldapUsername: 'jsilva',
      authSource: AuthSource.LDAP,
    };

    test('throws generic UNAUTHORIZED when the bind fails', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue(null);

      await expect(service.authenticateExistingLdapUser(existingUser as never, 'senha-errada')).rejects.toMatchObject({
        response: 'Credenciais invalidas',
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    test('deactivates the user and denies login when the AD account is disabled', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: [], accountDisabled: true });

      await expect(service.authenticateExistingLdapUser(existingUser as never, 'senha')).rejects.toThrow(HttpException);
      expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { isActive: false } });
    });

    test('syncs the role from current groups and reactivates the user on success', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: ['CN=Revisores,DC=empresa,DC=local'], accountDisabled: false });
      groupMappingFindManyMock.mockResolvedValue([{ groupDn: 'CN=Revisores,DC=empresa,DC=local', role: RoleName.REVISOR }]);
      userUpdateMock.mockResolvedValue({
        id: 'user-1',
        matricula: 'ldap:unit-1:jsilva',
        nome: 'Joao',
        sobrenome: 'Silva',
        email: 'joao@empresa.local',
        role: RoleName.REVISOR,
        primaryUnitId: 'unit-1',
      });

      const result = await service.authenticateExistingLdapUser(existingUser as never, 'senha');

      expect(userUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' }, data: { role: RoleName.REVISOR, isActive: true } }),
      );
      expect(result.role).toBe(RoleName.REVISOR);
    });

    test('never downgrades an APROVADOR/ADMINISTRADOR role via group sync', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: ['CN=Observadores,DC=empresa,DC=local'], accountDisabled: false });
      groupMappingFindManyMock.mockResolvedValue([{ groupDn: 'CN=Observadores,DC=empresa,DC=local', role: RoleName.OBSERVADOR }]);
      userUpdateMock.mockResolvedValue({ id: 'user-1', role: RoleName.ADMINISTRADOR, primaryUnitId: 'unit-1' });

      await service.authenticateExistingLdapUser({ ...existingUser, role: RoleName.ADMINISTRADOR } as never, 'senha');

      expect(userUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: RoleName.ADMINISTRADOR, isActive: true } }),
      );
    });

    test('keeps an elevated user logged in even without a current O/E/R group match', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: ['CN=Administradores,DC=empresa,DC=local'], accountDisabled: false });
      groupMappingFindManyMock.mockResolvedValue([{ groupDn: 'CN=Administradores,DC=empresa,DC=local', role: RoleName.ADMINISTRADOR }]);
      userUpdateMock.mockResolvedValue({ id: 'user-1', role: RoleName.ADMINISTRADOR, primaryUnitId: 'unit-1' });

      const result = await service.authenticateExistingLdapUser({ ...existingUser, role: RoleName.ADMINISTRADOR } as never, 'senha');

      expect(userUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: RoleName.ADMINISTRADOR, isActive: true } }),
      );
      expect(result).toBeDefined();
    });

    test('blocks login when the user has no valid O/E/R group', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: [], accountDisabled: false });
      groupMappingFindManyMock.mockResolvedValue([]);

      await expect(service.authenticateExistingLdapUser(existingUser as never, 'senha')).rejects.toThrow(HttpException);
    });
  });

  describe('authenticateByDomain', () => {
    test('throws generic UNAUTHORIZED when no LdapConfig matches the domain', async () => {
      findActiveByDomainMock.mockResolvedValue(null);

      await expect(service.authenticateByDomain('EMPRESA', 'jsilva', 'senha')).rejects.toThrow(HttpException);
    });

    test('provisions a new user on first successful authentication', async () => {
      findActiveByDomainMock.mockResolvedValue({ id: 'cfg-1' });
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({
        userDn: 'CN=Joao Silva,DC=empresa,DC=local',
        nome: 'Joao',
        sobrenome: 'Silva',
        email: 'joao@empresa.local',
        groupDns: ['CN=Elaboradores,DC=empresa,DC=local'],
        accountDisabled: false,
      });
      groupMappingFindManyMock.mockResolvedValue([{ groupDn: 'CN=Elaboradores,DC=empresa,DC=local', role: RoleName.ELABORADOR }]);
      userCreateMock.mockResolvedValue({
        id: 'user-2',
        matricula: 'ldap:unit-1:jsilva',
        nome: 'Joao',
        sobrenome: 'Silva',
        email: 'joao@empresa.local',
        role: RoleName.ELABORADOR,
        primaryUnitId: 'unit-1',
      });

      const result = await service.authenticateByDomain('EMPRESA', 'jsilva', 'senha');

      expect(userCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authSource: AuthSource.LDAP,
            primaryUnitId: 'unit-1',
            ldapConfigId: 'cfg-1',
            ldapUsername: 'jsilva',
            role: RoleName.ELABORADOR,
          }),
        }),
      );
      expect(result.role).toBe(RoleName.ELABORADOR);
    });

    test('throws generic UNAUTHORIZED when the user has no O/E/R group on first login', async () => {
      findActiveByDomainMock.mockResolvedValue({ id: 'cfg-1' });
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: [], accountDisabled: false, nome: 'Joao', sobrenome: 'Silva', email: 'joao@empresa.local' });
      groupMappingFindManyMock.mockResolvedValue([]);

      await expect(service.authenticateByDomain('EMPRESA', 'jsilva', 'senha')).rejects.toThrow(HttpException);
      expect(userCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('authenticateByUnit', () => {
    test('throws generic UNAUTHORIZED when every config of the unit fails', async () => {
      ldapConfigFindManyMock.mockResolvedValue([{ id: 'cfg-1' }, { id: 'cfg-2' }]);
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue(null);

      await expect(service.authenticateByUnit('unit-1', 'jsilva', 'senha')).rejects.toThrow(HttpException);
    });

    test('provisions against the first config of the unit that authenticates successfully', async () => {
      ldapConfigFindManyMock.mockResolvedValue([{ id: 'cfg-1' }, { id: 'cfg-2' }]);
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          userDn: 'CN=Joao Silva,DC=empresa,DC=local',
          nome: 'Joao',
          sobrenome: 'Silva',
          email: 'joao@empresa.local',
          groupDns: ['CN=Elaboradores,DC=empresa,DC=local'],
          accountDisabled: false,
        });
      groupMappingFindManyMock.mockResolvedValue([{ groupDn: 'CN=Elaboradores,DC=empresa,DC=local', role: RoleName.ELABORADOR }]);
      userCreateMock.mockResolvedValue({
        id: 'user-2',
        matricula: 'ldap:unit-1:jsilva',
        nome: 'Joao',
        sobrenome: 'Silva',
        email: 'joao@empresa.local',
        role: RoleName.ELABORADOR,
        primaryUnitId: 'unit-1',
      });

      const result = await service.authenticateByUnit('unit-1', 'jsilva', 'senha');

      expect(result.role).toBe(RoleName.ELABORADOR);
    });
  });
});
