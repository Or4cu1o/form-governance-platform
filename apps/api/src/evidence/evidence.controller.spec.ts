import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

describe('EvidenceController', () => {
  let controller: EvidenceController;
  let uploadForIndicatorResponseMock: jest.Mock;
  let getDownloadUrlMock: jest.Mock;
  let deactivateMock: jest.Mock;

  const user: AuthenticatedUser = {
    id: 'elaborador-1',
    matricula: '10002',
    nome: 'Elias',
    sobrenome: 'Elaborador',
    email: 'elaborador@formops.local',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
  };
  const file = { buffer: Buffer.from('x'), originalname: 'ev.pdf', mimetype: 'application/pdf', size: 1 } as Express.Multer.File;

  beforeEach(() => {
    uploadForIndicatorResponseMock = jest.fn().mockResolvedValue({ id: 'evidence-1' });
    getDownloadUrlMock = jest.fn().mockResolvedValue({ url: 'https://minio.local/signed-url' });
    deactivateMock = jest.fn().mockResolvedValue({ id: 'evidence-1', isActive: false });
    const evidenceService = {
      uploadForIndicatorResponse: uploadForIndicatorResponseMock,
      getDownloadUrl: getDownloadUrlMock,
      deactivate: deactivateMock,
    } as unknown as EvidenceService;
    controller = new EvidenceController(evidenceService);
  });

  test('upload delegates to EvidenceService with the response id, user and file', async () => {
    const result = await controller.upload('response-1', file, user);

    expect(uploadForIndicatorResponseMock).toHaveBeenCalledWith('response-1', user, file);
    expect(result).toEqual({ id: 'evidence-1' });
  });

  test('getDownloadUrl delegates to EvidenceService with the evidence id and user', async () => {
    const result = await controller.getDownloadUrl('evidence-1', user);

    expect(getDownloadUrlMock).toHaveBeenCalledWith('evidence-1', user);
    expect(result).toEqual({ url: 'https://minio.local/signed-url' });
  });

  test('deactivate delegates to EvidenceService with the evidence id and user', async () => {
    const result = await controller.deactivate('evidence-1', user);

    expect(deactivateMock).toHaveBeenCalledWith('evidence-1', user);
    expect(result).toEqual({ id: 'evidence-1', isActive: false });
  });
});
