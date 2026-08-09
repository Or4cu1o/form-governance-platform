import { GoalOperator, PrismaClient } from '@prisma/client';
import { AuditContextService } from '../../src/common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../../src/common/services/system-actor';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { FormTemplateSeed, seedFormTemplate } from './seed-utils';

// Definicao estrutural do formulario N1, extraida por engenharia reversa de
// "./template-forms/Relatorio Operacional de Tecnologia da Informacao - N1.docx"
// (Secao 4 do PROMPT.md). Isolado do core: so roda quando SEED_PROPRIETARY_FORMS=true
// (ver docker-entrypoint.sh) ou via `npm run seed:n1`.
//
// Omitidos deliberadamente por nao se encaixarem no schema FormIndicator
// (que exige goalOperator/goalValue/formula numerica): a secao "4. Melhorias
// e Aprimoramentos" (log qualitativo em texto livre) e "5. Notas de Versao"
// (changelog do documento, nao um indicador).
//
// "Total de minutos mensais" (indicadores de disponibilidade) nao e um valor
// fixo — varia com o numero de dias do mes — e o avaliador de formula
// (formula-evaluator.util.ts) so entende aritmetica sobre variaveis
// informadas, sem funcoes de calendario. Por isso foi modelado como uma
// variavel de entrada manual (MINUTOS_MENSAIS) preenchida pelo Elaborador a
// cada mes, em vez de uma constante embutida na formula.

const N1_TEMPLATE: FormTemplateSeed = {
  name: 'N1 - Relatório Operacional de TI (Unidades Geridas)',
  description:
    'Formulario proprietario N1, para unidades geridas de menor complexidade (ex.: Agir Corporativo). ' +
    'Extraido de template-forms/Relatório Operacional de Tecnologia da Informação - N1.docx.',
  topics: [
    {
      title: '1. Segurança da Informação',
      order: 1,
      indicators: [
        {
          title: 'Endpoints: Gerenciados pelo Antivírus Corporativo',
          objective: 'Mensurar o índice de instalação da solução de antivírus nas estações de trabalho.',
          variableKeys: ['EGA', 'ENG'],
          formulaExpression: '(EGA / (ENG + EGA)) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 98.0,
          order: 1,
        },
        {
          title: 'Ameaças: Resposta a Malwares',
          objective:
            'Mensurar o índice de mitigação de malwares identificados nas estações de trabalho monitoradas pelo antivírus.',
          variableKeys: ['TOM', 'RNR'],
          formulaExpression: '((TOM - RNR) / TOM) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 90.0,
          order: 2,
        },
      ],
    },
    {
      title: '2. Infraestrutura Tecnológica',
      order: 2,
      indicators: [
        {
          title: 'Servidores: Estado Operacional',
          objective:
            'Mensurar o índice de conformidade operacional dos servidores baseado na validade da garantia do ' +
            'servidor físico e no licenciamento do sistema operacional das máquinas virtuais.',
          variableKeys: ['SFP', 'SGA', 'MVP', 'MVL'],
          formulaExpression: '((SGA + MVL) / (SFP + MVP)) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 90.0,
          isResidentState: true,
          order: 1,
        },
        {
          title: 'Internet: Disponibilidade',
          objective: 'Mensurar o índice de disponibilidade de internet baseado no tempo de total ausência de conectividade.',
          variableKeys: ['ICL', 'MINUTOS_MENSAIS'],
          formulaExpression: '((MINUTOS_MENSAIS - ICL) / MINUTOS_MENSAIS) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 99.0,
          order: 2,
        },
      ],
    },
    {
      title: '3. Governança',
      order: 3,
      indicators: [
        {
          title: 'Chamados de Suporte: Backlog',
          objective: 'Mensurar o índice de resolutividade de chamados de suporte baseado no total de chamados abertos e sem solução.',
          variableKeys: ['CA', 'CB'],
          formulaExpression: '(CB / CA) * 100',
          goalOperator: GoalOperator.LTE,
          goalValue: 5.0,
          order: 1,
        },
      ],
    },
  ],
};

const prisma = new PrismaClient();
const auditContextService = new AuditContextService(prisma as unknown as PrismaService);

runAsSystemActor(auditContextService, 'Seed proprietario — formulario N1', AUDIT_ORIGIN_SEED, () =>
  auditContextService.runWithAuditContext((tx) => seedFormTemplate(tx, N1_TEMPLATE)),
)
  .catch((error) => {
    console.error('[seed-proprietary] Falha ao executar seed N1:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
