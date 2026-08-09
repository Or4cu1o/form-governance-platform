import { ConflictException } from '@nestjs/common';
import { GoalOperator, ReportStatus, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuditContextService } from '../common/services/audit-context.service';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { IndicatorResponsesService } from './indicator-responses.service';

// T055/T056 (FR-129, US2-10, quickstart V4): dois usuarios editam
// concorrentemente a mesma resposta de indicador. A segunda gravacao sobre
// uma versao que ja nao e a corrente e recusada com 409 (nunca descartada
// em silencio) e a sobrescrita, quando confirmada, e uma SEGUNDA requisicao
// deliberada, distinguivel na trilha via overwroteVersionId.
describe('optimistic concurrency (FR-129)', () => {
  let service: IndicatorResponsesService;
  let findUniqueMock: jest.Mock;
  let versionFindUniqueMock: jest.Mock;
  let versionCreateMock: jest.Mock;
  let responseUpdateMock: jest.Mock;

  const revisorB: AuthenticatedUser = {
    id: 'revisor-b',
    matricula: '10006',
    nome: 'Bruno',
    sobrenome: 'Revisor',
    email: 'bruno@formops.local',
    role: RoleName.REVISOR,
    primaryUnitId: 'unit-1',
  };

  const baseResponse = {
    id: 'response-1',
    reportInstance: { id: 'report-1', unitId: 'unit-1', status: ReportStatus.EM_REVISAO },
    snapshotVariableKeys: ['CA'],
    snapshotFormulaExpression: 'CA',
    snapshotGoalOperator: GoalOperator.GTE,
    snapshotGoalValue: 90,
    variableValues: { CA: 80 },
    criticalAnalysis: null,
    actionPlan: null,
    currentVersionId: 'version-1',
    validationStatus: 'EM_REVISAO',
  };

  beforeEach(() => {
    findUniqueMock = jest.fn();
    versionFindUniqueMock = jest.fn();
    versionCreateMock = jest.fn().mockResolvedValue({ id: 'version-2' });
    responseUpdateMock = jest.fn().mockResolvedValue({ id: 'response-1' });
    const prisma = {
      indicatorResponse: { findUnique: findUniqueMock },
      indicatorResponseVersion: { findUnique: versionFindUniqueMock },
    } as unknown as PrismaService;
    const auditContextService = {
      runWithAuditContext: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({
          indicatorResponseVersion: { create: versionCreateMock },
          indicatorResponse: { update: responseUpdateMock },
        }),
      ),
    } as unknown as AuditContextService;
    const unitAccessService = { assertReadAccess: jest.fn() } as unknown as UnitAccessService;
    service = new IndicatorResponsesService(prisma, auditContextService, unitAccessService);
  });

  // Cenario US2-10/quickstart V4: revisorA grava primeiro (versao passa a
  // ser version-2); revisorB, que ainda editava sobre version-1, tenta
  // gravar e recebe 409 com o valor vencedor, quem o informou e quando.
  test('rejects the second concurrent write with a 409 carrying the winning value, author and instant', async () => {
    findUniqueMock.mockResolvedValue(baseResponse);
    versionFindUniqueMock.mockResolvedValue({
      id: 'version-1',
      variableValues: { CA: 92 },
      createdAt: new Date('2026-08-10T14:30:00.000Z'),
      authoredByUser: { nome: 'Rita', sobrenome: 'Revisora', jobTitle: 'Coordenadora Tecnica' },
    });

    const error: ConflictException = await service
      .updateValues('response-1', revisorB, { expectedVersionId: 'version-1-que-revisorB-tinha-aberto', variableValues: { CA: 85 } })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({
      statusCode: 409,
      error: 'CONFLITO_DE_VERSAO',
      message: expect.stringContaining('alterado por outra pessoa'),
      current: {
        versionId: 'version-1',
        variableValues: { CA: 92 },
        authoredBy: { name: 'Rita Revisora', jobTitle: 'Coordenadora Tecnica' },
        authoredAt: '2026-08-10T14:30:00.000Z',
      },
    });
    // Nada e escrito quando o conflito e detectado — nenhuma sobrescrita
    // silenciosa (FR-129).
    expect(versionCreateMock).not.toHaveBeenCalled();
    expect(responseUpdateMock).not.toHaveBeenCalled();
  });

  // A sobrescrita, quando o autor decide conscientemente apos ver o 409, e
  // uma SEGUNDA requisicao explicita (overwriteVersionId) — nunca automatica
  // — e fica distinguivel na trilha de versoes.
  test('accepts a deliberate second request that overwrites the winning version, stamping overwroteVersionId in the trail', async () => {
    findUniqueMock.mockResolvedValue(baseResponse);

    await service.updateValues('response-1', revisorB, {
      expectedVersionId: 'version-1-que-revisorB-tinha-aberto',
      overwriteVersionId: 'version-1',
      variableValues: { CA: 85 },
    });

    expect(versionFindUniqueMock).not.toHaveBeenCalled();
    expect(versionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ variableValues: { CA: 85 }, overwroteVersionId: 'version-1' }),
    });
  });
});
