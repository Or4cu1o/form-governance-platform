import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EvidenceScanStatus, ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceResolverService } from './evidence-resolver.service';

export interface AnalyticsReloadResult {
  loadedAt: Date;
  tokensIssued: number;
}

// FR-121: enquanto as views permanecerem nao materializadas (research.md
// D11), a "carga" e a propria leitura — analytics.v_load_marker reflete o
// instante da consulta, sem rotina de ETL alguma. O que esta rotina recarga
// de fato, hoje, e o unico estado que a camada mantem fora da leitura
// direta: os tokens do resolver de evidencia (uso unico, vida curta),
// reemitidos para todo arquivo elegivel sem token vigente, para que
// analytics.v_evidence_link nunca fique presa a um token ja consumido ou
// expirado. O contrato exposto ao painel (loaded_at) permanece o mesmo se um
// dia a camada for materializada (T156a).
@Injectable()
export class AnalyticsReloadService {
  private readonly logger = new Logger(AnalyticsReloadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceResolverService: EvidenceResolverService,
  ) {}

  @Cron('0 * * * *')
  async handleScheduledReload(): Promise<void> {
    const result = await this.reload();
    this.logger.log(`Recarga da camada analitica: ${result.tokensIssued} token(s) de evidencia renovado(s).`);
  }

  async reload(): Promise<AnalyticsReloadResult> {
    // Mesmo escopo de analytics.v_evidence_link: evidencia ativa, liberada
    // pelo antivirus, vinculada a uma resposta de relatorio concluido.
    const eligibleFiles = await this.prisma.evidenceFile.findMany({
      where: {
        isActive: true,
        scanStatus: EvidenceScanStatus.LIBERADO,
        indicatorResponse: { reportInstance: { status: ReportStatus.CONCLUIDO } },
        accessTokens: { none: { consumedAt: null, expiresAt: { gt: new Date() } } },
      },
      select: { id: true },
    });

    for (const file of eligibleFiles) {
      await this.evidenceResolverService.issueToken(file.id);
    }

    return { loadedAt: new Date(), tokensIssued: eligibleFiles.length };
  }
}
