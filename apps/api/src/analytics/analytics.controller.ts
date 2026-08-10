import { Controller, Get, Param, Redirect, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { EvidenceResolverService } from './evidence-resolver.service';

// contracts/analytics-layer.md, "Resolver de evidencia": superficie SEM
// @UseGuards de sessao — quem clica vem do Tableau, nunca logado na
// plataforma. Rate limiting proprio, independente do limite global de
// 20/60s (mesmo padrao de VerificationController, T121).
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly evidenceResolverService: EvidenceResolverService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('evidence/:token')
  @Redirect()
  async resolveEvidence(@Param('token') token: string, @Req() req: Request) {
    const resolution = await this.evidenceResolverService.resolve(token, {
      sourceIp: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });

    if (resolution.status === 'OK') {
      return { url: resolution.redirectUrl, statusCode: 302 };
    }

    // Tela amigavel de expiracao (T155/EvidenceExpiredPage), nunca erro cru —
    // mesma resposta para token expirado, ja consumido ou invalido.
    const corsOrigin = this.configService.getOrThrow<string>('CORS_ORIGIN').split(',')[0].trim();
    return { url: `${corsOrigin}/evidencia-expirada`, statusCode: 302 };
  }
}
