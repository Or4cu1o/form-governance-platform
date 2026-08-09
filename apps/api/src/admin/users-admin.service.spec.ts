import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersAdminService } from './users-admin.service';

jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));
const hashMock = bcrypt.hash as unknown as jest.Mock;

function buildUniqueConstraintError(target: string[]): Prisma.PrismaClientKnownRequestError {
  return Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: 'P2002',
    meta: { target },
    message: 'Unique constraint failed',
  });
}

describe('UsersAdminService', () => {
  let service: UsersAdminService;
  let findManyMock: jest.Mock;
  let findUniqueMock: jest.Mock;
  let createMock: jest.Mock;
  let updateMock: jest.Mock;
  let createUnitAccessMock: jest.Mock;
  let deleteManyUnitAccessMock: jest.Mock;
  let runWithAuditContextMock: jest.Mock;

  const createDto = {
    matricula: '10010',
    nome: 'Novo',
    sobrenome: 'Usuario',
    email: 'novo@formops.local',
    password: 'senha-forte-123',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
  };

  beforeEach(() => {
    findManyMock = jest.fn();
    findUniqueMock = jest.fn();
    createMock = jest.fn();
    updateMock = jest.fn();
    createUnitAccessMock = jest.fn();
    deleteManyUnitAccessMock = jest.fn();
    const prisma = {
      user: { findMany: findManyMock, findUnique: findUniqueMock },
      userUnitAccess: { deleteMany: deleteManyUnitAccessMock },
    } as unknown as PrismaService;
    runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) =>
      fn({ user: { create: createMock, update: updateMock }, userUnitAccess: { create: createUnitAccessMock } }),
    );
    const auditContextService = {
      runWithAuditContext: runWithAuditContextMock,
    } as unknown as AuditContextService;
    service = new UsersAdminService(prisma, auditContextService);
  });

  describe('create', () => {
    test('hashes the password before persisting and attaches extra unit accesses', async () => {
      createMock.mockResolvedValue({ id: 'user-new' });

      await service.create({ ...createDto, extraUnitIds: ['unit-2', 'unit-3'] });

      expect(hashMock).toHaveBeenCalledWith(createDto.password, 10);
      const callArgs = createMock.mock.calls[0][0];
      expect(callArgs.data.passwordHash).toBe('hashed-password');
      expect(callArgs.data.password).toBeUndefined();
      expect(callArgs.data.unitAccesses).toEqual({
        create: [{ unitId: 'unit-2' }, { unitId: 'unit-3' }],
      });
    });

    test('translates a duplicate matricula/email into ConflictException', async () => {
      createMock.mockRejectedValue(buildUniqueConstraintError(['matricula']));

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    test('throws NotFoundException when the user does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.update('missing', { nome: 'X' })).rejects.toThrow(NotFoundException);
    });

    test('translates a duplicate email into ConflictException on update', async () => {
      findUniqueMock.mockResolvedValue({ id: 'user-1' });
      updateMock.mockRejectedValue(buildUniqueConstraintError(['email']));

      await expect(service.update('user-1', { email: 'duplicado@formops.local' })).rejects.toThrow(ConflictException);
    });

    // T095/FR-074: promover para Aprovador sem cargo cadastrado e recusado —
    // o cargo e estampado no documento selado, entao PartialType (que torna
    // jobTitle sempre opcional no DTO de update) nao pode ser a unica defesa.
    test('rejects promoting a user to Aprovador without an existing or provided jobTitle', async () => {
      findUniqueMock.mockResolvedValue({ id: 'user-1', role: RoleName.ELABORADOR, jobTitle: null });

      await expect(service.update('user-1', { role: RoleName.APROVADOR })).rejects.toThrow(BadRequestException);
      expect(updateMock).not.toHaveBeenCalled();
    });

    test('allows promoting to Aprovador when jobTitle is provided in the same update', async () => {
      findUniqueMock.mockResolvedValue({ id: 'user-1', role: RoleName.ELABORADOR, jobTitle: null });
      updateMock.mockResolvedValue({ id: 'user-1', role: RoleName.APROVADOR, jobTitle: 'Chefe de Gabinete' });

      await service.update('user-1', { role: RoleName.APROVADOR, jobTitle: 'Chefe de Gabinete' });

      expect(updateMock).toHaveBeenCalled();
    });

    test('allows updating an existing Aprovador who already has a jobTitle without resending it', async () => {
      findUniqueMock.mockResolvedValue({ id: 'user-1', role: RoleName.APROVADOR, jobTitle: 'Chefe de Gabinete' });
      updateMock.mockResolvedValue({ id: 'user-1' });

      await service.update('user-1', { nome: 'Novo Nome' });

      expect(updateMock).toHaveBeenCalled();
    });
  });

  describe('setActive', () => {
    // T093/US5-1: desativar e um UPDATE de isActive, nunca uma exclusao —
    // findOne (sem filtro de isActive) continua resolvendo o mesmo registro
    // depois, o que preserva a autoria legivel no acervo (respostas,
    // submissoes e vereditos historicos continuam apontando para este id).
    test('deactivates via update, not deletion — the user remains findable afterward', async () => {
      findUniqueMock.mockResolvedValue({ id: 'user-1' });
      updateMock.mockResolvedValue({ id: 'user-1', isActive: false });

      await service.setActive('user-1', false);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
        select: expect.anything(),
      });

      findUniqueMock.mockResolvedValue({ id: 'user-1', isActive: false });
      await expect(service.findOne('user-1')).resolves.toEqual({ id: 'user-1', isActive: false });
    });
  });

  // T094/US5-5: toda alteracao administrativa passa por runWithAuditContext,
  // o que ativa o gatilho fn_write_audit_log (T167) — e ele quem grava autor,
  // data e os valores anterior/novo em audit.audit_logs a partir do UPDATE.
  test('routes create, update, resetPassword and setActive through the audited transaction', async () => {
    createMock.mockResolvedValue({ id: 'user-9' });
    await service.create(createDto);
    expect(runWithAuditContextMock).toHaveBeenCalledTimes(1);

    findUniqueMock.mockResolvedValue({ id: 'user-9', role: RoleName.ELABORADOR, jobTitle: null });
    updateMock.mockResolvedValue({ id: 'user-9', nome: 'Renomeado' });
    await service.update('user-9', { nome: 'Renomeado' });
    expect(runWithAuditContextMock).toHaveBeenCalledTimes(2);

    await service.resetPassword('user-9', 'nova-senha-123');
    expect(runWithAuditContextMock).toHaveBeenCalledTimes(3);

    await service.setActive('user-9', false);
    expect(runWithAuditContextMock).toHaveBeenCalledTimes(4);
  });

  describe('resetPassword', () => {
    test('throws NotFoundException when the user does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.resetPassword('missing', 'nova-senha')).rejects.toThrow(NotFoundException);
    });

    test('hashes and persists the new password for an existing user', async () => {
      findUniqueMock.mockResolvedValue({ id: 'user-1' });

      const result = await service.resetPassword('user-1', 'nova-senha-123');

      expect(hashMock).toHaveBeenCalledWith('nova-senha-123', 10);
      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { passwordHash: 'hashed-password' } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('grantUnitAccess', () => {
    test('throws NotFoundException when the user does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.grantUnitAccess('missing', 'unit-2')).rejects.toThrow(NotFoundException);
    });

    test('throws ConflictException when the user already has access to the unit', async () => {
      findUniqueMock.mockResolvedValue({ id: 'user-1' });
      createUnitAccessMock.mockRejectedValue(buildUniqueConstraintError(['userId', 'unitId']));

      await expect(service.grantUnitAccess('user-1', 'unit-2')).rejects.toThrow(ConflictException);
    });

    test('grants access and returns the refreshed user', async () => {
      findUniqueMock.mockResolvedValueOnce({ id: 'user-1' }).mockResolvedValueOnce({ id: 'user-1' });

      await service.grantUnitAccess('user-1', 'unit-2');

      expect(createUnitAccessMock).toHaveBeenCalledWith({ data: { userId: 'user-1', unitId: 'unit-2' } });
    });
  });

  describe('revokeUnitAccess', () => {
    test('throws NotFoundException when the user does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.revokeUnitAccess('missing', 'unit-2')).rejects.toThrow(NotFoundException);
    });

    test('removes the unit access grant for an existing user', async () => {
      findUniqueMock.mockResolvedValue({ id: 'user-1' });

      await service.revokeUnitAccess('user-1', 'unit-2');

      expect(deleteManyUnitAccessMock).toHaveBeenCalledWith({ where: { userId: 'user-1', unitId: 'unit-2' } });
    });
  });
});
