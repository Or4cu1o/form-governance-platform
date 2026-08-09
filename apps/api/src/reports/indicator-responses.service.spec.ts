import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GoalOperator, IndicatorValidationStatus, InheritanceState, ReportStatus, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuditContextService } from '../common/services/audit-context.service';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { IndicatorResponsesService } from './indicator-responses.service';

describe('IndicatorResponsesService', () => {
  let service: IndicatorResponsesService;
  let findUniqueMock: jest.Mock;
  let versionFindUniqueMock: jest.Mock;
  let versionFindManyMock: jest.Mock;
  let assertReadAccessMock: jest.Mock;
  let runWithAuditContextMock: jest.Mock;
  let versionCreateMock: jest.Mock;
  let responseUpdateMock: jest.Mock;

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
    criticalAnalysis: null,
    actionPlan: null,
    currentVersionId: 'version-1',
    validationStatus: IndicatorValidationStatus.EM_REVISAO,
  };

  beforeEach(() => {
    findUniqueMock = jest.fn();
    versionFindUniqueMock = jest.fn();
    versionFindManyMock = jest.fn().mockResolvedValue([]);
    assertReadAccessMock = jest.fn();
    versionCreateMock = jest.fn().mockResolvedValue({ id: 'version-2' });
    responseUpdateMock = jest.fn().mockResolvedValue({ id: 'response-1' });
    runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) =>
      fn({
        indicatorResponseVersion: { create: versionCreateMock },
        indicatorResponse: { update: responseUpdateMock },
      }),
    );
    const prisma = {
      indicatorResponse: { findUnique: findUniqueMock },
      indicatorResponseVersion: { findUnique: versionFindUniqueMock, findMany: versionFindManyMock },
    } as unknown as PrismaService;
    const auditContextService = {
      runWithAuditContext: runWithAuditContextMock,
    } as unknown as AuditContextService;
    const unitAccessService = { assertReadAccess: assertReadAccessMock } as unknown as UnitAccessService;
    service = new IndicatorResponsesService(prisma, auditContextService, unitAccessService);
  });

  test('throws NotFoundException when the indicator response does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      service.updateValues('missing', elaborador, { expectedVersionId: 'version-1', variableValues: { CA: 1 } }),
    ).rejects.toThrow(NotFoundException);
  });

  test('throws ForbiddenException when the caller cannot edit the report in its current state', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseResponse,
      reportInstance: { ...baseResponse.reportInstance, status: ReportStatus.EM_REVISAO },
    });

    await expect(
      service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { CA: 1 } }),
    ).rejects.toThrow(ForbiddenException);
  });

  // Cobertura completa do fluxo de conflito (409, overwrite deliberado,
  // distincao na trilha) esta em optimistic-concurrency.spec.ts (T055/T056).

  test('throws BadRequestException when the payload references an undeclared variable key', async () => {
    findUniqueMock.mockResolvedValue(baseResponse);

    await expect(
      service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { UNKNOWN: 1 } }),
    ).rejects.toThrow(BadRequestException);
  });

  test('throws BadRequestException when a value is not a finite number', async () => {
    findUniqueMock.mockResolvedValue(baseResponse);

    await expect(
      service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { CA: Number.NaN } }),
    ).rejects.toThrow(BadRequestException);
  });

  test('persists a partial update without calculating when not all variables are answered yet, with the exact reason (US1-5, FR-028)', async () => {
    findUniqueMock.mockResolvedValue(baseResponse);

    await service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { CA: 10 } });

    expect(versionCreateMock).toHaveBeenCalledWith({
      data: {
        indicatorResponseId: 'response-1',
        variableValues: { CA: 10 },
        calculatedValue: null,
        calculationFailureReason: 'Aguardando valor de: CB',
        isCompliant: null,
        criticalAnalysis: null,
        actionPlan: null,
        authoredByUserId: elaborador.id,
        inheritanceState: InheritanceState.NAO_HERDADO,
        unresolvedInheritedKeys: [],
        originLegacy: false,
        overwroteVersionId: null,
      },
    });
    expect(responseUpdateMock).toHaveBeenCalledWith({
      where: { id: 'response-1' },
      data: expect.objectContaining({
        variableValues: { CA: 10 },
        calculatedValue: null,
        calculationFailureReason: 'Aguardando valor de: CB',
        isCompliant: null,
        currentVersionId: 'version-2',
        updatedByUserId: elaborador.id,
      }),
    });
  });

  test('calculates the formula and compliance once every declared variable has a value', async () => {
    findUniqueMock.mockResolvedValue({ ...baseResponse, variableValues: { CA: 10 } });

    await service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { CB: 2 } });

    expect(versionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        variableValues: { CA: 10, CB: 2 },
        calculatedValue: 20,
        calculationFailureReason: null,
        isCompliant: false,
      }),
    });
  });

  // Cenario US1-6 (Principio III): 0 e uma medicao legitima, indistinguivel
  // de qualquer outro numero apurado — nao pode ser tratado como ausencia.
  test('accepts 0 as a legitimate measured value and calculates normally (US1-6, Principio III)', async () => {
    findUniqueMock.mockResolvedValue({ ...baseResponse, variableValues: { CA: 10 } });

    await service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { CB: 0 } });

    expect(versionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        variableValues: { CA: 10, CB: 0 },
        calculatedValue: 0,
        isCompliant: true,
        calculationFailureReason: null,
      }),
    });
  });

  // Cenario US1-5 (FR-028): denominador zero com todas as variaveis
  // presentes nao lanca excecao nem aborta a gravacao — persiste ausencia
  // de resultado com o motivo exato, conformidade indefinida.
  test('persists calculation failure with the exact reason instead of throwing when the formula is impossible (division by zero)', async () => {
    findUniqueMock.mockResolvedValue({ ...baseResponse, variableValues: { CB: 10 } });

    await service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { CA: 0 } });

    expect(versionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        variableValues: { CA: 0, CB: 10 },
        calculatedValue: null,
        calculationFailureReason: 'Formula resultou em divisao por zero',
        isCompliant: null,
      }),
    });
  });

  // FR-031: o arredondamento de exibicao nunca decide conformidade em valor
  // de fronteira. 97,995 contra meta 98 (GTE) e NAO conforme em precisao
  // decimal — um arredondamento previo a 2 casas ("98,00") inverteria
  // erroneamente esse resultado para conforme.
  test('decides boundary compliance on full decimal precision, never on display rounding (FR-031)', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseResponse,
      snapshotVariableKeys: ['CA'],
      snapshotFormulaExpression: 'CA',
      snapshotGoalOperator: GoalOperator.GTE,
      snapshotGoalValue: 98,
      variableValues: {},
    });

    await service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { CA: 97.995 } });

    expect(versionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ calculatedValue: 97.995, isCompliant: false }),
    });
  });

  // T065/US2-7: indicador ja aprovado que seja alterado volta imediatamente
  // (nesta mesma gravacao) a exigir nova contraprova.
  test('demotes an already-APROVADO indicator back to EM_REVISAO the moment it is edited (US2-7)', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseResponse,
      variableValues: { CA: 10 },
      validationStatus: IndicatorValidationStatus.APROVADO,
    });

    await service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { CB: 2 } });

    expect(responseUpdateMock).toHaveBeenCalledWith({
      where: { id: 'response-1' },
      data: expect.objectContaining({ validationStatus: IndicatorValidationStatus.EM_REVISAO }),
    });
  });

  test('does not touch validationStatus when the indicator was not APROVADO', async () => {
    findUniqueMock.mockResolvedValue({ ...baseResponse, variableValues: { CA: 10 } });

    await service.updateValues('response-1', elaborador, { expectedVersionId: 'version-1', variableValues: { CB: 2 } });

    expect(responseUpdateMock).toHaveBeenCalledWith({
      where: { id: 'response-1' },
      data: expect.not.objectContaining({ validationStatus: expect.anything() }),
    });
  });

  describe('getVersionHistory', () => {
    test('throws NotFoundException when the indicator response does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.getVersionHistory('missing', elaborador)).rejects.toThrow(NotFoundException);
    });

    test('enforces unit-scoped read access before returning the history', async () => {
      findUniqueMock.mockResolvedValue(baseResponse);

      await service.getVersionHistory('response-1', elaborador);

      expect(assertReadAccessMock).toHaveBeenCalledWith('unit-1', elaborador);
      expect(versionFindManyMock).toHaveBeenCalledWith({
        where: { indicatorResponseId: 'response-1' },
        orderBy: { validFrom: 'asc' },
        include: { authoredByUser: { select: { nome: true, sobrenome: true, jobTitle: true } } },
      });
    });
  });
});
