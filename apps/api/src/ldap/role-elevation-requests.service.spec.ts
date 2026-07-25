import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ElevationStatus, RoleName } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

describe('RoleElevationRequestsService', () => {
  let service: RoleElevationRequestsService;
  let findManyMock: jest.Mock;
  let findUniqueMock: jest.Mock;
  let findFirstMock: jest.Mock;
  let createMock: jest.Mock;
  let updateManyMock: jest.Mock;
  let userUpdateMock: jest.Mock;
  let userFindUniqueMock: jest.Mock;
  let runWithAuditActorMock: jest.Mock;
  let notifyMock: jest.Mock;

  const reviewer = { id: 'admin-1' } as unknown as import('../auth/types/authenticated-user.interface').AuthenticatedUser;

  beforeEach(() => {
    findManyMock = jest.fn();
    findUniqueMock = jest.fn();
    findFirstMock = jest.fn();
    createMock = jest.fn();
    updateManyMock = jest.fn();
    userUpdateMock = jest.fn();
    userFindUniqueMock = jest.fn();
    notifyMock = jest.fn().mockResolvedValue(undefined);
    runWithAuditActorMock = jest.fn((_userId: string, fn: (tx: unknown) => unknown) =>
      fn({
        user: { update: userUpdateMock },
        roleElevationRequest: { update: jest.fn().mockResolvedValue({ id: 'req-1', status: ElevationStatus.APPROVED }) },
      }),
    );
    const prisma = {
      roleElevationRequest: { findMany: findManyMock, findUnique: findUniqueMock, findFirst: findFirstMock, create: createMock, updateMany: updateManyMock },
      user: { findUnique: userFindUniqueMock },
      runWithAuditActor: runWithAuditActorMock,
    } as unknown as PrismaService;
    const notificationsService = { notifyElevationRequested: notifyMock } as unknown as NotificationsService;
    service = new RoleElevationRequestsService(prisma, notificationsService);
  });

  describe('approve', () => {
    test('throws NotFoundException when the request does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.approve('req-1', reviewer)).rejects.toThrow(NotFoundException);
    });

    test('throws ForbiddenException when the request was already reviewed', async () => {
      findUniqueMock.mockResolvedValue({ id: 'req-1', status: ElevationStatus.APPROVED, userId: 'user-1', requestedRole: RoleName.ADMINISTRADOR });

      await expect(service.approve('req-1', reviewer)).rejects.toThrow(ForbiddenException);
    });

    test('promotes the user role and marks the request as APPROVED inside runWithAuditActor', async () => {
      findUniqueMock.mockResolvedValue({ id: 'req-1', status: ElevationStatus.PENDING, userId: 'user-1', requestedRole: RoleName.ADMINISTRADOR });

      await service.approve('req-1', reviewer);

      expect(runWithAuditActorMock).toHaveBeenCalledWith('admin-1', expect.any(Function));
      expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { role: RoleName.ADMINISTRADOR } });
    });
  });

  describe('reject', () => {
    test('throws NotFoundException when the request does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.reject('req-1', reviewer)).rejects.toThrow(NotFoundException);
    });
  });

  describe('ensurePendingRequest', () => {
    test('does nothing when an identical pending request already exists', async () => {
      findFirstMock.mockResolvedValue({ id: 'existing' });

      await service.ensurePendingRequest('user-1', RoleName.ADMINISTRADOR, 'CN=Admins,DC=empresa,DC=local');

      expect(createMock).not.toHaveBeenCalled();
      expect(notifyMock).not.toHaveBeenCalled();
    });

    test('creates the request and notifies administrators when none is pending', async () => {
      findFirstMock.mockResolvedValue(null);
      userFindUniqueMock.mockResolvedValue({ id: 'user-1', nome: 'Joao', sobrenome: 'Silva', matricula: '12345' });

      await service.ensurePendingRequest('user-1', RoleName.ADMINISTRADOR, 'CN=Admins,DC=empresa,DC=local');

      expect(createMock).toHaveBeenCalledWith({
        data: { userId: 'user-1', requestedRole: RoleName.ADMINISTRADOR, sourceGroupDn: 'CN=Admins,DC=empresa,DC=local' },
      });
      expect(notifyMock).toHaveBeenCalledWith(
        { id: 'user-1', nome: 'Joao', sobrenome: 'Silva', matricula: '12345' },
        RoleName.ADMINISTRADOR,
      );
    });
  });

  describe('revokeStalePendingRequests', () => {
    test('marks pending requests outside the eligible roles as REVOKED', async () => {
      await service.revokeStalePendingRequests('user-1', [RoleName.APROVADOR]);

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: ElevationStatus.PENDING, requestedRole: { notIn: [RoleName.APROVADOR] } },
        data: { status: ElevationStatus.REVOKED },
      });
    });
  });
});
