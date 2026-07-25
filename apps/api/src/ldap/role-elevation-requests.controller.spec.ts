import { ElevationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { RoleElevationRequestsController } from './role-elevation-requests.controller';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

describe('RoleElevationRequestsController', () => {
  let controller: RoleElevationRequestsController;
  let findAllMock: jest.Mock;
  let approveMock: jest.Mock;
  let rejectMock: jest.Mock;
  const reviewer = { id: 'admin-1' } as AuthenticatedUser;

  beforeEach(() => {
    findAllMock = jest.fn().mockResolvedValue([]);
    approveMock = jest.fn().mockResolvedValue({ id: 'req-1' });
    rejectMock = jest.fn().mockResolvedValue({ id: 'req-1' });
    const service = { findAll: findAllMock, approve: approveMock, reject: rejectMock } as unknown as RoleElevationRequestsService;
    controller = new RoleElevationRequestsController(service);
  });

  test('findAll forwards the status query param', async () => {
    await controller.findAll(ElevationStatus.PENDING);
    expect(findAllMock).toHaveBeenCalledWith(ElevationStatus.PENDING);
  });

  test('approve delegates with id and reviewer', async () => {
    await controller.approve('req-1', reviewer);
    expect(approveMock).toHaveBeenCalledWith('req-1', reviewer);
  });

  test('reject delegates with id and reviewer', async () => {
    await controller.reject('req-1', reviewer);
    expect(rejectMock).toHaveBeenCalledWith('req-1', reviewer);
  });
});
