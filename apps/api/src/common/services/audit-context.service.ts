import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Contexto exigido pelo trigger fn_write_audit_log reescrito na migration
// 20260808120500 (T025): origin nunca e nulo, os demais campos sao nulos
// apenas para ator de sistema (cron/seed, ver system-actor.ts).
export interface AuditContext {
  userId: string | null;
  sourceIp: string | null;
  userAgent: string | null;
  origin: string;
  requestId: string | null;
  actorNameSnapshot: string | null;
  actorJobTitleSnapshot: string | null;
  actorRoleSnapshot: string | null;
  actorUnitSnapshot: string | null;
}

const auditContextStorage = new AsyncLocalStorage<AuditContext>();

// Substitui PrismaService.runWithAuditActor (T166): em vez de userId isolado,
// carrega o contexto de requisicao inteiro (FR-069) e o propaga via
// AsyncLocalStorage para que os 5 pontos de escrita hoje espalhados pelo
// codigo nao precisem repassar sourceIp/userAgent/origin manualmente a cada
// chamada — quem popula o contexto e AuditContextInterceptor (T028) para
// requisicoes HTTP, ou SystemActor (T028b) para cron/seed.
@Injectable()
export class AuditContextService {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(context: AuditContext, callback: () => T): T {
    return auditContextStorage.run(context, callback);
  }

  getContext(): AuditContext | undefined {
    return auditContextStorage.getStore();
  }

  // Rejeita a escrita antes mesmo de abrir a transacao quando nenhum
  // contexto esta ativo — a garantia de "nunca gravado em silencio" (T026,
  // Principio I) nao depende so do RAISE EXCEPTION do gatilho no banco
  // (T166/T025): a aplicacao tambem nao tenta.
  async runWithAuditContext<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const context = auditContextStorage.getStore();
    if (!context) {
      throw new Error(
        'audit: nenhum contexto de auditoria ativo — use AuditContextInterceptor ou SystemActor.run antes de escrever',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.userId ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.source_ip', ${context.sourceIp ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.user_agent', ${context.userAgent ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.origin', ${context.origin}, true)`;
      await tx.$executeRaw`SELECT set_config('app.request_id', ${context.requestId ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_name_snapshot', ${context.actorNameSnapshot ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_job_title_snapshot', ${context.actorJobTitleSnapshot ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_role_snapshot', ${context.actorRoleSnapshot ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_unit_snapshot', ${context.actorUnitSnapshot ?? ''}, true)`;
      return fn(tx);
    });
  }
}
