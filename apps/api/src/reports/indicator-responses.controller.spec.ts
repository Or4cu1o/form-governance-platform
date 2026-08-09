import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { IndicatorResponsesController } from './indicator-responses.controller';
import { IndicatorResponsesService } from './indicator-responses.service';

describe('IndicatorResponsesController', () => {
  let controller: IndicatorResponsesController;
  let updateValuesMock: jest.Mock;
  let getVersionHistoryMock: jest.Mock;

  const user: AuthenticatedUser = {
    id: 'elaborador-1',
    matricula: '10002',
    nome: 'Elias',
    sobrenome: 'Elaborador',
    email: 'elaborador@formops.local',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
  };

  beforeEach(() => {
    updateValuesMock = jest.fn().mockResolvedValue({ id: 'response-1' });
    getVersionHistoryMock = jest.fn().mockResolvedValue([]);
    const indicatorResponsesService = {
      updateValues: updateValuesMock,
      getVersionHistory: getVersionHistoryMock,
    } as unknown as IndicatorResponsesService;
    controller = new IndicatorResponsesController(indicatorResponsesService);
  });

  test('updateValues delegates to IndicatorResponsesService.updateValues with id, dto and user', async () => {
    const dto = { expectedVersionId: 'version-1', variableValues: { CA: 10 } };

    await controller.updateValues('response-1', dto, user);

    expect(updateValuesMock).toHaveBeenCalledWith('response-1', user, dto);
  });

  test('getVersionHistory delegates to IndicatorResponsesService.getVersionHistory with id and user', async () => {
    await controller.getVersionHistory('response-1', user);

    expect(getVersionHistoryMock).toHaveBeenCalledWith('response-1', user);
  });
});
