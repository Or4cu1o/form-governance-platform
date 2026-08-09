import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { AuditContext, AuditContextService } from '../services/audit-context.service';

// Toda escrita auditada desta plataforma chega por aqui hoje — nao ha app
// mobile nem integracao externa (research.md). Se isso mudar, origin passa a
// vir de um cabecalho/rota especifica em vez de constante.
const ORIGIN_WEB = 'WEB';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Popula o AuditContext (T027) a partir da requisicao HTTP autenticada e o
// mantem ativo durante toda a execucao do handler — inclusive apos o ponto de
// retorno sincrono deste metodo, por isso a inscricao em next.handle() ocorre
// dentro de AuditContextService.run(): Observable e lazy, e o
// AsyncLocalStorage so acompanha a cadeia assincrona que comeca dentro do
// run() sincrono, nao a criacao do Observable em si.
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly auditContextService: AuditContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auditContext = this.buildContext(request);

    return new Observable((subscriber) => {
      this.auditContextService.run(auditContext, () => {
        const subscription = next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
        return () => subscription.unsubscribe();
      });
    });
  }

  private buildContext(request: AuthenticatedRequest): AuditContext {
    const user = request.user;
    const userAgentHeader = request.headers['user-agent'];
    const requestIdHeader = request.headers['x-request-id'];

    return {
      userId: user?.id ?? null,
      sourceIp: request.ip ?? null,
      userAgent: Array.isArray(userAgentHeader) ? (userAgentHeader[0] ?? null) : (userAgentHeader ?? null),
      origin: ORIGIN_WEB,
      requestId: (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader) ?? randomUUID(),
      actorNameSnapshot: user ? `${user.nome} ${user.sobrenome}`.trim() : null,
      // Cargo funcional ainda nao esta disponivel em AuthenticatedUser
      // (User.jobTitle existe no schema desde T011, mas so passa a ser
      // populado por T095) — nao inventar valor ate la (T169).
      actorJobTitleSnapshot: null,
      actorRoleSnapshot: user?.role ?? null,
      actorUnitSnapshot: user?.primaryUnit?.sigla ?? user?.primaryUnitId ?? null,
    };
  }
}
