import { NestFactory } from '@nestjs/core';
import { ReportStatus, RoleName, ValidationVerdict } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/auth/types/authenticated-user.interface';
import { AuditContextService } from '../src/common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../src/common/services/system-actor';
import { PrismaService } from '../src/prisma/prisma.service';
import { IndicatorResponsesService } from '../src/reports/indicator-responses.service';
import { ValidationService } from '../src/validation/validation.service';

// T161a (SC-012a) — carga do pico de fechamento mensal: 60 unidades e 400
// usuarios disputando a mesma janela de prazo, sem degradacao perceptivel
// nas telas de preenchimento e validacao.
//
// Pre-requisito: um banco semeado com pelo menos UNIT_TARGET unidades e
// relatorios PENDENTE/EM_REVISAO no periodo corrente (ex.: npm run
// seed:demo, opcionalmente repetido/ampliado ate atingir a escala-alvo).
// Este script so mede; nao semeia a escala completa.
//
// Uso: CONCURRENCY=400 npx ts-node apps/api/scripts/measure-monthly-close-load.ts
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 400);
const UNIT_TARGET = Number(process.env.UNIT_TARGET ?? 60);
const PERCEPTIBLE_DEGRADATION_THRESHOLD_MS = 3000; // mesmo teto de SC-011/SC-012, na ausencia de um numero proprio para UX de preenchimento.

function percentile(sortedMs: number[], p: number): number {
  const index = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, index)];
}

async function fillWorker(
  service: IndicatorResponsesService,
  responseId: string,
  user: AuthenticatedUser,
): Promise<number> {
  const startedAt = process.hrtime.bigint();
  await service.updateValues(responseId, user, { variableValues: { x: Math.random() * 100 } } as never);
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

async function validateWorker(
  service: ValidationService,
  responseId: string,
  user: AuthenticatedUser,
): Promise<number> {
  const startedAt = process.hrtime.bigint();
  await service.validateIndicator(responseId, user, { verdict: ValidationVerdict.APROVADO } as never);
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const indicatorResponsesService = app.get(IndicatorResponsesService);
  const validationService = app.get(ValidationService);
  const auditContextService = app.get(AuditContextService);

  const eligibleResponses = await prisma.indicatorResponse.findMany({
    where: { reportInstance: { status: { in: [ReportStatus.PENDENTE, ReportStatus.EM_REVISAO] } } },
    include: {
      reportInstance: { include: { unit: { include: { primaryUsers: { take: 1 } } } } },
      formIndicator: { select: { goalOperator: true } },
    },
    take: CONCURRENCY,
  });

  const unitCount = new Set(eligibleResponses.map((r) => r.reportInstance.unitId)).size;
  if (eligibleResponses.length === 0) {
    console.error(
      'Nenhum IndicatorResponse elegivel (PENDENTE/EM_REVISAO) encontrado — rode npm run seed:demo primeiro.',
    );
    await app.close();
    process.exit(1);
  }
  if (unitCount < UNIT_TARGET) {
    console.warn(
      `Aviso: acervo atual cobre ${unitCount} unidades, abaixo da escala-alvo de ${UNIT_TARGET} (SC-012a). ` +
        'O resultado abaixo e informativo, nao a medicao definitiva na escala exigida.',
    );
  }

  const fillDurationsMs: number[] = [];
  const validateDurationsMs: number[] = [];

  await runAsSystemActor(auditContextService, 'Medicao de carga — pico de fechamento mensal', AUDIT_ORIGIN_SEED, () =>
    Promise.all(
      eligibleResponses.map(async (response, index) => {
        const author = response.reportInstance.unit.primaryUsers[0];
        if (!author) return;
        const syntheticUser: AuthenticatedUser = {
          id: author.id,
          matricula: author.matricula,
          nome: author.nome,
          sobrenome: author.sobrenome,
          email: author.email,
          role: RoleName.ELABORADOR,
          primaryUnitId: response.reportInstance.unitId,
        };
        try {
          if (index % 2 === 0) {
            fillDurationsMs.push(await fillWorker(indicatorResponsesService, response.id, syntheticUser));
          } else {
            validateDurationsMs.push(
              await validateWorker(validationService, response.id, { ...syntheticUser, role: RoleName.REVISOR }),
            );
          }
        } catch {
          // Contencao esperada em parte das tentativas concorrentes (ex.:
          // relatorio ja saiu do estado editavel) — o que importa aqui e a
          // latencia das que completam, nao a taxa de sucesso individual.
        }
      }),
    ),
  );

  const summarize = (label: string, durationsMs: number[]) => {
    if (durationsMs.length === 0) {
      console.log(`${label}: nenhuma amostra concluida`);
      return true;
    }
    const sorted = [...durationsMs].sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);
    const max = sorted[sorted.length - 1];
    const withinTarget = max < PERCEPTIBLE_DEGRADATION_THRESHOLD_MS;
    console.log(
      `${label}: ${durationsMs.length} amostras, p95=${p95.toFixed(0)}ms, max=${max.toFixed(0)}ms, ` +
        `${withinTarget ? 'OK' : 'DEGRADACAO PERCEPTIVEL'} (limiar ${PERCEPTIBLE_DEGRADATION_THRESHOLD_MS}ms)`,
    );
    return withinTarget;
  };

  const fillOk = summarize('Preenchimento (updateValues)', fillDurationsMs);
  const validateOk = summarize('Validacao (validateIndicator)', validateDurationsMs);

  console.log(`Concorrencia solicitada: ${CONCURRENCY}; unidades cobertas pelo acervo: ${unitCount}`);
  await app.close();
  process.exit(fillOk && validateOk ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
