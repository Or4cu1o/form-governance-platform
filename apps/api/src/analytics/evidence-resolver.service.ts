import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessLogEventType, ActorKind } from '@prisma/client';
import { AccessLogService } from '../audit/access-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { normalizeLatency } from '../verification/verification.util';
import { EvidenceTokenPayload, signEvidenceToken, verifyEvidenceToken } from './evidence-token.util';

// "Vida curta" (FR-119): tempo suficiente para o clique a partir de um
// painel de BI ja aberto, curto o bastante para nao virar um vinculo
// permanente. Renovado a cada recarga da camada (AnalyticsReloadService).
export const EVIDENCE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type EvidenceResolution = { status: 'OK'; redirectUrl: string } | { status: 'EXPIRADO' };

interface EvidenceResolutionContext {
  sourceIp: string | null;
  userAgent: string | null;
}

// T152/T153/T154 — resolver de evidencia exposto ao BI, sem conta na
// plataforma. Token invalido, expirado e ja consumido produzem a MESMA
// resposta (contracts/analytics-layer.md) — nunca revelam bucket/file_key,
// o endereco real do armazenamento.
@Injectable()
export class EvidenceResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private readonly accessLogService: AccessLogService,
  ) {}

  async issueToken(evidenceFileId: string): Promise<{ token: string; expiresAt: Date }> {
    const secret = this.configService.getOrThrow<string>('EVIDENCE_RESOLVER_HMAC_SECRET');
    const expiresAt = new Date(Date.now() + EVIDENCE_TOKEN_TTL_MS);
    const token = signEvidenceToken({ evidenceFileId, expiresAt: expiresAt.getTime() }, secret);
    await this.prisma.evidenceAccessToken.create({ data: { evidenceFileId, token, expiresAt } });
    return { token, expiresAt };
  }

  // T154: todo acesso originado do BI fica registrado — sucesso, expirado
  // ou ja consumido, inclusive token malformado que nunca chega ao banco.
  async resolve(token: string, context: EvidenceResolutionContext): Promise<EvidenceResolution> {
    const startedAt = process.hrtime.bigint();
    const secret = this.configService.getOrThrow<string>('EVIDENCE_RESOLVER_HMAC_SECRET');
    const payload = verifyEvidenceToken(token, secret);
    const resolution = payload ? await this.tryConsume(token, payload) : ({ status: 'EXPIRADO' } as const);

    await this.accessLogService.record({
      eventType: AccessLogEventType.DOWNLOAD_EVIDENCIA,
      userId: null,
      actorKind: ActorKind.ANONIMO_DECLARADO,
      resultVolume: resolution.status === 'OK' ? 1 : 0,
      sourceIp: context.sourceIp,
      userAgent: context.userAgent,
    });
    await normalizeLatency(startedAt);

    return resolution;
  }

  private async tryConsume(token: string, payload: EvidenceTokenPayload): Promise<EvidenceResolution> {
    if (payload.expiresAt < Date.now()) {
      return { status: 'EXPIRADO' };
    }

    // UPDATE atomico condicionado a "ainda nao consumido e ainda nao
    // expirado" — garante uso unico mesmo sob duas requisicoes concorrentes
    // pelo mesmo token (US8-6).
    const claim = await this.prisma.evidenceAccessToken.updateMany({
      where: { token, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (claim.count === 0) {
      return { status: 'EXPIRADO' };
    }

    const accessToken = await this.prisma.evidenceAccessToken.findUnique({
      where: { token },
      include: { evidenceFile: true },
    });
    if (!accessToken || !accessToken.evidenceFile.isActive || accessToken.evidenceFile.scanStatus !== 'LIBERADO') {
      return { status: 'EXPIRADO' };
    }

    const redirectUrl = await this.s3Service.getPresignedDownloadUrl(
      accessToken.evidenceFile.bucket,
      accessToken.evidenceFile.fileKey,
    );
    return { status: 'OK', redirectUrl };
  }
}
