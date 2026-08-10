import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ACCOUNT_LOCKOUT_THRESHOLD, IP_LOCKOUT_THRESHOLD } from './account-lockout.constants';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
const compareMock = bcrypt.compare as unknown as jest.Mock;

// T159 (FR-009, SC-017, quickstart V16): o bloqueio automatico recai
// primariamente sobre a conta — o endereco de origem so e uma camada
// secundaria, com limiar bem mais alto e sujeita a lista de excecao das
// unidades. Estes testes isolam essa politica do restante de
// AuthService.validateCredentials (ja coberto por auth.service.spec.ts).
describe('AuthService — bloqueio automatico (T159)', () => {
  let service: AuthService;
  let findActiveByIdentifierMock: jest.Mock;
  let findFirstUnitMock: jest.Mock;
  let findUniqueIpLockoutMock: jest.Mock;
  let upsertIpLockoutMock: jest.Mock;
  let runWithAuditContextMock: jest.Mock;
  let txUserUpdateMock: jest.Mock;

  function buildUser(overrides: { id?: string; failedLoginAttempts?: number; accountLockedUntil?: Date | null } = {}) {
    return {
      id: overrides.id ?? 'user-1',
      matricula: '10001',
      nome: 'Teste',
      sobrenome: 'Usuario',
      email: 'teste@formops.local',
      passwordHash: 'hashed-password',
      role: RoleName.ELABORADOR,
      primaryUnitId: 'unit-1',
      failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
      accountLockedUntil: overrides.accountLockedUntil ?? null,
    };
  }

  beforeEach(() => {
    findActiveByIdentifierMock = jest.fn();
    findFirstUnitMock = jest.fn().mockResolvedValue(null);
    findUniqueIpLockoutMock = jest.fn().mockResolvedValue(null);
    upsertIpLockoutMock = jest.fn().mockResolvedValue(undefined);
    txUserUpdateMock = jest.fn().mockResolvedValue(undefined);
    runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) => fn({ user: { update: txUserUpdateMock } }));

    const usersService = { findActiveByIdentifier: findActiveByIdentifierMock } as unknown as UsersService;
    const jwtService = { sign: jest.fn() } as unknown as JwtService;
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

  test('locks the account after reaching the failure threshold, and blocks even with the correct password while locked', async () => {
    findActiveByIdentifierMock.mockResolvedValue(buildUser({ failedLoginAttempts: ACCOUNT_LOCKOUT_THRESHOLD - 1 }));
    compareMock.mockResolvedValue(false);

    await expect(service.validateCredentials('10001', 'errada', '198.51.100.1')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(txUserUpdateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: ACCOUNT_LOCKOUT_THRESHOLD, accountLockedUntil: expect.any(Date) },
    });

    // Mesmo com a senha certa, a conta bloqueada rejeita — nao chega a
    // comparar a senha.
    findActiveByIdentifierMock.mockResolvedValue(
      buildUser({ failedLoginAttempts: ACCOUNT_LOCKOUT_THRESHOLD, accountLockedUntil: new Date(Date.now() + 60_000) }),
    );
    compareMock.mockClear();

    await expect(service.validateCredentials('10001', 'correta', '198.51.100.1')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(compareMock).not.toHaveBeenCalled();
  });

  test('a second user at the same shared unit address keeps authenticating while only the failing account is locked (quickstart V16)', async () => {
    // O outro usuario da mesma unidade, mesmo endereco publico, nao tem
    // failedLoginAttempts/accountLockedUntil elevados — a conta dele nao foi
    // tocada pela falha do primeiro.
    findActiveByIdentifierMock.mockResolvedValue(buildUser({ id: 'user-2' }));
    compareMock.mockResolvedValue(true);

    await expect(service.validateCredentials('10002', 'senha-correta', '198.51.100.1')).resolves.toMatchObject({
      id: 'user-2',
    });
  });

  test('resets the counter and lock on the next successful login', async () => {
    findActiveByIdentifierMock.mockResolvedValue(
      buildUser({ failedLoginAttempts: 2, accountLockedUntil: new Date(Date.now() - 1000) }),
    );
    compareMock.mockResolvedValue(true);

    await service.validateCredentials('10001', 'correta');

    expect(txUserUpdateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: 0, accountLockedUntil: null },
    });
  });

  test('does not touch the account row when there is nothing to reset', async () => {
    findActiveByIdentifierMock.mockResolvedValue(buildUser());
    compareMock.mockResolvedValue(true);

    await service.validateCredentials('10001', 'correta');

    expect(txUserUpdateMock).not.toHaveBeenCalled();
  });

  test('locks the source address as a secondary layer after its own, much higher, threshold', async () => {
    findActiveByIdentifierMock.mockResolvedValue(buildUser());
    compareMock.mockResolvedValue(false);
    findUniqueIpLockoutMock.mockResolvedValue({ sourceIp: '198.51.100.1', failedAttempts: IP_LOCKOUT_THRESHOLD - 1 });

    await expect(service.validateCredentials('10001', 'errada', '198.51.100.1')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(upsertIpLockoutMock).toHaveBeenCalledWith({
      where: { sourceIp: '198.51.100.1' },
      create: { sourceIp: '198.51.100.1', failedAttempts: IP_LOCKOUT_THRESHOLD, lockedUntil: expect.any(Date) },
      update: { failedAttempts: IP_LOCKOUT_THRESHOLD, lockedUntil: expect.any(Date) },
    });
  });

  test('rejects immediately once the source address is locked, without querying the account at all', async () => {
    findUniqueIpLockoutMock.mockResolvedValue({ sourceIp: '198.51.100.1', lockedUntil: new Date(Date.now() + 60_000) });

    await expect(service.validateCredentials('10001', 'qualquer', '198.51.100.1')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findActiveByIdentifierMock).not.toHaveBeenCalled();
  });

  test('never locks an address listed as a known unit egress IP — only the account layer applies to it', async () => {
    findFirstUnitMock.mockResolvedValue({ id: 'unit-1' });
    findActiveByIdentifierMock.mockResolvedValue(buildUser());
    compareMock.mockResolvedValue(false);

    await expect(service.validateCredentials('10001', 'errada', '198.51.100.1')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(findFirstUnitMock).toHaveBeenCalledWith({
      where: { knownEgressIps: { has: '198.51.100.1' } },
      select: { id: true },
    });
    expect(findUniqueIpLockoutMock).not.toHaveBeenCalled();
    expect(upsertIpLockoutMock).not.toHaveBeenCalled();
    // A camada por conta continua valendo mesmo para o endereco isento.
    expect(txUserUpdateMock).toHaveBeenCalled();
  });

  test('does not perform any IP bookkeeping when sourceIp is not provided (non-HTTP callers)', async () => {
    findActiveByIdentifierMock.mockResolvedValue(buildUser());
    compareMock.mockResolvedValue(false);

    await expect(service.validateCredentials('10001', 'errada')).rejects.toThrow(UnauthorizedException);

    expect(findFirstUnitMock).not.toHaveBeenCalled();
    expect(findUniqueIpLockoutMock).not.toHaveBeenCalled();
  });
});
