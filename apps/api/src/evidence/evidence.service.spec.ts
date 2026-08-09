import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportStatus, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuditContextService } from '../common/services/audit-context.service';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { EvidenceService } from './evidence.service';

describe('EvidenceService', () => {
  let service: EvidenceService;
  let findUniqueIndicatorResponseMock: jest.Mock;
  let findUniqueEvidenceFileMock: jest.Mock;
  let uploadMock: jest.Mock;
  let getPresignedDownloadUrlMock: jest.Mock;
  let assertReadAccessMock: jest.Mock;
  let runWithAuditContextMock: jest.Mock;
  let txCreateMock: jest.Mock;

  const elaborador: AuthenticatedUser = {
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
    findUniqueIndicatorResponseMock = jest.fn();
    findUniqueEvidenceFileMock = jest.fn();
    uploadMock = jest.fn().mockResolvedValue('evidences/file-key.pdf');
    getPresignedDownloadUrlMock = jest.fn().mockResolvedValue('https://minio.local/signed-url');
    assertReadAccessMock = jest.fn();
    txCreateMock = jest.fn().mockResolvedValue({ id: 'evidence-1' });
    runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) => fn({ evidenceFile: { create: txCreateMock } }));

    const prisma = {
      indicatorResponse: { findUnique: findUniqueIndicatorResponseMock },
      evidenceFile: { findUnique: findUniqueEvidenceFileMock },
    } as unknown as PrismaService;
    const s3Service = {
      upload: uploadMock,
      getPresignedDownloadUrl: getPresignedDownloadUrlMock,
      getBucketName: jest.fn().mockReturnValue('formops-evidencias'),
    } as unknown as S3Service;
    const unitAccessService = { assertReadAccess: assertReadAccessMock } as unknown as UnitAccessService;
    const auditContextService = {
      runWithAuditContext: runWithAuditContextMock,
    } as unknown as AuditContextService;

    service = new EvidenceService(prisma, s3Service, unitAccessService, auditContextService);
  });

  describe('uploadForIndicatorResponse', () => {
    test('throws NotFoundException when the indicator response does not exist', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue(null);

      await expect(service.uploadForIndicatorResponse('missing', elaborador, file)).rejects.toThrow(
        NotFoundException,
      );
    });

    test('throws ForbiddenException when the caller cannot edit the report in its current state', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue({
        id: 'response-1',
        reportInstance: { unitId: 'unit-1', status: ReportStatus.EM_REVISAO },
      });

      await expect(service.uploadForIndicatorResponse('response-1', elaborador, file)).rejects.toThrow(
        ForbiddenException,
      );
    });

    test('uploads to S3 and creates the evidence record for an editable report', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue({
        id: 'response-1',
        reportInstance: { unitId: 'unit-1', status: ReportStatus.PENDENTE },
      });

      await service.uploadForIndicatorResponse('response-1', elaborador, file);

      expect(uploadMock).toHaveBeenCalledWith(file.buffer, file.originalname, file.mimetype);
      expect(txCreateMock).toHaveBeenCalledWith({
        data: {
          indicatorResponseId: 'response-1',
          fileKey: 'evidences/file-key.pdf',
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedByUserId: elaborador.id,
          bucket: 'formops-evidencias',
        },
      });
    });
  });

  describe('getDownloadUrl', () => {
    test('throws NotFoundException when the evidence does not exist', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue(null);

      await expect(service.getDownloadUrl('missing', elaborador)).rejects.toThrow(NotFoundException);
    });

    test('throws NotFoundException when the evidence was soft-deleted', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({
        isActive: false,
        indicatorResponse: { reportInstance: { unitId: 'unit-1' } },
      });

      await expect(service.getDownloadUrl('evidence-1', elaborador)).rejects.toThrow(NotFoundException);
    });

    test('enforces unit read access and returns a presigned URL for an active evidence', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({
        isActive: true,
        fileKey: 'evidences/file-key.pdf',
        indicatorResponse: { reportInstance: { unitId: 'unit-1' } },
      });

      const result = await service.getDownloadUrl('evidence-1', elaborador);

      expect(assertReadAccessMock).toHaveBeenCalledWith('unit-1', elaborador);
      expect(result).toEqual({ url: 'https://minio.local/signed-url' });
    });
  });
});
