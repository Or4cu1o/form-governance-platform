import { Injectable } from '@nestjs/common';
import { AccessLogEventType, ActorKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAccessLogInput {
  eventType: AccessLogEventType;
  userId: string | null;
  // "ninguem autenticado, e sabemos disso" != "nao sabemos quem foi"
  // (FR-072) — obrigatorio em toda chamada, nunca inferido de userId nulo.
  actorKind: ActorKind;
  filtersApplied?: Prisma.InputJsonValue | null;
  scopeUnitIds?: string[];
  resultVolume?: number | null;
  sourceIp?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

// AccessLog registra LEITURA sensivel (consulta de auditoria, exportacao,
// download de evidencia, verificacao de selo, tentativas de login) — ao
// contrario de AuditLog, nao existe gatilho de banco que a alimente: quem
// grava e o proprio codigo de aplicacao, no instante do evento (FR-073).
@Injectable()
export class AccessLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAccessLogInput) {
    return this.prisma.accessLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        actorKind: input.actorKind,
        filtersApplied: input.filtersApplied ?? undefined,
        scopeUnitIds: input.scopeUnitIds ?? [],
        resultVolume: input.resultVolume ?? null,
        sourceIp: input.sourceIp ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
      },
    });
  }
}
