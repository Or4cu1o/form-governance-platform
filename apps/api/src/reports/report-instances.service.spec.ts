import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IndicatorValidationStatus, ReportStatus, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UnitAccessService } from '../common/services/unit-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportInstancesService } from './report-instances.service';
import { ReportLifecycleService } from '../lifecycle/report-lifecycle.service';

describe('ReportInstancesService', () => {
  let service: ReportInstancesService;
  let openPeriodForUnitMock: jest.Mock;
  let findManyMock: jest.Mock;
  let findUniqueMock: jest.Mock;
  let findUniqueUnitMock: jest.Mock;
  let updateMock: jest.Mock;
  let updateManyMock: jest.Mock;
  let transactionMock: jest.Mock;
  let hasOrgWideReadAccessMock: jest.Mock;
  let getAccessibleUnitIdsMock: jest.Mock;
  let assertReadAccessMock: jest.Mock;
  let notifySubmittedForReviewMock: jest.Mock;
  let notifySubmittedForApprovalMock: jest.Mock;

  const elaborador: AuthenticatedUser = {
    id: 'elaborador-1',
    matricula: '10002',
    nome: 'Elias',
    sobrenome: 'Elaborador',
    email: 'elaborador@formops.local',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
  };
  const revisor: AuthenticatedUser = { ...elaborador, id: 'revisor-1', role: RoleName.REVISOR };

  beforeEach(() => {
    findManyMock = jest.fn();
    findUniqueMock = jest.fn();
    updateMock = jest.fn();
    updateManyMock = jest.fn();
    transactionMock = jest.fn(async (_userId: string, fn: (tx: unknown) => unknown) =>
      fn({ indicatorResponse: { updateMany: updateManyMock }, reportInstance: { update: updateMock } }),
    );
    hasOrgWideReadAccessMock = jest.fn();
    getAccessibleUnitIdsMock = jest.fn();
    assertReadAccessMock = jest.fn();
    notifySubmittedForReviewMock = jest.fn();
    notifySubmittedForApprovalMock = jest.fn();
    openPeriodForUnitMock = jest.fn();
    findUniqueUnitMock = jest.fn();

    const prisma = {
      reportInstance: { findMany: findManyMock, findUnique: findUniqueMock, update: updateMock },
      unit: { findUnique: findUniqueUnitMock },
      runWithAuditActor: transactionMock,
    } as unknown as PrismaService;

    const unitAccessService = {
      hasOrgWideReadAccess: hasOrgWideReadAccessMock,
      getAccessibleUnitIds: getAccessibleUnitIdsMock,
      assertReadAccess: assertReadAccessMock,
    } as unknown as UnitAccessService;

    const notificationsService = {
      notifySubmittedForReview: notifySubmittedForReviewMock,
      notifySubmittedForApproval: notifySubmittedForApprovalMock,
    } as unknown as NotificationsService;

    const reportLifecycleService = {
      openPeriodForUnit: openPeriodForUnitMock,
    } as unknown as ReportLifecycleService;

    service = new ReportInstancesService(prisma, unitAccessService, notificationsService, reportLifecycleService);
  });

  describe('findAllForUser', () => {
    test('scopes the query to accessible units for a non-org-wide user', async () => {
      hasOrgWideReadAccessMock.mockReturnValue(false);
      getAccessibleUnitIdsMock.mockResolvedValue(['unit-1', 'unit-2']);
      findManyMock.mockResolvedValue([]);

      await service.findAllForUser(elaborador);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ unitId: { in: ['unit-1', 'unit-2'] } }) }),
      );
    });

    test('does not scope by unit for an org-wide user', async () => {
      hasOrgWideReadAccessMock.mockReturnValue(true);
      findManyMock.mockResolvedValue([]);

      await service.findAllForUser({ ...elaborador, role: RoleName.ADMINISTRADOR });

      expect(getAccessibleUnitIdsMock).not.toHaveBeenCalled();
      const callArgs = findManyMock.mock.calls[0][0];
      expect(callArgs.where.unitId).toBeUndefined();
    });

    test('returns an empty list without querying the database when the unitId filter is outside the caller accessible units', async () => {
      hasOrgWideReadAccessMock.mockReturnValue(false);
      getAccessibleUnitIdsMock.mockResolvedValue(['unit-1', 'unit-2']);

      const result = await service.findAllForUser(elaborador, { unitId: 'unit-outra-organizacao' });

      expect(result).toEqual([]);
      expect(findManyMock).not.toHaveBeenCalled();
    });

    test('applies the requested unitId filter as-is (not widened back to the full scope) when it is within the caller accessible units', async () => {
      hasOrgWideReadAccessMock.mockReturnValue(false);
      getAccessibleUnitIdsMock.mockResolvedValue(['unit-1', 'unit-2']);
      findManyMock.mockResolvedValue([]);

      await service.findAllForUser(elaborador, { unitId: 'unit-2' });

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ unitId: 'unit-2' }) }),
      );
    });
  });

  describe('findOverviewForAllUnits', () => {
    test('does not scope by unit access — returns data from every unit regardless of caller', async () => {
      findManyMock.mockResolvedValue([]);

      await service.findOverviewForAllUnits();

      expect(hasOrgWideReadAccessMock).not.toHaveBeenCalled();
      expect(getAccessibleUnitIdsMock).not.toHaveBeenCalled();
      const callArgs = findManyMock.mock.calls[0][0];
      expect(callArgs.where.unitId).toBeUndefined();
    });

    test('does not select indicatorResponses (informational summary only)', async () => {
      findManyMock.mockResolvedValue([]);

      await service.findOverviewForAllUnits();

      const callArgs = findManyMock.mock.calls[0][0];
      expect(callArgs.select).not.toHaveProperty('indicatorResponses');
      expect(callArgs.select).toMatchObject({ totalScore: true, status: true });
    });

    test('applies the unitId filter when provided', async () => {
      findManyMock.mockResolvedValue([]);

      await service.findOverviewForAllUnits({ unitId: 'unit-9' });

      const callArgs = findManyMock.mock.calls[0][0];
      expect(callArgs.where.unitId).toBe('unit-9');
    });
  });

  describe('findOneForUser', () => {
    test('throws NotFoundException when the report does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.findOneForUser('missing', elaborador)).rejects.toThrow(NotFoundException);
    });

    test('enforces read access scoping before returning the report', async () => {
      findUniqueMock.mockResolvedValue({ id: 'report-1', unitId: 'unit-1' });

      await service.findOneForUser('report-1', elaborador);

      expect(assertReadAccessMock).toHaveBeenCalledWith('unit-1', elaborador);
    });
  });

  describe('submitForReview', () => {
    test('throws ForbiddenException when the caller is not the ELABORADOR of the report unit', async () => {
      findUniqueMock.mockResolvedValue({ id: 'report-1', unitId: 'unit-1', status: ReportStatus.PENDENTE });

      await expect(service.submitForReview('report-1', revisor)).rejects.toThrow(ForbiddenException);
    });

    test('throws BadRequestException when the report is not PENDENTE', async () => {
      findUniqueMock.mockResolvedValue({ id: 'report-1', unitId: 'unit-1', status: ReportStatus.EM_REVISAO });

      await expect(service.submitForReview('report-1', elaborador)).rejects.toThrow(BadRequestException);
    });

    test('transitions PENDENTE -> EM_REVISAO and notifies the review team', async () => {
      findUniqueMock.mockResolvedValue({ id: 'report-1', unitId: 'unit-1', status: ReportStatus.PENDENTE });
      updateMock.mockResolvedValue({ id: 'report-1', status: ReportStatus.EM_REVISAO, unit: { id: 'unit-1' } });

      await service.submitForReview('report-1', elaborador);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: { status: ReportStatus.EM_REVISAO, submittedForReviewAt: expect.any(Date) },
        include: { unit: true },
      });
      expect(notifySubmittedForReviewMock).toHaveBeenCalled();
    });
  });

  describe('submitForApproval', () => {
    test('throws NotFoundException when the report does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.submitForApproval('missing', revisor)).rejects.toThrow(NotFoundException);
    });

    test('throws ForbiddenException when the caller is not the REVISOR of the report unit', async () => {
      findUniqueMock.mockResolvedValue({ id: 'report-1', unitId: 'unit-1', status: ReportStatus.EM_REVISAO, unit: {} });

      await expect(service.submitForApproval('report-1', elaborador)).rejects.toThrow(ForbiddenException);
    });

    test('throws BadRequestException when the report is not EM_REVISAO', async () => {
      findUniqueMock.mockResolvedValue({ id: 'report-1', unitId: 'unit-1', status: ReportStatus.PENDENTE, unit: {} });

      await expect(service.submitForApproval('report-1', revisor)).rejects.toThrow(BadRequestException);
    });

    test('marks indicators PENDENTE_VALIDACAO, transitions to PENDENTE_APROVACAO, and notifies aprovadores', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'report-1',
        unitId: 'unit-1',
        status: ReportStatus.EM_REVISAO,
        unit: { id: 'unit-1' },
      });
      updateMock.mockResolvedValue({ id: 'report-1', status: ReportStatus.PENDENTE_APROVACAO });

      await service.submitForApproval('report-1', revisor);

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { reportInstanceId: 'report-1' },
        data: { validationStatus: IndicatorValidationStatus.PENDENTE_VALIDACAO },
      });
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: { status: ReportStatus.PENDENTE_APROVACAO, submittedForApprovalAt: expect.any(Date) },
      });
      expect(notifySubmittedForApprovalMock).toHaveBeenCalled();
    });
  });

  describe('startCurrentPeriodForElaborador', () => {
    test('throws NotFoundException if the user primary unit is not found', async () => {
      findUniqueUnitMock.mockResolvedValue(null);

      await expect(service.startCurrentPeriodForElaborador(elaborador)).rejects.toThrow(NotFoundException);
    });

    test('throws BadRequestException if the unit is inactive', async () => {
      findUniqueUnitMock.mockResolvedValue({ id: 'unit-1', isActive: false });

      await expect(service.startCurrentPeriodForElaborador(elaborador)).rejects.toThrow(BadRequestException);
    });

    test('throws BadRequestException if the unit does not have a form template', async () => {
      findUniqueUnitMock.mockResolvedValue({ id: 'unit-1', isActive: true, formTemplateId: null });

      await expect(service.startCurrentPeriodForElaborador(elaborador)).rejects.toThrow(BadRequestException);
    });

    test('opens the period for the unit and returns the created report instance', async () => {
      const mockUnit = { id: 'unit-1', isActive: true, formTemplateId: 'template-1' };
      findUniqueUnitMock.mockResolvedValue(mockUnit);
      openPeriodForUnitMock.mockResolvedValue({ id: 'report-new', status: ReportStatus.PENDENTE });

      const result = await service.startCurrentPeriodForElaborador(elaborador);

      expect(findUniqueUnitMock).toHaveBeenCalledWith({ where: { id: 'unit-1' } });
      expect(openPeriodForUnitMock).toHaveBeenCalledWith(mockUnit, expect.any(Date));
      expect(result).toEqual({ id: 'report-new', status: ReportStatus.PENDENTE });
    });
  });
});
