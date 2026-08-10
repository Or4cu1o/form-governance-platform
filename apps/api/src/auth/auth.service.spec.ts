import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
const compareMock = bcrypt.compare as unknown as jest.Mock;

describe('AuthService', () => {
  let service: AuthService;
  let findActiveByIdentifierMock: jest.Mock;
  let signMock: jest.Mock;
  let findFirstUnitMock: jest.Mock;
  let findUniqueIpLockoutMock: jest.Mock;
  let upsertIpLockoutMock: jest.Mock;
  let runWithAuditContextMock: jest.Mock;
  let txUserUpdateMock: jest.Mock;

  const dbUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Teste',
    sobrenome: 'Usuario',
    email: 'teste@formops.local',
    passwordHash: 'hashed-password',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
    failedLoginAttempts: 0,
    accountLockedUntil: null as Date | null,
  };

  beforeEach(() => {
    findActiveByIdentifierMock = jest.fn();
    signMock = jest.fn().mockReturnValue('signed-jwt');
    findFirstUnitMock = jest.fn().mockResolvedValue(null);
    findUniqueIpLockoutMock = jest.fn().mockResolvedValue(null);
    upsertIpLockoutMock = jest.fn().mockResolvedValue(undefined);
    txUserUpdateMock = jest.fn().mockResolvedValue(undefined);
    runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) => fn({ user: { update: txUserUpdateMock } }));

    const usersService = { findActiveByIdentifier: findActiveByIdentifierMock } as unknown as UsersService;
    const jwtService = { sign: signMock } as unknown as JwtService;
    const prisma = {
      unit: { findFirst: findFirstUnitMock },
      ipLoginLockout: { findUnique: findUniqueIpLockoutMock, upsert: upsertIpLockoutMock },
    } as unknown as PrismaService;
    const auditContextService = { runWithAuditContext: runWithAuditContextMock } as unknown as AuditContextService;
    service = new AuthService(usersService, jwtService, prisma, auditContextService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateCredentials', () => {
    test('throws UnauthorizedException when no active user matches the identifier', async () => {
      findActiveByIdentifierMock.mockResolvedValue(null);

      await expect(service.validateCredentials('00000', 'any-password')).rejects.toThrow(UnauthorizedException);
    });

    test('throws UnauthorizedException when the password does not match the stored hash', async () => {
      findActiveByIdentifierMock.mockResolvedValue(dbUser);
      compareMock.mockResolvedValue(false);

      await expect(service.validateCredentials(dbUser.matricula, 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    test('returns the authenticated user without the passwordHash on valid credentials', async () => {
      findActiveByIdentifierMock.mockResolvedValue(dbUser);
      compareMock.mockResolvedValue(true);

      const result = await service.validateCredentials(dbUser.matricula, 'correct-password');

      expect(result).toEqual({
        id: dbUser.id,
        matricula: dbUser.matricula,
        nome: dbUser.nome,
        sobrenome: dbUser.sobrenome,
        email: dbUser.email,
        role: dbUser.role,
        primaryUnitId: dbUser.primaryUnitId,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    test('signs a JWT payload with sub/role/unitId and returns it alongside the user', () => {
      const user = {
        id: dbUser.id,
        matricula: dbUser.matricula,
        nome: dbUser.nome,
        sobrenome: dbUser.sobrenome,
        email: dbUser.email,
        role: dbUser.role,
        primaryUnitId: dbUser.primaryUnitId,
      };

      const result = service.login(user);

      expect(signMock).toHaveBeenCalledWith({ sub: user.id, role: user.role, unitId: user.primaryUnitId });
      expect(result).toEqual({ accessToken: 'signed-jwt', user });
    });
  });
});
