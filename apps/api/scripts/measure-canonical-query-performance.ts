import { NestFactory } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AuditQueryService } from '../src/audit/audit-query.service';
import { AuthenticatedUser } from '../src/auth/types/authenticated-user.interface';
import { AuditQueryMode } from '../src/audit/dto/audit-query.dto';

// T161 (SC-011, SC-012) — mede a primeira pagina da consulta canonica sobre
// 24 meses x todas as unidades e confirma < 3s, repetindo contra um acervo
// varias vezes maior para confirmar ausencia de degradacao.
//
// Pre-requisito: um banco semeado na escala-alvo. seed-demo.ts hoje cobre 6
// meses — para os 24 meses exigidos aqui, rode-o repetidamente com
// referenceMonth deslocado, ou gere um acervo dedicado de performance antes
// de rodar este script. Este script so mede; nao semeia.
//
// Uso: SCALE_LABEL="24m baseline" npx ts-node apps/api/scripts/measure-canonical-query-performance.ts
const ITERATIONS = 5;
const RPO_LATENCY_TARGET_MS = 3000;
const START_MONTH = new Date(Date.UTC(new Date().getUTCFullYear() - 2, new Date().getUTCMonth(), 1));

function percentile(sortedMs: number[], p: number): number {
  const index = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, index)];
}

async function main(): Promise<void> {
  const scaleLabel = process.env.SCALE_LABEL ?? 'nao rotulado';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const auditQueryService = app.get(AuditQueryService);

  const syntheticAdmin: AuthenticatedUser = {
    id: 'perf-measurement',
    matricula: '00000',
    nome: 'Medicao',
    sobrenome: 'De Performance',
    email: 'perf@formops.local',
    role: RoleName.ADMINISTRADOR,
    primaryUnitId: 'perf-measurement',
  };

  const durationsMs: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const startedAt = process.hrtime.bigint();
    await auditQueryService.query(
      {
        mode: AuditQueryMode.BASICO,
        periodFrom: START_MONTH.toISOString().slice(0, 7),
        periodTo: new Date().toISOString().slice(0, 7),
      } as never,
      syntheticAdmin,
    );
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    durationsMs.push(elapsedMs);
  }

  durationsMs.sort((a, b) => a - b);
  const result = {
    scaleLabel,
    iterations: ITERATIONS,
    minMs: durationsMs[0],
    p95Ms: percentile(durationsMs, 95),
    maxMs: durationsMs[durationsMs.length - 1],
    withinTarget: durationsMs[durationsMs.length - 1] < RPO_LATENCY_TARGET_MS,
  };
  console.log(JSON.stringify(result, null, 2));
  console.log(
    result.withinTarget
      ? `OK — pior caso ${result.maxMs.toFixed(0)}ms < ${RPO_LATENCY_TARGET_MS}ms (SC-011/SC-012)`
      : `FALHA — pior caso ${result.maxMs.toFixed(0)}ms >= ${RPO_LATENCY_TARGET_MS}ms (SC-011/SC-012)`,
  );

  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
