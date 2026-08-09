import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EvidenceScanStatus } from '@prisma/client';
import NodeClam from 'clamscan';
import { Readable } from 'stream';
import { AuditContextService } from '../common/services/audit-context.service';
import { AUDIT_ORIGIN_CRON, runAsSystemActor } from '../common/services/system-actor';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';

interface ScanVerdict {
  isInfected: boolean;
  viruses: string[];
}

// T050 (FR-037): todo EvidenceFile nasce PENDENTE (T049, upload direto na
// quarentena) e so sai desse estado por aqui. LIBERADO promove ao bucket
// imutavel com a retencao ja carimbada em T051 (retainUntil); BLOQUEADO
// fica retido para pericia por SystemSetting.forensicHoldYears (FR-039,
// FR-039a) e nunca ingressa no acervo sob retencao imutavel — a promocao
// so acontece no ramo LIBERADO.
@Injectable()
export class AntivirusService {
  private readonly logger = new Logger(AntivirusService.name);
  private clamPromise: Promise<NodeClam> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly auditContextService: AuditContextService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  // Conexao com o daemon ClamAV (T004) e preguicosa e cacheada — nao
  // bloqueia o boot da aplicacao se o antivirus estiver indisponivel; a
  // falha so aparece quando um scan de fato e tentado (scanEvidenceFile ja
  // trata isso como erro por-item, ver scanAllPending).
  private getClam(): Promise<NodeClam> {
    if (!this.clamPromise) {
      this.clamPromise = new NodeClam().init({
        clamscan: { active: false },
        clamdscan: {
          host: this.configService.getOrThrow<string>('CLAMAV_HOST'),
          port: Number(this.configService.getOrThrow<string>('CLAMAV_PORT')),
          localFallback: false,
        },
        preference: 'clamdscan',
      });
    }
    return this.clamPromise;
  }

  async scanBuffer(buffer: Buffer): Promise<ScanVerdict> {
    const clam = await this.getClam();
    const { isInfected, viruses } = await clam.scanStream(Readable.from(buffer));
    return { isInfected: Boolean(isInfected), viruses: viruses ?? [] };
  }

  async scanEvidenceFile(evidenceFileId: string): Promise<void> {
    const evidence = await this.prisma.evidenceFile.findUniqueOrThrow({ where: { id: evidenceFileId } });
    if (evidence.scanStatus !== EvidenceScanStatus.PENDENTE) {
      return;
    }

    const buffer = await this.s3Service.downloadObject(evidence.bucket, evidence.fileKey);
    const { isInfected, viruses } = await this.scanBuffer(buffer);
    const scannedAt = new Date();

    if (!isInfected) {
      await this.s3Service.promoteToImmutable(evidence.fileKey, evidence.retainUntil);
      await this.auditContextService.runWithAuditContext((tx) =>
        tx.evidenceFile.update({
          where: { id: evidenceFileId },
          data: {
            scanStatus: EvidenceScanStatus.LIBERADO,
            scannedAt,
            scanEngineVersion: 'clamav',
            bucket: this.s3Service.getImmutableBucketName(),
          },
        }),
      );
      return;
    }

    const settings = await this.platformSettingsService.getSettings();
    const forensicHoldUntil = new Date(scannedAt);
    forensicHoldUntil.setUTCFullYear(forensicHoldUntil.getUTCFullYear() + settings.forensicHoldYears);

    this.logger.warn(
      `Evidencia ${evidenceFileId} bloqueada pelo antivirus: ${viruses.join(', ') || 'deteccao positiva'}`,
    );
    await this.auditContextService.runWithAuditContext((tx) =>
      tx.evidenceFile.update({
        where: { id: evidenceFileId },
        data: {
          scanStatus: EvidenceScanStatus.BLOQUEADO,
          scannedAt,
          scanEngineVersion: 'clamav',
          forensicHoldUntil,
        },
      }),
    );
  }

  // Best-effort por item: uma falha isolada (ex.: ClamAV momentaneamente
  // fora do ar) nao pode impedir o processamento dos demais arquivos da
  // fila nem travar o cron — fica PENDENTE e e tentado de novo na proxima
  // execucao (FR-038 ja bloqueia submissao enquanto isso).
  async scanAllPending(): Promise<number> {
    const pending = await this.prisma.evidenceFile.findMany({
      where: { scanStatus: EvidenceScanStatus.PENDENTE },
      select: { id: true },
    });
    for (const { id } of pending) {
      try {
        await this.scanEvidenceFile(id);
      } catch (error) {
        this.logger.error(
          `Falha ao processar verificacao antivirus da evidencia ${id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return pending.length;
  }

  @Cron('*/2 * * * *')
  async handlePendingEvidenceScans(): Promise<void> {
    await runAsSystemActor(this.auditContextService, 'Antivirus — varredura de evidencia pendente', AUDIT_ORIGIN_CRON, () =>
      this.scanAllPending(),
    );
  }
}
