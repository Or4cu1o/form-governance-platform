import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GoalOperator, ReportStatus, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { IndicatorResponsesService } from './indicator-responses.service';

describe('IndicatorResponsesService', () => {
  let service: IndicatorResponsesService;
  let findUniqueMock: jest.Mock;
  let runWithAuditContextMock: jest.Mock;
  let txUpdateMock: jest.Mock;

  const elaborador: AuthenticatedUser = {
    id: 'elaborador-1',
    matricula: '10002',
    nome: 'Elias',
    sobrenome: 'Elaborador',
    email: 'elaborador@formops.local',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
  };

  const baseResponse = {
    id: 'response-1',
    reportInstance: { id: 'report-1', unitId: 'unit-1', status: ReportStatus.PENDENTE },
    snapshotVariableKeys: ['CA', 'CB'],
    snapshotFormulaExpression: '(CB / CA) * 100',
    snapshotGoalOperator: GoalOperator.LTE,
    snapshotGoalValue: 5,
    variableValues: {},
  };

  beforeEach(() => {
    findUniqueMock = jest.fn();
    txUpdateMock = jest.fn().mockResolvedValue({ id: 'response-1' });
    runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) =>
      fn({ indicatorResponse: { update: txUpdateMock } }),
    );
    const prisma = {
      indicatorResponse: { findUnique: findUniqueMock },
    } as unknown as PrismaService;
    const auditContextService = {
      runWithAuditContext: runWithAuditContextMock,
    } as unknown as AuditContextService;
    service = new IndicatorResponsesService(prisma, auditContextService);
  });

  test('throws NotFoundException when the indicator response does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(service.updateValues('missing', elaborador, { variableValues: { CA: 1 } })).rejects.toThrow(
      NotFoundException,
    );
  });

  test('throws ForbiddenException when the caller cannot edit the report in its current state', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseResponse,
      reportInstance: { ...baseResponse.reportInstance, status: ReportStatus.EM_REVISAO },
    });

    await expect(service.updateValues('response-1', elaborador, { variableValues: { CA: 1 } })).rejects.toThrow(
      ForbiddenException,
    );
  });

  test('throws BadRequestException when the payload references an undeclared variable key', async () => {
    findUniqueMock.mockResolvedValue(baseResponse);

    await expect(service.updateValues('response-1', elaborador, { variableValues: { UNKNOWN: 1 } })).rejects.toThrow(
      BadRequestException,
    );
  });

  test('throws BadRequestException when a value is not a finite number', async () => {
    findUniqueMock.mockResolvedValue(baseResponse);

    await expect(
      service.updateValues('response-1', elaborador, { variableValues: { CA: Number.NaN } }),
    ).rejects.toThrow(BadRequestException);
  });

  test('persists a partial update without calculating when not all variables are answered yet', async () => {
    findUniqueMock.mockResolvedValue(baseResponse);

    await service.updateValues('response-1', elaborador, { variableValues: { CA: 10 } });

    expect(txUpdateMock).toHaveBeenCalledWith({
      where: { id: 'response-1' },
      data: { variableValues: { CA: 10 }, calculatedValue: null, isCompliant: null, updatedByUserId: elaborador.id },
    });
  });

  test('calculates the formula and compliance once every declared variable has a value', async () => {
    findUniqueMock.mockResolvedValue({ ...baseResponse, variableValues: { CA: 10 } });

    await service.updateValues('response-1', elaborador, { variableValues: { CB: 2 } });

    expect(txUpdateMock).toHaveBeenCalledWith({
      where: { id: 'response-1' },
      data: {
        variableValues: { CA: 10, CB: 2 },
        calculatedValue: 20,
        isCompliant: false,
        updatedByUserId: elaborador.id,
      },
    });
  });
});
