import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../auth/session-cookies.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Esquema de submissao dupla (F16.2): a sessao virou cookie enviado
// automaticamente pelo navegador, o que reabre CSRF — SameSite=Lax nao
// basta sozinho porque preserva navegacao de link recebido por e-mail (F14).
// Toda rota de escrita autenticada exige que o valor do cookie CSRF (legivel
// por JS, sem HttpOnly) seja ecoado no header; rota publica nao tem sessao
// para forjar, e metodo seguro nao muda estado.
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.header(CSRF_HEADER_NAME);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Token anti-CSRF ausente ou invalido');
    }

    return true;
  }
}
