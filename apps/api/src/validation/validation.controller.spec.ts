import { RoleName, ValidationVerdict } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';

describe('ValidationController', () => {
  let controller: ValidationController;
  let validateIndicatorMock: jest.Mock;
  let uploadValidationEvidenceMock: jest.Mock;
  let finalizeReportMock: jest.Mock;

  const user: AuthenticatedUser = {
    id: 'aprovador-1',
    matricula: '10004',
    nome: 'Ana',
    sobrenome: 'Aprovadora',
    email: 'aprovador@formops.local',
    role: RoleName.APROVADOR,
    primaryUnitId: 'unit-matriz',
  };
  const file = { buffer: Buffer.from('x'), originalname: 'ev.pdf', mimetype: 'application/pdf', size: 1 } as Express.Multer.File;

  beforeEach(() => {
    validateIndicatorMock = jest.fn().mockResolvedValue({ id: 'validation-record-1' });
    uploadValidationEvidenceMock = jest.fn().mockResolvedValue({ id: 'evidence-1' });
    finalizeReportMock = jest.fn().mockResolvedValue({ id: 'report-1' });
    const validationService = {
      validateIndicator: validateIndicatorMock,
      uploadValidationEvidence: uploadValidationEvidenceMock,
      finalizeReport: finalizeReportMock,
    } as unknown as ValidationService;
    controller = new ValidationController(validationService);
  });

  test('validateIndicator delegates to ValidationService.validateIndicator with id, dto and user', async () => {
    const dto = { verdict: ValidationVerdict.APROVADO, justification: 'ok' };

    await controller.validateIndicator('response-1', dto, user);

    expect(validateIndicatorMock).toHaveBeenCalledWith('response-1', user, dto);
  });

  test('uploadEvidence delegates to ValidationService.uploadValidationEvidence with id, file and user', async () => {
    await controller.uploadEvidence('validation-record-1', file, user);

    expect(uploadValidationEvidenceMock).toHaveBeenCalledWith('validation-record-1', user, file);
  });

  test('finalize delegates to ValidationService.finalizeReport with id and user', async () => {
    await controller.finalize('report-1', user);

    expect(finalizeReportMock).toHaveBeenCalledWith('report-1', user);
  });
});
