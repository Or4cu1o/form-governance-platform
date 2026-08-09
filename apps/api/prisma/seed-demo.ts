import {
  GoalOperator,
  IndicatorValidationStatus,
  Prisma,
  PrismaClient,
  ReportStatus,
  RoleName,
  UnitLevel,
  ValidationVerdict,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { checkCompliance, evaluateFormula } from '../src/forms/formula-evaluator.util';
import { AuditContextService } from '../src/common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../src/common/services/system-actor';
import type { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
const auditContextService = new AuditContextService(prisma as unknown as PrismaService);

const SALT_ROUNDS = 10;
const DEV_TEST_PASSWORD = 'FormOpsTeste@2026';

type TemplateWithTopics = Prisma.FormTemplateGetPayload<{
  include: { topics: { include: { indicators: true } } };
}>;

// Sorteia quais indicadores (por índice) ficam fora da meta em um mês, dado um
// total de indicadores e uma taxa-alvo. Como o número de indicadores por
// template é pequeno (ex.: 5 no N1), não dá para fatiar exatamente uma
// porcentagem — a contagem-alvo é arredondada probabilisticamente (parte
// fracionária de rate*count vira a chance de arredondar para cima) para que a
// MÉDIA ao longo dos meses convirja para a taxa pedida, mesmo que um mês
// isolado fique em 20% ou 40% (frações mais próximas possíveis com 5 itens).
function pickNonCompliantIndices(indicatorCount: number, rate: number): Set<number> {
  const expectedCount = rate * indicatorCount;
  const baseCount = Math.floor(expectedCount);
  const roundUpChance = expectedCount - baseCount;
  const targetCount = Math.random() < roundUpChance ? baseCount + 1 : baseCount;

  const shuffledIndices = Array.from({ length: indicatorCount }, (_, idx) => idx);
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
  }

  return new Set(shuffledIndices.slice(0, targetCount));
}

// ---------------------------------------------------------------------------
// Definição das 5 Unidades Hospitalares da Demonstração
// ---------------------------------------------------------------------------
interface DemoUnitConfig {
  sigla: string;
  nome: string;
  level: UnitLevel;
  templateNamePrefix: 'N1' | 'N3';
  elaboradorMatricula: string;
  elaboradorNome: string;
  elaboradorSobrenome: string;
  elaboradorEmail: string;
  revisorMatricula: string;
  revisorNome: string;
  revisorSobrenome: string;
  revisorEmail: string;
}

const DEMO_UNITS: DemoUnitConfig[] = [
  {
    sigla: 'HUGO',
    nome: 'Hospital de Urgências de Goiás',
    level: UnitLevel.A,
    templateNamePrefix: 'N1',
    elaboradorMatricula: '20001',
    elaboradorNome: 'Eduardo',
    elaboradorSobrenome: 'Oliveira',
    elaboradorEmail: 'elaborador.hugo@matriz.dev',
    revisorMatricula: '30001',
    revisorNome: 'Renata',
    revisorSobrenome: 'Martins',
    revisorEmail: 'revisor.hugo@matriz.dev',
  },
  {
    sigla: 'HEAPA',
    nome: 'Hospital Estadual de Aparecida de Goiânia',
    level: UnitLevel.B,
    templateNamePrefix: 'N1',
    elaboradorMatricula: '20002',
    elaboradorNome: 'Enzo',
    elaboradorSobrenome: 'Rodrigues',
    elaboradorEmail: 'elaborador.heapa@matriz.dev',
    revisorMatricula: '30002',
    revisorNome: 'Rodrigo',
    revisorSobrenome: 'Ferreira',
    revisorEmail: 'revisor.heapa@matriz.dev',
  },
  {
    sigla: 'HUGOL',
    nome: 'Hospital de Urgências Governador Otávio Lage',
    level: UnitLevel.A,
    templateNamePrefix: 'N3',
    elaboradorMatricula: '20003',
    elaboradorNome: 'Eliane',
    elaboradorSobrenome: 'Costa',
    elaboradorEmail: 'elaborador.hugol@matriz.dev',
    revisorMatricula: '30003',
    revisorNome: 'Rafael',
    revisorSobrenome: 'Lima',
    revisorEmail: 'revisor.hugol@matriz.dev',
  },
  {
    sigla: 'HETRIN',
    nome: 'Hospital Estadual de Trindade',
    level: UnitLevel.B,
    templateNamePrefix: 'N3',
    elaboradorMatricula: '20004',
    elaboradorNome: 'Evelyn',
    elaboradorSobrenome: 'Santos',
    elaboradorEmail: 'elaborador.hetrin@matriz.dev',
    revisorMatricula: '30004',
    revisorNome: 'Raquel',
    revisorSobrenome: 'Barbosa',
    revisorEmail: 'revisor.hetrin@matriz.dev',
  },
  {
    sigla: 'HECAD',
    nome: 'Hospital Estadual da Criança e do Adolescente',
    level: UnitLevel.A,
    templateNamePrefix: 'N3',
    elaboradorMatricula: '20005',
    elaboradorNome: 'Eric',
    elaboradorSobrenome: 'Almeida',
    elaboradorEmail: 'elaborador.hecad@matriz.dev',
    revisorMatricula: '30005',
    revisorNome: 'Ricardo',
    revisorSobrenome: 'Cardoso',
    revisorEmail: 'revisor.hecad@matriz.dev',
  },
];

// ---------------------------------------------------------------------------
// Gerador de Variáveis Realistas por Indicador, Mês e Status de Conformidade
// ---------------------------------------------------------------------------
function generateVariableValues(
  variableKeys: string[],
  monthIndex: number,
  templatePrefix: 'N1' | 'N3',
  isNonCompliant: boolean,
): Record<string, number> {
  const isN3 = templatePrefix === 'N3';
  const scale = isN3 ? 2 : 1;
  const daysInMonth = [31, 28, 31, 30, 31, 30][monthIndex] || 30;
  const minutosMensais = daysInMonth * 24 * 60;
  const sortedKeys = [...variableKeys].sort().join(',');

  if (sortedKeys === 'EGA,ENG') {
    if (isNonCompliant) {
      return { EGA: 460 * scale, ENG: 40 * scale };
    }
    const ega = (490 + monthIndex * 3) * scale;
    const eng = 10 * scale;
    return { EGA: ega, ENG: eng };
  }

  if (sortedKeys === 'EGA,EGI') {
    if (isNonCompliant) {
      return { EGA: 930, EGI: 990 };
    }
    const ega = 980 + monthIndex * 5;
    const egi = ega + 5;
    return { EGA: ega, EGI: egi };
  }

  if (sortedKeys === 'PRE') {
    if (isNonCompliant) {
      return { PRE: 32 };
    }
    const pre = 18 - (monthIndex % 4);
    return { PRE: pre };
  }

  if (sortedKeys === 'RNR,TOM') {
    if (isNonCompliant) {
      return { TOM: 20 * scale, RNR: 4 * scale };
    }
    const tom = (15 + monthIndex * 2) * scale;
    const rnr = monthIndex % 2 === 0 ? 0 : 1;
    return { TOM: tom, RNR: rnr };
  }

  if (sortedKeys === 'ARA,TAR') {
    if (isNonCompliant) {
      return { TAR: 10, ARA: 7 };
    }
    const tar = 5 + (monthIndex % 3);
    const ara = tar;
    return { TAR: tar, ARA: ara };
  }

  if (sortedKeys === 'MVL,MVP,SFP,SGA') {
    if (isNonCompliant) {
      return { SFP: 10 * scale, SGA: 7 * scale, MVP: 40 * scale, MVL: 34 * scale };
    }
    const sfp = 10 * scale;
    const sga = sfp;
    const mvp = 40 * scale;
    const mvl = mvp;
    return { SFP: sfp, SGA: sga, MVP: mvp, MVL: mvl };
  }

  if (sortedKeys === 'IFP,MINUTOS_MENSAIS') {
    if (isNonCompliant) {
      return { IFP: 1200, MINUTOS_MENSAIS: minutosMensais };
    }
    const ifp = 10 + monthIndex * 2;
    return { IFP: ifp, MINUTOS_MENSAIS: minutosMensais };
  }

  if (sortedKeys === 'DBR,DRC,MBR,MVC') {
    if (isNonCompliant) {
      return { MVC: 50, MBR: 40, DRC: 30, DBR: 20 };
    }
    const mvc = 50 + monthIndex * 2;
    const mbr = mvc;
    const drc = 20;
    const dbr = 20;
    return { MVC: mvc, MBR: mbr, DRC: drc, DBR: dbr };
  }

  if (sortedKeys.includes('NOBREAK') && sortedKeys.includes('TEMP')) {
    if (isNonCompliant) {
      return {
        TEMP: 1,
        NOBREAK: 1,
        CABOS: 0,
        LIMPEZA_RACK: 1,
        GOTEIRAS: 1,
        ACESSO_FISICO: 0,
        CAMERAS: 1,
        RUIDOS: 0,
      };
    }
    return {
      TEMP: 1,
      NOBREAK: 1,
      CABOS: 1,
      LIMPEZA_RACK: 1,
      GOTEIRAS: 1,
      ACESSO_FISICO: 1,
      CAMERAS: 1,
      RUIDOS: 1,
    };
  }

  if (sortedKeys === 'ICL,MINUTOS_MENSAIS') {
    if (isNonCompliant) {
      return { ICL: 900, MINUTOS_MENSAIS: minutosMensais };
    }
    const icl = 15 + monthIndex * 3;
    return { ICL: icl, MINUTOS_MENSAIS: minutosMensais };
  }

  if (sortedKeys === 'CA,CB') {
    if (isNonCompliant) {
      return { CA: 200 * scale, CB: 18 * scale };
    }
    const ca = (200 + monthIndex * 20) * scale;
    const cb = Math.floor(ca * 0.03);
    return { CA: ca, CB: cb };
  }

  if (sortedKeys === 'APP,ARP') {
    if (isNonCompliant) {
      return { APP: 4, ARP: 2 };
    }
    const app = 2 + (monthIndex % 2);
    const arp = app;
    return { APP: app, ARP: arp };
  }

  if (sortedKeys === 'RP,RR') {
    if (isNonCompliant) {
      return { RP: 10, RR: 6 };
    }
    const rp = 10 + monthIndex;
    const rr = rp;
    return { RP: rp, RR: rr };
  }

  const fallback: Record<string, number> = {};
  variableKeys.forEach((key) => {
    fallback[key] = 10;
  });
  return fallback;
}

// Análise crítica e plano de ação contextualizados
function generateAnalysisAndPlan(
  indicatorTitle: string,
  monthName: string,
  isCompliant: boolean,
): { criticalAnalysis: string; actionPlan: string | null } {
  if (isCompliant) {
    if (indicatorTitle.includes('Antivírus')) {
      return {
        criticalAnalysis: `Solução de antivírus corporativo mantida com cobertura contínua nas estações de trabalho durante ${monthName}.`,
        actionPlan: null,
      };
    }
    if (indicatorTitle.includes('Servidores')) {
      return {
        criticalAnalysis: `Ambiente de servidores operando em 100% de conformidade de garantia e licenciamento no mês de ${monthName}.`,
        actionPlan: null,
      };
    }
    if (indicatorTitle.includes('Disponibilidade')) {
      return {
        criticalAnalysis: `Disponibilidade do link mantida dentro da SLA contratada durante ${monthName}, sem indícios de instabilidade crítica.`,
        actionPlan: null,
      };
    }
    if (indicatorTitle.includes('Chamados')) {
      return {
        criticalAnalysis: `Volume de backlog controlado e mantido abaixo do limite teto tático de 5% no período de ${monthName}.`,
        actionPlan: null,
      };
    }
    return {
      criticalAnalysis: `Indicador apurado e aprovado conforme os parâmetros de governança técnica definidos para ${monthName}.`,
      actionPlan: null,
    };
  } else {
    if (indicatorTitle.includes('Antivírus') || indicatorTitle.includes('Inventário')) {
      return {
        criticalAnalysis: `Índice registrado abaixo da meta operacional durante ${monthName} devido à inclusão de novas estações em lote que aguardam homologação presencial.`,
        actionPlan: `Força-tarefa da equipe de suporte agendada para realizar o rollout e a padronização do agente nas máquinas pendentes em até 10 dias úteis.`,
      };
    }
    if (indicatorTitle.includes('Servidores')) {
      return {
        criticalAnalysis: `Identificada expiração temporária de suporte em 2 servidores físicos legados durante o mês de ${monthName}.`,
        actionPlan: `Abertura de processo emergencial de renovação de garantia contratual e migração de cargas de trabalho para o cluster virtualizado.`,
      };
    }
    if (indicatorTitle.includes('Disponibilidade') || indicatorTitle.includes('Firewall')) {
      return {
        criticalAnalysis: `Oscilações no link principal de telecomunicações no dia 14 de ${monthName} geraram tempo de inatividade superior à margem permitida pela meta.`,
        actionPlan: `Abertura de chamado de descumprimento de SLA junto à operadora com pedido de ressarcimento e reconfiguração do tempo de failover da redundância.`,
      };
    }
    if (indicatorTitle.includes('Chamados')) {
      return {
        criticalAnalysis: `Pico atípico na abertura de solicitações administrativas durante ${monthName} elevou o backlog temporariamente acima do teto de 5%.`,
        actionPlan: `Reordenamento da fila de atendimento com alocação temporária de 2 analistas adicionais para zerar o backlog na primeira semana do mês seguinte.`,
      };
    }
    if (indicatorTitle.includes('Backup')) {
      return {
        criticalAnalysis: `Falha de rotina de cópia em servidor secundário de homologação durante ${monthName} impactou a margem de cobertura global.`,
        actionPlan: `Revisão do script de automação de backup e execução de teste manual de restauração (bare-metal restore) para homologação.`,
      };
    }
    return {
      criticalAnalysis: `Desvio técnico apurado no mês de ${monthName}. A meta estabelecida não foi atingida dentro da janela operacional regulamentar.`,
      actionPlan: `Elaboração e execução do plano de adequação prioritário junto à coordenação técnica da unidade com report diário.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Geração dos 6 relatórios mensais concluídos (Janeiro a Junho de 2026)
// ---------------------------------------------------------------------------
async function generateConcludedMonthlyReports(
  db: Prisma.TransactionClient,
  unitId: string,
  template: TemplateWithTopics,
  templatePrefix: 'N1' | 'N3',
  elaboradorId: string,
  aprovadorMatrizId: string,
  computeNonCompliance: (monthIndex: number, indicatorIndex: number) => boolean,
): Promise<void> {
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'];

  for (let m = 0; m < 6; m++) {
    const year = 2026;
    const referenceMonth = new Date(Date.UTC(year, m, 1));
    const monthNameStr = `${monthNames[m]} de ${year}`;

    const elaborationDueDate = new Date(Date.UTC(year, m + 1, 8));
    const reviewDueDate = new Date(Date.UTC(year, m + 1, 10));
    const approvalDueDate = new Date(Date.UTC(year, m + 1, 14));

    const submittedForReviewAt = new Date(Date.UTC(year, m + 1, 4, 14, 30));
    const submittedForApprovalAt = new Date(Date.UTC(year, m + 1, 7, 10, 15));
    const concludedAt = new Date(Date.UTC(year, m + 1, 9, 16, 45));

    const reportInstance = await db.reportInstance.upsert({
      where: {
        unitId_referenceMonth: {
          unitId,
          referenceMonth,
        },
      },
      update: {
        formTemplateId: template.id,
        status: ReportStatus.CONCLUIDO,
        elaborationDueDate,
        reviewDueDate,
        approvalDueDate,
        submittedForReviewAt,
        submittedForApprovalAt,
        concludedAt,
        slaDeflatorApplied: 0.0,
        isElaborationOnTime: true,
        isReviewOnTime: true,
      },
      create: {
        unitId,
        formTemplateId: template.id,
        referenceMonth,
        status: ReportStatus.CONCLUIDO,
        elaborationDueDate,
        reviewDueDate,
        approvalDueDate,
        submittedForReviewAt,
        submittedForApprovalAt,
        concludedAt,
        slaDeflatorApplied: 0.0,
        isElaborationOnTime: true,
        isReviewOnTime: true,
      },
    });

    const allIndicators = template.topics.flatMap((t) => t.indicators);
    let calculatedIndicatorScore = 0;

    for (let i = 0; i < allIndicators.length; i++) {
      const indicator = allIndicators[i];

      const shouldBeNonCompliant = computeNonCompliance(m, i);

      const variableValues = generateVariableValues(
        indicator.variableKeys,
        m,
        templatePrefix,
        shouldBeNonCompliant,
      );
      const calculatedValue = evaluateFormula(indicator.formulaExpression, variableValues);
      const isCompliant = checkCompliance(calculatedValue, indicator.goalOperator, Number(indicator.goalValue));
      const { criticalAnalysis, actionPlan } = generateAnalysisAndPlan(indicator.title, monthNameStr, isCompliant);

      if (isCompliant) {
        calculatedIndicatorScore += Number(indicator.scoreWeight);
      }

      const response = await db.indicatorResponse.upsert({
        where: {
          reportInstanceId_formIndicatorId: {
            reportInstanceId: reportInstance.id,
            formIndicatorId: indicator.id,
          },
        },
        update: {
          snapshotTitle: indicator.title,
          snapshotObjective: indicator.objective,
          snapshotVariableKeys: indicator.variableKeys,
          snapshotFormulaExpression: indicator.formulaExpression,
          snapshotGoalOperator: indicator.goalOperator,
          snapshotGoalValue: indicator.goalValue,
          snapshotScoreWeight: indicator.scoreWeight,
          variableValues,
          calculatedValue,
          isCompliant,
          validationStatus: IndicatorValidationStatus.APROVADO,
          criticalAnalysis,
          actionPlan,
          updatedByUserId: elaboradorId,
        },
        create: {
          reportInstanceId: reportInstance.id,
          formIndicatorId: indicator.id,
          snapshotTitle: indicator.title,
          snapshotObjective: indicator.objective,
          snapshotVariableKeys: indicator.variableKeys,
          snapshotFormulaExpression: indicator.formulaExpression,
          snapshotGoalOperator: indicator.goalOperator,
          snapshotGoalValue: indicator.goalValue,
          snapshotScoreWeight: indicator.scoreWeight,
          variableValues,
          calculatedValue,
          isCompliant,
          validationStatus: IndicatorValidationStatus.APROVADO,
          criticalAnalysis,
          actionPlan,
          updatedByUserId: elaboradorId,
          updatedAt: new Date(),
        },
      });

      const existingRecord = await db.validationRecord.findFirst({
        where: {
          indicatorResponseId: response.id,
          aprovadorUserId: aprovadorMatrizId,
        },
      });

      if (!existingRecord) {
        await db.validationRecord.create({
          data: {
            indicatorResponseId: response.id,
            aprovadorUserId: aprovadorMatrizId,
            verdict: ValidationVerdict.APROVADO,
            justification: 'Validação técnica realizada e aprovada conforme métricas e evidências de governança.',
          },
        });
      }
    }

    const finalScore = Math.round(calculatedIndicatorScore * 100) / 100;

    await db.reportInstance.update({
      where: { id: reportInstance.id },
      data: {
        indicatorScore: finalScore,
        totalScore: finalScore,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Geração do relatório do mês vigente (Julho/2026) em status PENDENTE
// ---------------------------------------------------------------------------
async function generatePendingReport(
  db: Prisma.TransactionClient,
  unitId: string,
  template: TemplateWithTopics,
): Promise<void> {
  const currentMonthRef = new Date(Date.UTC(2026, 6, 1)); // 01/07/2026
  const elabDueDateJul = new Date(Date.UTC(2026, 7, 10)); // 6º DU de Agosto/2026 (A prazo)
  const revDueDateJul = new Date(Date.UTC(2026, 7, 12));
  const appDueDateJul = new Date(Date.UTC(2026, 7, 14));

  const pendingReportJul = await db.reportInstance.upsert({
    where: {
      unitId_referenceMonth: {
        unitId,
        referenceMonth: currentMonthRef,
      },
    },
    update: {
      formTemplateId: template.id,
      status: ReportStatus.PENDENTE,
      elaborationDueDate: elabDueDateJul,
      reviewDueDate: revDueDateJul,
      approvalDueDate: appDueDateJul,
    },
    create: {
      unitId,
      formTemplateId: template.id,
      referenceMonth: currentMonthRef,
      status: ReportStatus.PENDENTE,
      elaborationDueDate: elabDueDateJul,
      reviewDueDate: revDueDateJul,
      approvalDueDate: appDueDateJul,
    },
  });

  const currentIndicators = template.topics.flatMap((t) => t.indicators);
  for (const indicator of currentIndicators) {
    await db.indicatorResponse.upsert({
      where: {
        reportInstanceId_formIndicatorId: {
          reportInstanceId: pendingReportJul.id,
          formIndicatorId: indicator.id,
        },
      },
      update: {
        snapshotTitle: indicator.title,
        snapshotObjective: indicator.objective,
        snapshotVariableKeys: indicator.variableKeys,
        snapshotFormulaExpression: indicator.formulaExpression,
        snapshotGoalOperator: indicator.goalOperator,
        snapshotGoalValue: indicator.goalValue,
        snapshotScoreWeight: indicator.scoreWeight,
        validationStatus: IndicatorValidationStatus.EM_REVISAO,
      },
      create: {
        reportInstanceId: pendingReportJul.id,
        formIndicatorId: indicator.id,
        snapshotTitle: indicator.title,
        snapshotObjective: indicator.objective,
        snapshotVariableKeys: indicator.variableKeys,
        snapshotFormulaExpression: indicator.formulaExpression,
        snapshotGoalOperator: indicator.goalOperator,
        snapshotGoalValue: indicator.goalValue,
        snapshotScoreWeight: indicator.scoreWeight,
        validationStatus: IndicatorValidationStatus.EM_REVISAO,
        updatedAt: new Date(),
      },
    });
  }
}

async function main() {
  // Este seed cria usuarios com senha fixa (DEV_TEST_PASSWORD) — nunca pode
  // rodar em producao, no mesmo padrao de guarda usado em seed.ts.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo.ts nao pode ser executado com NODE_ENV=production (cria usuarios com senha fixa)');
  }

  console.log('=== Iniciando Seed da Demonstração (5 Unidades / Jan-Jun Concluídos + Julho PENDENTE a Prazo) ===');

  // Todo o corpo abaixo escreve em tabelas auditadas (indicator_responses ja
  // hoje; unit/user a partir de T167) — roda inteiro dentro de um unico
  // AuditContext de sistema (T028b). O parametro `prisma` deste callback
  // ofusca deliberadamente a constante `prisma` do modulo (mesma API de
  // model delegate), para que o corpo abaixo nao precisasse ser reescrito
  // chamada a chamada.
  await runAsSystemActor(
    auditContextService,
    'Seed de demonstracao — 5 unidades hospitalares + MATRIZ',
    AUDIT_ORIGIN_SEED,
    () =>
      auditContextService.runWithAuditContext(async (prisma) => {
        // Limpar relatórios de meses posteriores a julho de 2026 (mês 8 em diante)
        const futureReports = await prisma.reportInstance.findMany({
          where: { referenceMonth: { gte: new Date(Date.UTC(2026, 7, 1)) } },
          select: { id: true },
        });
        const futureIds = futureReports.map((r) => r.id);
        if (futureIds.length > 0) {
          await prisma.indicatorResponse.deleteMany({ where: { reportInstanceId: { in: futureIds } } });
          await prisma.reportInstance.deleteMany({ where: { id: { in: futureIds } } });
        }

        // 1. Obter os formulários N1 e N3 do banco
        const n1Template = await prisma.formTemplate.findFirst({
          where: { name: { startsWith: 'N1' } },
          include: { topics: { include: { indicators: true } } },
        });
        const n3Template = await prisma.formTemplate.findFirst({
          where: { name: { startsWith: 'N3' } },
          include: { topics: { include: { indicators: true } } },
        });

        if (!n1Template || !n3Template) {
          throw new Error(
            'Formulários N1 e N3 não foram encontrados no banco. Execute "npm run seed:proprietary" antes do seed de demonstração.',
          );
        }

        // 2. Garantir o Usuário Aprovador da Matriz para aprovar as demonstrações
        let aprovadorMatriz = await prisma.user.findFirst({
          where: { role: RoleName.APROVADOR },
        });

        if (!aprovadorMatriz) {
          const matrizUnit = await prisma.unit.findFirstOrThrow({ where: { sigla: 'MATRIZ' } });
          const passwordHash = await bcrypt.hash(DEV_TEST_PASSWORD, SALT_ROUNDS);
          aprovadorMatriz = await prisma.user.create({
            data: {
              matricula: '10004',
              nome: 'Aprovador',
              sobrenome: 'Matriz',
              email: 'aprovador@matriz.dev',
              passwordHash,
              role: RoleName.APROVADOR,
              primaryUnitId: matrizUnit.id,
            },
          });
        }

        const passwordHash = await bcrypt.hash(DEV_TEST_PASSWORD, SALT_ROUNDS);

        // 3. Processar cada uma das 5 unidades hospitalares
        for (let uIndex = 0; uIndex < DEMO_UNITS.length; uIndex++) {
          const config = DEMO_UNITS[uIndex];
          const template = config.templateNamePrefix === 'N1' ? n1Template : n3Template;

          // 3.1 Upsert da Unidade
          const unit = await prisma.unit.upsert({
            where: { sigla: config.sigla },
            update: {
              nome: config.nome,
              level: config.level,
              formTemplateId: template.id,
              isActive: true,
            },
            create: {
              sigla: config.sigla,
              nome: config.nome,
              level: config.level,
              formTemplateId: template.id,
              isActive: true,
            },
          });

          // 3.2 Upsert do Elaborador da Unidade
          const elaborador = await prisma.user.upsert({
            where: { matricula: config.elaboradorMatricula },
            update: {
              nome: config.elaboradorNome,
              sobrenome: config.elaboradorSobrenome,
              email: config.elaboradorEmail,
              passwordHash,
              role: RoleName.ELABORADOR,
              primaryUnitId: unit.id,
              isActive: true,
            },
            create: {
              matricula: config.elaboradorMatricula,
              nome: config.elaboradorNome,
              sobrenome: config.elaboradorSobrenome,
              email: config.elaboradorEmail,
              passwordHash,
              role: RoleName.ELABORADOR,
              primaryUnitId: unit.id,
            },
          });

          // 3.3 Upsert do Revisor da Unidade
          await prisma.user.upsert({
            where: { matricula: config.revisorMatricula },
            update: {
              nome: config.revisorNome,
              sobrenome: config.revisorSobrenome,
              email: config.revisorEmail,
              passwordHash,
              role: RoleName.REVISOR,
              primaryUnitId: unit.id,
              isActive: true,
            },
            create: {
              matricula: config.revisorMatricula,
              nome: config.revisorNome,
              sobrenome: config.revisorSobrenome,
              email: config.revisorEmail,
              passwordHash,
              role: RoleName.REVISOR,
              primaryUnitId: unit.id,
            },
          });

          console.log(`✓ Unidade ${unit.sigla} (${unit.nome}) e usuários de acesso sincronizados.`);

          // 4. Gerar 6 relatórios concluídos (Jan-Jun/2026), com não-conformidade
          //    determinística por unidade/mês/indicador, e o relatório PENDENTE de Julho.
          await generateConcludedMonthlyReports(
            prisma,
            unit.id,
            template,
            config.templateNamePrefix,
            elaborador.id,
            aprovadorMatriz.id,
            (m, i) => (uIndex * 7 + m * 5 + i * 3) % 10 < 3,
          );
          await generatePendingReport(prisma, unit.id, template);

          console.log(`  └─ 6 relatórios concluídos (Jan-Jun) + 1 relatório PENDENTE A PRAZO (Julho 2026) gerados para ${config.sigla}.`);
        }

        // 4. Unidade MATRIZ: também precisa de histórico para permitir a demonstração
        //    da elaboração (não apenas revisão/aprovação como nas 5 unidades acima).
        //    Indicadores dentro/fora da meta sorteados aleatoriamente por indicador,
        //    com taxa de não-conformidade sorteada por mês entre 25% e 35% (variável).
        const matrizTemplate = n1Template;
        const matrizUnit = await prisma.unit.upsert({
          where: { sigla: 'MATRIZ' },
          update: { formTemplateId: matrizTemplate.id },
          create: { sigla: 'MATRIZ', nome: 'Matriz', level: UnitLevel.A, formTemplateId: matrizTemplate.id },
        });
        const matrizElaborador = await prisma.user.findFirstOrThrow({ where: { matricula: '10002' } });

        const MIN_NON_COMPLIANCE_RATE = 0.25;
        const NON_COMPLIANCE_RATE_SPREAD = 0.1; // faixa de 25% a 35%
        const monthlyNonComplianceRates = Array.from(
          { length: 6 },
          () => MIN_NON_COMPLIANCE_RATE + Math.random() * NON_COMPLIANCE_RATE_SPREAD,
        );
        const matrizIndicatorCount = matrizTemplate.topics.flatMap((t) => t.indicators).length;
        const monthlyNonCompliantIndices = monthlyNonComplianceRates.map((rate) =>
          pickNonCompliantIndices(matrizIndicatorCount, rate),
        );

        await generateConcludedMonthlyReports(
          prisma,
          matrizUnit.id,
          matrizTemplate,
          'N1',
          matrizElaborador.id,
          aprovadorMatriz.id,
          (m, i) => monthlyNonCompliantIndices[m].has(i),
        );
        await generatePendingReport(prisma, matrizUnit.id, matrizTemplate);

        console.log(
          `✓ Unidade MATRIZ: 6 relatórios concluídos (Jan-Jun, ${monthlyNonComplianceRates
            .map((r) => `${Math.round(r * 100)}%`)
            .join('/')} fora da meta por mês) + 1 relatório PENDENTE A PRAZO (Julho 2026) gerados.`,
        );

        console.log('\n=== Seed de Demonstração Concluído com Sucesso! ===');
      }),
  );
}

main()
  .catch((error) => {
    console.error('Falha ao executar seed de demonstração:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
