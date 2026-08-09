import { AuditContext, AuditContextService } from './audit-context.service';

// Origens identificaveis para escrita sem requisicao HTTP (T028a/T028b,
// FR-071, Principio I): cron do motor de SLA e scripts de seed.
export const AUDIT_ORIGIN_CRON = 'CRON';
export const AUDIT_ORIGIN_SEED = 'SEED';

// Ator de sistema nunca tem userId nem contexto de rede — mas
// actorNameSnapshot sempre identifica a rotina que escreveu, para que o
// audit_logs jamais mostre autoria em branco quando quem agiu foi o proprio
// sistema (FR-071).
export function buildSystemAuditContext(actorLabel: string, origin: string): AuditContext {
  return {
    userId: null,
    sourceIp: null,
    userAgent: null,
    origin,
    requestId: null,
    actorNameSnapshot: `Sistema — ${actorLabel}`,
    actorJobTitleSnapshot: null,
    actorRoleSnapshot: null,
    actorUnitSnapshot: null,
  };
}

// Envolve `callback` num AuditContext de sistema — usado por
// LifecycleCronService (rotina diaria) e pelos scripts prisma/seed*.ts (carga
// inicial), que nao passam pelo AuditContextInterceptor por nao terem
// requisicao HTTP.
export function runAsSystemActor<T>(
  auditContextService: AuditContextService,
  actorLabel: string,
  origin: string,
  callback: () => Promise<T>,
): Promise<T> {
  return auditContextService.run(buildSystemAuditContext(actorLabel, origin), callback);
}
