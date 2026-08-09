import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AccessLogEventType, ActorKind } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import { AccessLogService } from '../audit/access-log.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from './types/authenticated-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE_NAME } from './session-cookies.constants';

// Alinhado ao padrao de JWT_EXPIRES_IN (auth.module.ts) — o cookie pode
// sobreviver um pouco alem da expiracao real do JWT sem risco, pois o
// JwtStrategy valida a expiracao do token de forma independente.
const SESSION_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accessLogService: AccessLogService,
    private readonly configService: ConfigService,
  ) {}

  // Limite mais estrito que o default global (Fase 12 — achado HIGH: login
  // sem rate limiting permitia forca bruta/credential stuffing).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const user = await this.authService.validateCredentials(dto.identifier, dto.password);
      const { accessToken } = this.authService.login(user);
      this.issueSessionCookies(response, accessToken);
      await this.recordLoginAttempt(request, AccessLogEventType.LOGIN_SUCESSO, ActorKind.USUARIO, user.id);
      return { user };
    } catch (error) {
      await this.recordLoginAttempt(request, AccessLogEventType.LOGIN_FALHA, ActorKind.ANONIMO_DECLARADO, null);
      throw error;
    }
  }

  // Rotas obrigatorias dado o cookie HttpOnly (F16.2): o cliente nao consegue
  // apagar nem inspecionar o token, entao encerrar e renovar a sessao so
  // podem ser operacoes de servidor.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    response.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
  }

  @Post('refresh')
  refresh(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) response: Response) {
    const { accessToken } = this.authService.login(user);
    this.issueSessionCookies(response, accessToken);
    return { user };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  private issueSessionCookies(response: Response, accessToken: string): void {
    const isSecure = this.configService.get<string>('ENABLE_HTTPS') === 'true';
    const csrfToken = randomBytes(32).toString('hex');
    const baseOptions: CookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
      path: '/',
    };
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, baseOptions);
    // Sem HttpOnly deliberadamente — o esquema de submissao dupla exige que
    // o frontend leia este valor via document.cookie (CsrfGuard).
    response.cookie(CSRF_COOKIE_NAME, csrfToken, { ...baseOptions, httpOnly: false });
  }

  private async recordLoginAttempt(
    request: Request,
    eventType: AccessLogEventType,
    actorKind: ActorKind,
    userId: string | null,
  ): Promise<void> {
    await this.accessLogService.record({
      eventType,
      userId,
      actorKind,
      sourceIp: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
    });
  }
}
