import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AccessLogEventType, ActorKind, Prisma } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { AccessLogService } from '../audit/access-log.service';
import { KeyCustodyService } from '../sealing/key-custody.service';
import { VerificationService } from './verification.service';
import { VerifyArtifactDto } from './dto/verify-artifact.dto';
import { normalizeLatency } from './verification.util';

// contracts/public-verification.md: superficie SEM @UseGuards de sessao —
// @Public() e o unico jeito de escapar do JwtAuthGuard/CsrfGuard globais
// (app.module.ts). Rate limiting proprio (FR-105), independente do limite
// global de 20/60s do ThrottlerModule.forRoot().
@Controller('public')
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly keyCustodyService: KeyCustodyService,
    private readonly accessLogService: AccessLogService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('seals/:codigo')
  async getSeal(@Param('codigo') codigo: string, @Req() req: Request) {
    return this.resolveAndLog(codigo, undefined, req);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('seals/:codigo/verify-artifact')
  async verifyArtifact(@Param('codigo') codigo: string, @Body() dto: VerifyArtifactDto, @Req() req: Request) {
    return this.resolveAndLog(codigo, dto.artifactDigest, req);
  }

  @Public()
  @Get('keys')
  listKeys() {
    return { keys: this.keyCustodyService.listKnownKeyIds().map((keyId) => this.describeKey(keyId)) };
  }

  @Public()
  @Get('keys/:keyId')
  getKey(@Param('keyId') keyId: string) {
    return this.describeKey(keyId);
  }

  private describeKey(keyId: string) {
    const publicKey = this.keyCustodyService.getPublicKey(keyId);
    return {
      keyId,
      algorithm: 'Ed25519',
      publicKey: publicKey ? publicKey.export({ type: 'spki', format: 'der' }).toString('base64') : null,
      // KeyCustodyService carrega chaves por arquivo, sem metadado de
      // rotacao datado — nenhuma tela/API depende desta data hoje, so a
      // flag de aposentadoria (que decide verificabilidade, FR-104).
      activeFrom: null,
      retiredAt: this.keyCustodyService.isRetired(keyId) ? 'retired' : null,
    };
  }

  // FR-105: codigo inexistente e malformado produzem resposta identica em
  // corpo E em distribuicao de latencia — normalizeLatency() cobre TODO
  // caminho de saida, inclusive o mais rapido (formato invalido, rejeitado
  // antes de qualquer consulta ao banco).
  private async resolveAndLog(codigo: string, artifactDigest: string | undefined, req: Request) {
    const startedAt = process.hrtime.bigint();
    const envelope = await this.verificationService.resolve(codigo, artifactDigest);
    await normalizeLatency(startedAt);

    await this.accessLogService.record({
      eventType: AccessLogEventType.VERIFICACAO_SELO,
      userId: null,
      actorKind: ActorKind.ANONIMO_DECLARADO,
      filtersApplied: { codigo } as Prisma.InputJsonValue,
      scopeUnitIds: [],
      resultVolume: 1,
      sourceIp: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });

    return envelope;
  }
}
