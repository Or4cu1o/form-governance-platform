import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessLogEventType, ActorKind, EvidenceScanStatus } from '@prisma/client';
import { AccessLogService } from '../audit/access-log.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { assertEvidenceFileSignatureMatches } from '../common/evidence-upload.constants';
import { assertCanEditReportData } from '../common/report-edit-access.util';
import { AuditContextService } from '../common/services/audit-context.service';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly unitAccessService: UnitAccessService,
    private readonly auditContextService: AuditContextService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly accessLogService: AccessLogService,
  ) {}

  async uploadForIndicatorResponse(
    indicatorResponseId: string,
    user: AuthenticatedUser,
    file: Express.Multer.File,
  ) {
    const response = await this.prisma.indicatorResponse.findUnique({
      where: { id: indicatorResponseId },
      include: { reportInstance: true },
    });
    if (!response) {
      throw new NotFoundException('Resposta de indicador nao encontrada');
    }
    assertCanEditReportData(response.reportInstance, user);
    assertEvidenceFileSignatureMatches(file);

    // T049 (FR-036): todo upload aterrissa na quarentena — nunca direto no
    // acervo imutavel. Sai de la so pelo veredito do antivirus (T050).
    const fileKey = await this.s3Service.uploadToQuarantine(file.buffer, file.originalname, file.mimetype);

    // T051 (FR-042): a janela de retencao e decidida e carimbada aqui, no
    // upload — nao esperar a promocao ao bucket imutavel (T050), que so
    // aplica no S3 (Object Lock) o valor ja gravado no banco.
    const settings = await this.platformSettingsService.getSettings();
    const retainUntil = new Date();
    retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + settings.evidenceRetentionYears);

    return this.auditContextService.runWithAuditContext((tx) =>
      tx.evidenceFile.create({
        data: {
          indicatorResponseId,
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

  async getDownloadUrl(evidenceFileId: string, user: AuthenticatedUser) {
    const evidence = await this.prisma.evidenceFile.findUnique({
      where: { id: evidenceFileId },
      include: { indicatorResponse: { include: { reportInstance: true } } },
    });
    if (!evidence || !evidence.isActive || !evidence.indicatorResponse) {
      throw new NotFoundException('Evidencia nao encontrada');
    }
    await this.unitAccessService.assertReadAccess(evidence.indicatorResponse.reportInstance.unitId, user);

    // T049a (FR-040): arquivo bloqueado pelo antivirus nunca gera vinculo de
    // download, mesmo que a leitura de escopo tenha passado — 403 direto,
    // sem exceção nao tratada.
    if (evidence.scanStatus === EvidenceScanStatus.BLOQUEADO) {
      throw new ForbiddenException(
        'Este arquivo foi bloqueado pela verificacao de seguranca e nao pode ser baixado',
      );
    }

    // T049a (FR-073): toda leitura sensivel fica registrada, sucesso ou nao.
    await this.accessLogService.record({
      eventType: AccessLogEventType.DOWNLOAD_EVIDENCIA,
      userId: user.id,
      actorKind: ActorKind.USUARIO,
    });

    return { url: await this.s3Service.getPresignedDownloadUrl(evidence.bucket, evidence.fileKey) };
  }

  // T049b (FR-041, Principio I): desativacao logica — some da superficie de
  // trabalho (work surface ja filtra isActive=true, ver
  // ReportInstancesService.findOneForUser), mas permanece integra em
  // auditoria, exportacao e camada analitica. Nunca um DELETE fisico.
  async deactivate(evidenceFileId: string, user: AuthenticatedUser) {
    const evidence = await this.prisma.evidenceFile.findUnique({
      where: { id: evidenceFileId },
      include: { indicatorResponse: { include: { reportInstance: true } } },
    });
    if (!evidence || !evidence.indicatorResponse) {
      throw new NotFoundException('Evidencia nao encontrada');
    }
    assertCanEditReportData(evidence.indicatorResponse.reportInstance, user);

    return this.auditContextService.runWithAuditContext((tx) =>
      tx.evidenceFile.update({
        where: { id: evidenceFileId },
        data: { isActive: false, deactivatedByUserId: user.id, deactivatedAt: new Date() },
      }),
    );
  }
}
