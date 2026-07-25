import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthSource, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LdapAuthService, UnitSelectionRequiredException } from '../ldap/ldap-auth.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
const compareMock = bcrypt.compare as unknown as jest.Mock;

describe('AuthService', () => {
  let service: AuthService;
  let findActiveByIdentifierMock: jest.Mock;
  let signMock: jest.Mock;
  let authenticateExistingLdapUserMock: jest.Mock;
  let authenticateByDomainMock: jest.Mock;
  let authenticateByUnitMock: jest.Mock;
  let listBootstrapUnitsMock: jest.Mock;

  const localUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Teste',
    sobrenome: 'Usuario',
    email: 'teste@formops.local',
    passwordHash: 'hashed-password',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
    authSource: AuthSource.LOCAL,
  };

  const ldapUser = { ...localUser, id: 'user-2', authSource: AuthSource.LDAP, passwordHash: null };

  beforeEach(() => {
    findActiveByIdentifierMock = jest.fn();
    signMock = jest.fn().mockReturnValue('signed-jwt');
    authenticateExistingLdapUserMock = jest.fn();
    authenticateByDomainMock = jest.fn();
    authenticateByUnitMock = jest.fn();
    listBootstrapUnitsMock = jest.fn().mockResolvedValue([]);

    const usersService = { findActiveByIdentifier: findActiveByIdentifierMock } as unknown as UsersService;
    const jwtService = { sign: signMock } as unknown as JwtService;
    const ldapAuthService = {
      authenticateExistingLdapUser: authenticateExistingLdapUserMock,
      authenticateByDomain: authenticateByDomainMock,
      authenticateByUnit: authenticateByUnitMock,
      listBootstrapUnits: listBootstrapUnitsMock,
    } as unknown as LdapAuthService;

    service = new AuthService(usersService, jwtService, ldapAuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('authenticate — usuario local existente', () => {
    test('throws UnauthorizedException when the password does not match', async () => {
      findActiveByIdentifierMock.mockResolvedValue(localUser);
      compareMock.mockResolvedValue(false);

      await expect(service.authenticate({ identifier: '10001', password: 'errada' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    test('returns the authenticated user on valid local credentials', async () => {
      findActiveByIdentifierMock.mockResolvedValue(localUser);
      compareMock.mockResolvedValue(true);

      const result = await service.authenticate({ identifier: '10001', password: 'correta' });

      expect(result.id).toBe('user-1');
      expect(authenticateExistingLdapUserMock).not.toHaveBeenCalled();
    });
  });

  describe('authenticate — usuario LDAP ja provisionado', () => {
    test('delegates to LdapAuthService.authenticateExistingLdapUser, never trying other configs', async () => {
      findActiveByIdentifierMock.mockResolvedValue(ldapUser);
      authenticateExistingLdapUserMock.mockResolvedValue({ id: 'user-2' });

      await service.authenticate({ identifier: 'jsilva', password: 'senha' });

      expect(authenticateExistingLdapUserMock).toHaveBeenCalledWith(ldapUser, 'senha');
      expect(authenticateByDomainMock).not.toHaveBeenCalled();
      expect(authenticateByUnitMock).not.toHaveBeenCalled();
    });
  });

  describe('authenticate — identifier com dominio, usuario ainda nao provisionado', () => {
    test('delegates to LdapAuthService.authenticateByDomain', async () => {
      findActiveByIdentifierMock.mockResolvedValue(null);
      authenticateByDomainMock.mockResolvedValue({ id: 'user-3' });

      await service.authenticate({ identifier: 'EMPRESA\\jsilva', password: 'senha' });

      expect(authenticateByDomainMock).toHaveBeenCalledWith('EMPRESA', 'jsilva', 'senha');
    });
  });

  describe('authenticate — usuario nao encontrado, sem dominio, sem unitId', () => {
    test('throws UnitSelectionRequiredException with the bootstrap unit list', async () => {
      findActiveByIdentifierMock.mockResolvedValue(null);
      listBootstrapUnitsMock.mockResolvedValue([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);

      await expect(service.authenticate({ identifier: 'jsilva', password: 'senha' })).rejects.toBeInstanceOf(
        UnitSelectionRequiredException,
      );
    });
  });

  describe('authenticate — usuario nao encontrado, sem dominio, com unitId', () => {
    test('delegates to LdapAuthService.authenticateByUnit', async () => {
      findActiveByIdentifierMock.mockResolvedValue(null);
      authenticateByUnitMock.mockResolvedValue({ id: 'user-4' });

      await service.authenticate({ identifier: 'jsilva', password: 'senha', unitId: 'unit-1' });

      expect(authenticateByUnitMock).toHaveBeenCalledWith('unit-1', 'jsilva', 'senha');
    });
  });

  describe('login', () => {
    test('signs a JWT payload with sub/role/unitId and returns it alongside the user', () => {
      const user = {
        id: localUser.id,
        matricula: localUser.matricula,
        nome: localUser.nome,
        sobrenome: localUser.sobrenome,
        email: localUser.email,
        role: localUser.role,
        primaryUnitId: localUser.primaryUnitId,
      };

      const result = service.login(user);

      expect(signMock).toHaveBeenCalledWith({ sub: user.id, role: user.role, unitId: user.primaryUnitId });
      expect(result).toEqual({ accessToken: 'signed-jwt', user });
    });
  });
});
