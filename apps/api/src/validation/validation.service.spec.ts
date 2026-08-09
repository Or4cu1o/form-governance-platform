import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IndicatorValidationStatus, ReportStatus, RoleName, ValidationVerdict } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuditContextService } from '../common/services/audit-context.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { ValidationService } from './validation.service';

describe('ValidationService', () => {
  let service: ValidationService;
  let findUniqueIndicatorResponseMock: jest.Mock;
  let findUniqueReportInstanceMock: jest.Mock;
  let findUniqueValidationRecordMock: jest.Mock;
  let uploadMock: jest.Mock;
  let notifyReprovedMock: jest.Mock;
  let notifyConcludedMock: jest.Mock;
  let txCreateValidationRecordMock: jest.Mock;
  let txUpdateIndicatorResponseMock: jest.Mock;
  let txUpdateManyIndicatorResponseMock: jest.Mock;
  let txUpdateReportInstanceMock: jest.Mock;
  let txCreateEvidenceFileMock: jest.Mock;

  const user: AuthenticatedUser = {
    id: 'aprovador-1',
    matricula: '10004',
    nome: 'Ana',
    sobrenome: 'Aprovadora',
    email: 'aprovador@formops.local',
    role: RoleName.APROVADOR,
    primaryUnitId: 'unit-matriz',
  };

  beforeEach(() => {
    findUniqueIndicatorResponseMock = jest.fn();
    findUniqueReportInstanceMock = jest.fn();
    findUniqueValidationRecordMock = jest.fn();
    uploadMock = jest.fn().mockResolvedValue('evidences/file-key.pdf');
    notifyReprovedMock = jest.fn();
    notifyConcludedMock = jest.fn();
    txCreateValidationRecordMock = jest.fn().mockResolvedValue({ id: 'validation-record-1' });
    txUpdateIndicatorResponseMock = jest.fn();
    txUpdateManyIndicatorResponseMock = jest.fn();
    txUpdateReportInstanceMock = jest.fn();
    txCreateEvidenceFileMock = jest.fn().mockResolvedValue({ id: 'evidence-1' });

    const tx = {
      validationRecord: { create: txCreateValidationRecordMock },
      indicatorResponse: { update: txUpdateIndicatorResponseMock, updateMany: txUpdateManyIndicatorResponseMock },
      reportInstance: { update: txUpdateReportInstanceMock },
      evidenceFile: { create: txCreateEvidenceFileMock },
    };

    const prisma = {
      indicatorResponse: { findUnique: findUniqueIndicatorResponseMock },
      reportInstance: { findUnique: findUniqueReportInstanceMock },
      validationRecord: { findUnique: findUniqueValidationRecordMock },
    } as unknown as PrismaService;

    const s3Service = {
      upload: uploadMock,
      getBucketName: jest.fn().mockReturnValue('formops-evidencias'),
    } as unknown as S3Service;
    const notificationsService = {
      notifyReportReproved: notifyReprovedMock,
      notifyReportConcluded: notifyConcludedMock,
    } as unknown as NotificationsService;
    const platformSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        slaElaborationBusinessDay: 6,
        slaReviewBusinessDay: 8,
        slaApprovalBusinessDay: 10,
        slaReprovalExtensionDays: 2,
        slaDeflatorScore: 2,
      }),
    } as unknown as PlatformSettingsService;
    const auditContextService = {
      runWithAuditContext: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as AuditContextService;

    service = new ValidationService(prisma, s3Service, notificationsService, platformSettingsService, auditContextService);
  });

  describe('validateIndicator', () => {
    test('throws NotFoundException when the indicator response does not exist', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue(null);

      await expect(
        service.validateIndicator('missing-response', user, {
          verdict: ValidationVerdict.APROVADO,
          justification: 'ok',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    test('throws BadRequestException when the report is not in PENDENTE_APROVACAO', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue({
        id: 'response-1',
        reportInstance: { status: ReportStatus.EM_REVISAO },
      });

      await expect(
        service.validateIndicator('response-1', user, {
          verdict: ValidationVerdict.APROVADO,
          justification: 'ok',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    test('records an APROVADO verdict and updates the indicator response accordingly', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue({
        id: 'response-1',
        reportInstance: { status: ReportStatus.PENDENTE_APROVACAO },
      });

      await service.validateIndicator('response-1', user, {
        verdict: ValidationVerdict.APROVADO,
        justification: 'ok',
      });

      expect(txCreateValidationRecordMock).toHaveBeenCalledWith({
        data: {
          indicatorResponseId: 'response-1',
          aprovadorUserId: user.id,
          verdict: ValidationVerdict.APROVADO,
          justification: 'ok',
        },
      });
      expect(txUpdateIndicatorResponseMock).toHaveBeenCalledWith({
        where: { id: 'response-1' },
        data: { validationStatus: IndicatorValidationStatus.APROVADO },
      });
    });

    test('records a REPROVADO verdict and flags the indicator response as REPROVADO', async () => {
      findUniqueIndicatorResponseMock.mockResolvedValue({
        id: 'response-1',
        reportInstance: { status: ReportStatus.PENDENTE_APROVACAO },
      });

      await service.validateIndicator('response-1', user, {
        verdict: ValidationVerdict.REPROVADO,
        justification: 'faltam evidencias',
      });

      expect(txUpdateIndicatorResponseMock).toHaveBeenCalledWith({
        where: { id: 'response-1' },
        data: { validationStatus: IndicatorValidationStatus.REPROVADO },
      });
    });
  });

  describe('uploadValidationEvidence', () => {
    // T168 — buffer com assinatura binaria real de PDF ("%PDF"), pois
    // ValidationService agora chama assertEvidenceFileSignatureMatches
    // antes de subir ao S3.
    const file = {
      buffer: Buffer.from('%PDF-1.4\n%%EOF'),
      originalname: 'ev.pdf',
      mimetype: 'application/pdf',
      size: 1,
    } as Express.Multer.File;

    test('throws NotFoundException when the validation record does not exist', async () => {
      findUniqueValidationRecordMock.mockResolvedValue(null);

      await expect(service.uploadValidationEvidence('missing-record', user, file)).rejects.toThrow(NotFoundException);
    });

    test("throws ForbiddenException when the caller is not the record's aprovador", async () => {
      findUniqueValidationRecordMock.mockResolvedValue({ id: 'record-1', aprovadorUserId: 'other-user' });

      await expect(service.uploadValidationEvidence('record-1', user, file)).rejects.toThrow(ForbiddenException);
    });

    test('uploads the file and creates an evidence record for the responsible aprovador', async () => {
      findUniqueValidationRecordMock.mockResolvedValue({ id: 'record-1', aprovadorUserId: user.id });

      await service.uploadValidationEvidence('record-1', user, file);

      expect(uploadMock).toHaveBeenCalledWith(file.buffer, file.originalname, file.mimetype);
      expect(txCreateEvidenceFileMock).toHaveBeenCalledWith({
        data: {
          validationRecordId: 'record-1',
          fileKey: 'evidences/file-key.pdf',
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedByUserId: user.id,
          bucket: 'formops-evidencias',
        },
      });
    });

    test('rejects with BadRequestException and uploads nothing when the binary signature diverges from the declared mimetype (T168, FR-035)', async () => {
      findUniqueValidationRecordMock.mockResolvedValue({ id: 'record-1', aprovadorUserId: user.id });
      const forgedFile = {
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // assinatura real de JPEG
        originalname: 'ev.pdf',
        mimetype: 'application/pdf', // declarado como PDF
        size: 4,
      } as Express.Multer.File;

      await expect(service.uploadValidationEvidence('record-1', user, forgedFile)).rejects.toThrow(
        BadRequestException,
      );
      expect(uploadMock).not.toHaveBeenCalled();
      expect(txCreateEvidenceFileMock).not.toHaveBeenCalled();
    });
  });

  describe('finalizeReport', () => {
    test('throws NotFoundException when the report does not exist', async () => {
      findUniqueReportInstanceMock.mockResolvedValue(null);

      await expect(service.finalizeReport('missing-report')).rejects.toThrow(NotFoundException);
    });

    test('throws BadRequestException when the report is not in PENDENTE_APROVACAO', async () => {
      findUniqueReportInstanceMock.mockResolvedValue({ status: ReportStatus.EM_REVISAO, indicatorResponses: [] });

      await expect(service.finalizeReport('report-1')).rejects.toThrow(BadRequestException);
    });

    test('throws BadRequestException when indicators are still pending validation', async () => {
      findUniqueReportInstanceMock.mockResolvedValue({
        status: ReportStatus.PENDENTE_APROVACAO,
        indicatorResponses: [{ validationStatus: IndicatorValidationStatus.PENDENTE_VALIDACAO }],
      });

      await expect(service.finalizeReport('report-1')).rejects.toThrow(BadRequestException);
    });

    test('concludes the report and sums the score only for indicators that are both compliant and approved', async () => {
      findUniqueReportInstanceMock.mockResolvedValue({
        id: 'report-1',
        unit: { id: 'unit-matriz' },
        status: ReportStatus.PENDENTE_APROVACAO,
        elaborationDueDate: new Date('2026-07-08T00:00:00.000Z'),
        reviewDueDate: new Date('2026-07-10T00:00:00.000Z'),
        submittedForReviewAt: new Date('2026-07-07T12:00:00.000Z'),
        submittedForApprovalAt: new Date('2026-07-09T12:00:00.000Z'),
        indicatorResponses: [
          { isCompliant: true, validationStatus: IndicatorValidationStatus.APROVADO, snapshotScoreWeight: 6 },
          // Meta batida, porem reprovada na Mesa de Validacao: nao pontua.
          { isCompliant: true, validationStatus: IndicatorValidationStatus.APROVADO, snapshotScoreWeight: 4 },
          { isCompliant: false, validationStatus: IndicatorValidationStatus.APROVADO, snapshotScoreWeight: 10 },
        ],
      });
      txUpdateReportInstanceMock.mockResolvedValue({ id: 'report-1', status: ReportStatus.CONCLUIDO });

      await service.finalizeReport('report-1');

      expect(txUpdateReportInstanceMock).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: {
          status: ReportStatus.CONCLUIDO,
          concludedAt: expect.any(Date),
          indicatorScore: 10,
          slaDeflatorApplied: 0,
          totalScore: 10,
          isElaborationOnTime: true,
          isReviewOnTime: true,
        },
      });
      expect(notifyConcludedMock).toHaveBeenCalled();
      expect(notifyReprovedMock).not.toHaveBeenCalled();
    });

    test('does not count an indicator whose goal was met but was rejected by the Aprovador', async () => {
      findUniqueReportInstanceMock.mockResolvedValue({
        id: 'report-1',
        unit: { id: 'unit-matriz' },
        status: ReportStatus.PENDENTE_APROVACAO,
        elaborationDueDate: new Date('2026-07-08T00:00:00.000Z'),
        reviewDueDate: new Date('2026-07-10T00:00:00.000Z'),
        submittedForReviewAt: new Date('2026-07-07T12:00:00.000Z'),
        submittedForApprovalAt: new Date('2026-07-09T12:00:00.000Z'),
        indicatorResponses: [
          { isCompliant: true, validationStatus: IndicatorValidationStatus.APROVADO, snapshotScoreWeight: 6 },
        ],
      });
      txUpdateReportInstanceMock.mockResolvedValue({ id: 'report-1', status: ReportStatus.CONCLUIDO });

      await service.finalizeReport('report-1');

      expect(txUpdateReportInstanceMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ indicatorScore: 6 }) }),
      );
    });

    test('applies the SLA deflator once per stage that missed its due date', async () => {
      findUniqueReportInstanceMock.mockResolvedValue({
        id: 'report-1',
        unit: { id: 'unit-matriz' },
        status: ReportStatus.PENDENTE_APROVACAO,
        elaborationDueDate: new Date('2026-07-08T00:00:00.000Z'),
        reviewDueDate: new Date('2026-07-10T00:00:00.000Z'),
        // Elaboracao no prazo (07 <= 08), revisao fora do prazo (12 > 10).
        submittedForReviewAt: new Date('2026-07-07T12:00:00.000Z'),
        submittedForApprovalAt: new Date('2026-07-12T12:00:00.000Z'),
        indicatorResponses: [
          { isCompliant: true, validationStatus: IndicatorValidationStatus.APROVADO, snapshotScoreWeight: 10 },
        ],
      });
      txUpdateReportInstanceMock.mockResolvedValue({ id: 'report-1', status: ReportStatus.CONCLUIDO });

      await service.finalizeReport('report-1');

      expect(txUpdateReportInstanceMock).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: {
          status: ReportStatus.CONCLUIDO,
          concludedAt: expect.any(Date),
          indicatorScore: 10,
          slaDeflatorApplied: 2,
          totalScore: 8,
          isElaborationOnTime: true,
          isReviewOnTime: false,
        },
      });
    });

    test('floors the total score at zero when the deflator exceeds the indicator score', async () => {
      findUniqueReportInstanceMock.mockResolvedValue({
        id: 'report-1',
        unit: { id: 'unit-matriz' },
        status: ReportStatus.PENDENTE_APROVACAO,
        elaborationDueDate: new Date('2026-07-08T00:00:00.000Z'),
        reviewDueDate: new Date('2026-07-10T00:00:00.000Z'),
        submittedForReviewAt: new Date('2026-07-20T12:00:00.000Z'),
        submittedForApprovalAt: new Date('2026-07-25T12:00:00.000Z'),
        indicatorResponses: [
          { isCompliant: true, validationStatus: IndicatorValidationStatus.APROVADO, snapshotScoreWeight: 1 },
        ],
      });
      txUpdateReportInstanceMock.mockResolvedValue({ id: 'report-1', status: ReportStatus.CONCLUIDO });

      await service.finalizeReport('report-1');

      expect(txUpdateReportInstanceMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalScore: 0, slaDeflatorApplied: 4 }) }),
      );
    });

    test('reopens the report for review and notifies rejection when any indicator was rejected', async () => {
      findUniqueReportInstanceMock.mockResolvedValue({
        id: 'report-1',
        unit: { id: 'unit-matriz' },
        status: ReportStatus.PENDENTE_APROVACAO,
        indicatorResponses: [{ validationStatus: IndicatorValidationStatus.REPROVADO }],
      });
      txUpdateReportInstanceMock.mockResolvedValue({ id: 'report-1', status: ReportStatus.EM_REVISAO });

      await service.finalizeReport('report-1');

      expect(txUpdateManyIndicatorResponseMock).toHaveBeenCalledWith({
        where: { reportInstanceId: 'report-1' },
        data: { validationStatus: IndicatorValidationStatus.EM_REVISAO },
      });
      expect(txUpdateReportInstanceMock).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: {
          status: ReportStatus.EM_REVISAO,
          reprovalCount: { increment: 1 },
          slaExtensionDueDate: expect.any(Date),
        },
      });
      expect(notifyReprovedMock).toHaveBeenCalled();
      expect(notifyConcludedMock).not.toHaveBeenCalled();
    });
  });
});
