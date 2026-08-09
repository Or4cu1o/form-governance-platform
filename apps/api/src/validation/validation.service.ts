import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IndicatorValidationStatus, ReportStatus, ReportSubmissionStage, ValidationVerdict } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { assertEvidenceFileSignatureMatches } from '../common/evidence-upload.constants';
import { AuditContextService } from '../common/services/audit-context.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { addBusinessDays, getMandatoryNationalHolidays } from '../lifecycle/business-days.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportSubmissionService } from '../reports/report-submission.service';
import { S3Service } from '../storage/s3.service';
import { ValidateIndicatorDto } from './dto/validate-indicator.dto';

// Secao 5 (Mesa de Validacao Tecnica) + Secao 4 (fase de Aprovacao) do
// PROMPT.md: contraprova indicador-por-indicador pelo Aprovador, seguida de
// um veredito final explicito para o relatorio inteiro.
@Injectable()
export class ValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly notificationsService: NotificationsService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly auditContextService: AuditContextService,
    private readonly reportSubmissionService: ReportSubmissionService,
  ) {}

  async validateIndicator(indicatorResponseId: string, user: AuthenticatedUser, dto: ValidateIndicatorDto) {
    const response = await this.prisma.indicatorResponse.findUnique({
      where: { id: indicatorResponseId },
      include: { reportInstance: true },
    });
    if (!response) {
      throw new NotFoundException('Resposta de indicador nao encontrada');
    }
    if (response.reportInstance.status !== ReportStatus.PENDENTE_APROVACAO) {
      throw new BadRequestException('Relatorio nao esta na fase de aprovacao');
    }

    const nextStatus =
      dto.verdict === ValidationVerdict.APROVADO
        ? IndicatorValidationStatus.APROVADO
        : IndicatorValidationStatus.REPROVADO;

    return this.auditContextService.runWithAuditContext(async (tx) => {
      const record = await tx.validationRecord.create({
        data: {
          indicatorResponseId,
          aprovadorUserId: user.id,
          verdict: dto.verdict,
          justification: dto.justification,
        },
      });
      await tx.indicatorResponse.update({
        where: { id: indicatorResponseId },
        data: { validationStatus: nextStatus },
      });
      return record;
    });
  }

  async uploadValidationEvidence(validationRecordId: string, user: AuthenticatedUser, file: Express.Multer.File) {
    const record = await this.prisma.validationRecord.findUnique({ where: { id: validationRecordId } });
    if (!record) {
      throw new NotFoundException('Registro de validacao nao encontrado');
    }
    if (record.aprovadorUserId !== user.id) {
      throw new ForbiddenException('Somente o aprovador responsavel pode anexar evidencia a este registro');
    }
    assertEvidenceFileSignatureMatches(file);

    // Mesma quarentena + retencao de EvidenceService.uploadForIndicatorResponse
    // (T049/T051) — EvidenceFile e a mesma entidade fisica em ambos os
    // casos, so muda a FK preenchida (validationRecordId vs
    // indicatorResponseId); o ciclo de vida do arquivo (quarentena ->
    // antivirus -> imutavel, retencao) nao pode divergir entre os dois.
    const fileKey = await this.s3Service.uploadToQuarantine(file.buffer, file.originalname, file.mimetype);
    const settings = await this.platformSettingsService.getSettings();
    const retainUntil = new Date();
    retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + settings.evidenceRetentionYears);

    return this.auditContextService.runWithAuditContext((tx) =>
      tx.evidenceFile.create({
        data: {
          validationRecordId,
          fileKey,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedByUserId: user.id,
          bucket: this.s3Service.getQuarantineBucketName(),
          retainUntil,
        },
      }),
    );
  }

  async finalizeReport(reportInstanceId: string, user: AuthenticatedUser) {
    const report = await this.prisma.reportInstance.findUnique({
      where: { id: reportInstanceId },
      include: { indicatorResponses: true, unit: true },
    });
    if (!report) {
      throw new NotFoundException('Relatorio nao encontrado');
    }
    if (report.status !== ReportStatus.PENDENTE_APROVACAO) {
      throw new BadRequestException('Relatorio nao esta na fase de aprovacao');
    }

    const pendingCount = report.indicatorResponses.filter(
      (response) => response.validationStatus === IndicatorValidationStatus.PENDENTE_VALIDACAO,
    ).length;
    if (pendingCount > 0) {
      throw new BadRequestException(`${pendingCount} indicador(es) ainda pendente(s) de validacao`);
    }

    const hasRejection = report.indicatorResponses.some(
      (response) => response.validationStatus === IndicatorValidationStatus.REPROVADO,
    );

    const settings = await this.platformSettingsService.getSettings();

    // A nota so soma o peso de um indicador quando a meta foi batida
    // (isCompliant) E o indicador foi aprovado na Mesa de Validacao. Meta
    // batida porem reprovada nao pontua.
    const indicatorScore = report.indicatorResponses.reduce((sum, response) => {
      const countsForScore =
        response.isCompliant === true && response.validationStatus === IndicatorValidationStatus.APROVADO;
      return countsForScore ? sum + Number(response.snapshotScoreWeight) : sum;
    }, 0);

    // T064/FR-056/FR-057: a pontualidade nao e recomputada aqui a partir dos
    // campos de conveniencia (submittedForReviewAt/submittedForApprovalAt) —
    // le a submissao mais recente de cada etapa em ReportSubmission, cujo
    // wasOnTime ja foi aferido contra o prazo vigente (o estendido, quando
    // pos-reprova) no momento do envio. O atraso pretérito de um envio
    // anterior fica preservado na linha dele, sem participar deste calculo.
    const submissions = await this.prisma.reportSubmission.findMany({
      where: { reportInstanceId },
      orderBy: { submittedAt: 'desc' },
    });
    const latestElaboracao = submissions.find((submission) => submission.stage === ReportSubmissionStage.ELABORACAO);
    const latestRevisao = submissions.find((submission) => submission.stage === ReportSubmissionStage.REVISAO);
    const isElaborationOnTime = latestElaboracao?.wasOnTime ?? false;
    const isReviewOnTime = latestRevisao?.wasOnTime ?? false;

    const deflator = Number(settings.slaDeflatorScore);
    const slaDeflatorApplied = (isElaborationOnTime ? 0 : deflator) + (isReviewOnTime ? 0 : deflator);
    const totalScore = Math.max(0, indicatorScore - slaDeflatorApplied);

    const updated = await this.auditContextService.runWithAuditContext(async (tx) => {
      if (hasRejection) {
        const holidays = getMandatoryNationalHolidays(new Date().getUTCFullYear());
        const slaExtensionDueDate = addBusinessDays(new Date(), settings.slaReprovalExtensionDays, holidays);
        // US2-7: so o REPROVADO volta a exigir correcao. O APROVADO
        // nao-alterado permanece aprovado — so recua se for editado depois
        // (revertido na propria gravacao, ver IndicatorResponsesService).
        await tx.indicatorResponse.updateMany({
          where: { reportInstanceId, validationStatus: IndicatorValidationStatus.REPROVADO },
          data: { validationStatus: IndicatorValidationStatus.EM_REVISAO },
        });
        const updatedReport = await tx.reportInstance.update({
          where: { id: reportInstanceId },
          data: {
            status: ReportStatus.EM_REVISAO,
            reprovalCount: { increment: 1 },
            slaExtensionDueDate,
          },
        });
        await this.reportSubmissionService.recordSubmission(tx, {
          reportInstanceId,
          stage: ReportSubmissionStage.APROVACAO,
          submittedByUserId: user.id,
          dueDate: report.approvalDueDate,
          extensionDueDate: null,
          reprovalCount: report.reprovalCount,
        });
        return updatedReport;
      }

      const updatedReport = await tx.reportInstance.update({
        where: { id: reportInstanceId },
        data: {
          status: ReportStatus.CONCLUIDO,
          concludedAt: new Date(),
          indicatorScore,
          slaDeflatorApplied,
          totalScore,
          isElaborationOnTime,
          isReviewOnTime,
        },
      });
      await this.reportSubmissionService.recordSubmission(tx, {
        reportInstanceId,
        stage: ReportSubmissionStage.APROVACAO,
        submittedByUserId: user.id,
        dueDate: report.approvalDueDate,
        extensionDueDate: null,
        reprovalCount: report.reprovalCount,
      });
      return updatedReport;
    });

    if (hasRejection) {
      await this.notificationsService.notifyReportReproved(updated, report.unit);
    } else {
      await this.notificationsService.notifyReportConcluded(updated, report.unit);
    }
    return updated;
  }
}
