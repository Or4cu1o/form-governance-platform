import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessLogEventType, ActorKind, EvidenceScanStatus, ReportStatus, RoleName } from '@prisma/client';
import { AccessLogService } from '../audit/access-log.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuditContextService } from '../common/services/audit-context.service';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { EvidenceService } from './evidence.service';

describe('EvidenceService', () => {
  let service: EvidenceService;
  let findUniqueIndicatorResponseMock: jest.Mock;
  let findUniqueEvidenceFileMock: jest.Mock;
  let uploadToQuarantineMock: jest.Mock;
  let getPresignedDownloadUrlMock: jest.Mock;
  let assertReadAccessMock: jest.Mock;
  let runWithAuditContextMock: jest.Mock;
  let txCreateMock: jest.Mock;
  let txUpdateMock: jest.Mock;
  let getSettingsMock: jest.Mock;
  let recordAccessLogMock: jest.Mock;

  const elaborador: AuthenticatedUser = {
    id: 'elaborador-1',
    matricula: '10002',
    nome: 'Elias',
    sobrenome: 'Elaborador',
    email: 'elaborador@formops.local',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
  };
  // T168 — o buffer precisa ter a assinatura binaria real de um PDF
  // ("%PDF"), pois EvidenceService agora chama
  // assertEvidenceFileSignatureMatches antes de subir ao S3.
  const file = {
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
    originalname: 'ev.pdf',
    mimetype: 'application/pdf',
    size: 1,
  } as Express.Multer.File;

  beforeEach(() => {
    findUniqueIndicatorResponseMock = jest.fn();
    findUniqueEvidenceFileMock = jest.fn();
    uploadToQuarantineMock = jest.fn().mockResolvedValue('evidences/file-key.pdf');
    getPresignedDownloadUrlMock = jest.fn().mockResolvedValue('https://minio.local/signed-url');
    assertReadAccessMock = jest.fn();
    txCreateMock = jest.fn().mockResolvedValue({ id: 'evidence-1' });
    txUpdateMock = jest.fn().mockResolvedValue({ id: 'evidence-1', isActive: false });
    runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) =>
      fn({ evidenceFile: { create: txCreateMock, update: txUpdateMock } }),
    );
    getSettingsMock = jest.fn().mockResolvedValue({ evidenceRetentionYears: 10 });
    recordAccessLogMock = jest.fn().mockResolvedValue({ id: 'access-log-1' });

    const prisma = {
      indicatorResponse: { findUnique: findUniqueIndicatorResponseMock },
      evidenceFile: { findUnique: findUniqueEvidenceFileMock },
    } as unknown as PrismaService;
    const s3Service = {
      uploadToQuarantine: uploadToQuarantineMock,
      getPresignedDownloadUrl: getPresignedDownloadUrlMock,
      getQuarantineBucketName: jest.fn().mockReturnValue('formops-quarentena'),
    } as unknown as S3Service;
    const unitAccessService = { assertReadAccess: assertReadAccessMock } as unknown as UnitAccessService;
    const auditContextService = {
      runWithAuditContext: runWithAuditContextMock,
    } as unknown as AuditContextService;
    const platformSettingsService = { getSettings: getSettingsMock } as unknown as PlatformSettingsService;
    const accessLogService = { record: recordAccessLogMock } as unknown as AccessLogService;

    service = new EvidenceService(
      prisma,
      s3Service,
      unitAccessService,
      auditContextService,
      platformSettingsService,
      accessLogService,
    );
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

    // T049 (FR-036): aterrissa no bucket de QUARENTENA — nunca direto no
    // acervo imutavel — com o nome gerado pelo servidor (getQuarantineBucketName
    // e uploadToQuarantine, nao mais o bucket unico legado).
    test('uploads to the quarantine bucket and creates the evidence record for an editable report', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue({
        id: 'response-1',
        reportInstance: { unitId: 'unit-1', status: ReportStatus.PENDENTE },
      });

      await service.uploadForIndicatorResponse('response-1', elaborador, file);

      expect(uploadToQuarantineMock).toHaveBeenCalledWith(file.buffer, file.originalname, file.mimetype);
      expect(txCreateMock).toHaveBeenCalledWith({
        data: {
          indicatorResponseId: 'response-1',
          fileKey: 'evidences/file-key.pdf',
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedByUserId: elaborador.id,
          bucket: 'formops-quarentena',
          retainUntil: expect.any(Date),
        },
      });
    });

    // T051 (FR-042): retainUntil carimbado a partir de
    // SystemSetting.evidenceRetentionYears no momento do upload.
    test('stamps retainUntil from SystemSetting.evidenceRetentionYears (T051, FR-042)', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue({
        id: 'response-1',
        reportInstance: { unitId: 'unit-1', status: ReportStatus.PENDENTE },
      });
      getSettingsMock.mockResolvedValue({ evidenceRetentionYears: 7 });
      const before = new Date();

      await service.uploadForIndicatorResponse('response-1', elaborador, file);

      const { retainUntil } = txCreateMock.mock.calls[0][0].data;
      const expectedYear = before.getUTCFullYear() + 7;
      expect((retainUntil as Date).getUTCFullYear()).toBe(expectedYear);
    });

    test('rejects with BadRequestException and uploads nothing when the binary signature diverges from the declared mimetype (T168, FR-035)', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue({
        id: 'response-1',
        reportInstance: { unitId: 'unit-1', status: ReportStatus.PENDENTE },
      });
      const forgedFile = {
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // assinatura real de JPEG
        originalname: 'ev.pdf',
        mimetype: 'application/pdf', // declarado como PDF
        size: 4,
      } as Express.Multer.File;

      await expect(service.uploadForIndicatorResponse('response-1', elaborador, forgedFile)).rejects.toThrow(
        BadRequestException,
      );
      expect(uploadToQuarantineMock).not.toHaveBeenCalled();
      expect(txCreateMock).not.toHaveBeenCalled();
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

    // T049a (FR-040): scanStatus BLOQUEADO -> 403 sem excecao, nunca um link.
    test('throws ForbiddenException without generating a link when the file was blocked by antivirus (T049a, FR-040)', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({
        isActive: true,
        scanStatus: EvidenceScanStatus.BLOQUEADO,
        fileKey: 'evidences/file-key.pdf',
        bucket: 'formops-quarentena',
        indicatorResponse: { reportInstance: { unitId: 'unit-1' } },
      });

      await expect(service.getDownloadUrl('evidence-1', elaborador)).rejects.toThrow(ForbiddenException);
      expect(getPresignedDownloadUrlMock).not.toHaveBeenCalled();
    });

    test('enforces unit read access, registers an AccessLog entry and returns a presigned URL for a released evidence', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({
        isActive: true,
        scanStatus: EvidenceScanStatus.LIBERADO,
        fileKey: 'evidences/file-key.pdf',
        bucket: 'formops-imutavel',
        indicatorResponse: { reportInstance: { unitId: 'unit-1' } },
      });

      const result = await service.getDownloadUrl('evidence-1', elaborador);

      expect(assertReadAccessMock).toHaveBeenCalledWith('unit-1', elaborador);
      expect(getPresignedDownloadUrlMock).toHaveBeenCalledWith('formops-imutavel', 'evidences/file-key.pdf');
      expect(recordAccessLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AccessLogEventType.DOWNLOAD_EVIDENCIA,
          userId: elaborador.id,
          actorKind: ActorKind.USUARIO,
        }),
      );
      expect(result).toEqual({ url: 'https://minio.local/signed-url' });
    });

    test('still generates a link for evidence pending scan (PENDENTE is not blocked, only BLOQUEADO is)', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({
        isActive: true,
        scanStatus: EvidenceScanStatus.PENDENTE,
        fileKey: 'evidences/file-key.pdf',
        bucket: 'formops-quarentena',
        indicatorResponse: { reportInstance: { unitId: 'unit-1' } },
      });

      await expect(service.getDownloadUrl('evidence-1', elaborador)).resolves.toEqual({
        url: 'https://minio.local/signed-url',
      });
    });
  });

  // T049b (FR-041, Principio I): desativacao logica — some da superficie de
  // trabalho (isActive=false), nunca da auditoria/exportacao/analitica.
  describe('deactivate', () => {
    test('throws NotFoundException when the evidence does not exist', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue(null);

      await expect(service.deactivate('missing', elaborador)).rejects.toThrow(NotFoundException);
    });

    test('throws ForbiddenException when the caller cannot edit the report in its current state', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({
        indicatorResponse: { reportInstance: { unitId: 'unit-1', status: ReportStatus.EM_REVISAO } },
      });

      await expect(service.deactivate('evidence-1', elaborador)).rejects.toThrow(ForbiddenException);
    });

    test('soft-deletes with author and timestamp, keeping the row (never a physical delete)', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({
        indicatorResponse: { reportInstance: { unitId: 'unit-1', status: ReportStatus.PENDENTE } },
      });

      await service.deactivate('evidence-1', elaborador);

      expect(txUpdateMock).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: { isActive: false, deactivatedByUserId: elaborador.id, deactivatedAt: expect.any(Date) },
      });
    });
  });

  // T158 (FR-039a): liberacao antecipada da guarda pericial, exclusiva do
  // administrador — sempre com autor, motivo e data.
  describe('releaseForensicHold', () => {
    const administrador: AuthenticatedUser = { ...elaborador, id: 'admin-1', role: RoleName.ADMINISTRADOR };

    test('throws NotFoundException when the evidence does not exist', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue(null);

      await expect(service.releaseForensicHold('missing', administrador, 'motivo')).rejects.toThrow(
        NotFoundException,
      );
    });

    test('throws BadRequestException when the evidence is not under forensic hold', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({ forensicHoldUntil: null, forensicHoldReleasedAt: null });

      await expect(service.releaseForensicHold('evidence-1', administrador, 'motivo')).rejects.toThrow(
        BadRequestException,
      );
    });

    test('throws BadRequestException when the forensic hold was already released', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({
        forensicHoldUntil: new Date('2027-01-01'),
        forensicHoldReleasedAt: new Date('2026-06-01'),
      });

      await expect(service.releaseForensicHold('evidence-1', administrador, 'motivo')).rejects.toThrow(
        BadRequestException,
      );
    });

    test('releases the hold recording author, reason and date', async () => {
      findUniqueEvidenceFileMock.mockResolvedValue({
        forensicHoldUntil: new Date('2027-01-01'),
        forensicHoldReleasedAt: null,
      });

      await service.releaseForensicHold('evidence-1', administrador, 'falso positivo confirmado com o fabricante');

      expect(txUpdateMock).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: {
          forensicHoldUntil: expect.any(Date),
          forensicHoldReleasedByUserId: administrador.id,
          forensicHoldReleasedAt: expect.any(Date),
          forensicHoldReleaseReason: 'falso positivo confirmado com o fabricante',
        },
      });
    });
  });
});
