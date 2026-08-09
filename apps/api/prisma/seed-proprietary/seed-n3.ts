import { GoalOperator, PrismaClient } from '@prisma/client';
import { AuditContextService } from '../../src/common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../../src/common/services/system-actor';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { FormTemplateSeed, seedFormTemplate } from './seed-utils';

// Definicao estrutural do formulario N3, extraida por engenharia reversa de
// "./template-forms/Relatorio Operacional de Tecnologia da Informacao - N3.docx"
// (Secao 4 do PROMPT.md). Isolado do core: so roda quando SEED_PROPRIETARY_FORMS=true
// (ver docker-entrypoint.sh) ou via `npm run seed:n3`.
//
// Omitidos deliberadamente (mesmo motivo do seed N1): secao "4. Melhorias e
// Aprimoramentos" (texto livre, sem meta/formula) e "5. Notas de Versao".
//
// Divergencias conhecidas entre o texto literal do .docx e o motor de
// formula (formula-evaluator.util.ts), que so avalia aritmetica pura
// (+ - * /) sobre variaveis informadas — sem condicionais, min/max ou
// funcoes de calendario:
//
// 1.2 "Endpoints: Inventario de Computadores" — o doc descreve uma regra
//     condicional ("se EGA e EGI forem iguais, = 100; senao, (Menor/Maior) x
//     100"). Sem suporte a condicional/min/max, foi usada a aproximacao
//     aritmetica (EGA / EGI) * 100, que reproduz o mesmo resultado quando
//     EGA == EGI e degrada de forma continua (nao em degrau) quando os
//     valores divergem. Revisar com o time de governanca na Fase 12 se a
//     aproximacao for considerada insuficiente.
//
// 1.5 "Vulnerabilidades: Atualizacoes de Seguranca de Firewall" — o doc
//     preve que TAR=0 e ARA=0 resulte em 100 (nenhuma atualizacao
//     recomendada no mes = conformidade plena). Sem condicional, a formula
//     (ARA / TAR) * 100 gera erro de divisao por zero nesse caso (o
//     avaliador bloqueia explicitamente), exigindo lancamento manual/atencao
//     do Elaborador nesse mes especifico em vez de auto-preencher 100.
//
// 3.2 "Educacao: Conscientizacao em Seguranca da Informacao" — o texto do
//     .docx grafa a formula como "(ARC / ARP) x 100", mas ARC nunca e
//     definido como campo; os campos declarados sao APP (Acoes Planejadas)
//     e ARP (Acoes Realizadas). Tratado como erro de digitacao do
//     documento-fonte e corrigido para (ARP / APP) * 100, que corresponde a
//     semantica descrita ("Realizadas sobre Planejadas") e aos campos
//     realmente declarados.
//
// 2.4 "Data Center: Conformidade do Ambiente Fisico" — o checklist de 8
//     itens SIM/NAO foi modelado como 8 variaveis numericas 0/1 (1 = SIM),
//     somadas na formula, ja que o avaliador nao tem funcao de contagem
//     nativa — soma aritmetica de flags 0/1 produz o mesmo resultado.

const N3_TEMPLATE: FormTemplateSeed = {
  name: 'N3 - Relatório Operacional de TI (Unidades Geridas)',
  description:
    'Formulario proprietario N3, para unidades geridas de maior complexidade (ex.: CRER). ' +
    'Extraido de template-forms/Relatório Operacional de Tecnologia da Informação - N3.docx.',
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
          title: 'Endpoints: Inventário de Computadores',
          objective: 'Mensurar o índice de paridade entre o sistema de inventário de estações de trabalho e a solução de antivírus.',
          variableKeys: ['EGA', 'EGI'],
          formulaExpression: '(EGA / EGI) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 98.0,
          order: 2,
        },
        {
          title: 'Riscos: Pontuação de Risco Cibernético',
          objective: 'Mensurar o índice de risco cibernético presente nas estações de trabalho monitoradas pelo antivírus.',
          variableKeys: ['PRE'],
          formulaExpression: 'PRE',
          goalOperator: GoalOperator.LTE,
          goalValue: 25,
          order: 3,
        },
        {
          title: 'Ameaças: Resposta a Malwares',
          objective:
            'Mensurar o índice de mitigação de malwares identificados nas estações de trabalho monitoradas pelo antívirus.',
          variableKeys: ['TOM', 'RNR'],
          formulaExpression: '((TOM - RNR) / TOM) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 90.0,
          order: 4,
        },
        {
          title: 'Vulnerabilidades: Atualizações de Segurança de Firewall',
          objective: 'Mensurar o índice de conformidade com as atualizações recomendadas para o firewall.',
          variableKeys: ['TAR', 'ARA'],
          formulaExpression: '(ARA / TAR) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 90.0,
          order: 5,
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
          title: 'Firewall: Disponibilidade',
          objective: 'Mensurar o índice de disponibilidade de firewall baseado no tempo total de inatividade.',
          variableKeys: ['IFP', 'MINUTOS_MENSAIS'],
          formulaExpression: '((MINUTOS_MENSAIS - IFP) / MINUTOS_MENSAIS) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 99.0,
          order: 2,
        },
        {
          title: 'Backup: Cobertura Efetiva dos Ativos Críticos',
          objective:
            'Mensurar o índice de resiliência operacional dos ativos críticos baseado na existência de cópias de ' +
            'segurança válidas e restauráveis capazes de garantir a retomada dos serviços em caso de falha ou incidente.',
          variableKeys: ['MVC', 'MBR', 'DRC', 'DBR'],
          formulaExpression: '((MBR + DBR) / (MVC + DRC)) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 95.0,
          order: 3,
        },
        {
          title: 'Data Center: Conformidade do Ambiente Físico',
          objective: 'Mensurar o índice de conformidade técnica do data center baseado nas condições atuais do ambiente físico.',
          variableKeys: [
            'TEMP',
            'NOBREAK',
            'CABOS',
            'LIMPEZA_RACK',
            'GOTEIRAS',
            'ACESSO_FISICO',
            'CAMERAS',
            'RUIDOS',
          ],
          formulaExpression:
            '((TEMP + NOBREAK + CABOS + LIMPEZA_RACK + GOTEIRAS + ACESSO_FISICO + CAMERAS + RUIDOS) / 8) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 85.0,
          order: 4,
        },
        {
          title: 'Internet: Disponibilidade',
          objective: 'Mensurar o índice de disponibilidade de internet baseado no tempo de total ausência de conectividade.',
          variableKeys: ['ICL', 'MINUTOS_MENSAIS'],
          formulaExpression: '((MINUTOS_MENSAIS - ICL) / MINUTOS_MENSAIS) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 99.0,
          order: 5,
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
        {
          title: 'Educação: Conscientização em Segurança da Informação',
          objective: 'Mensurar o índice de ações realizadas para a conscientização e capacitação dos colaboradores sobre segurança da informação.',
          variableKeys: ['APP', 'ARP'],
          formulaExpression: '(ARP / APP) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 90.0,
          order: 2,
        },
        {
          title: 'Conformidade: Revisão de Acessos e Permissões',
          objective:
            'Mensurar a execução das revisões periódicas de segurança (acessos, permissões e políticas), assegurando ' +
            'a conformidade dos perfis, regras e softwares com as diretrizes e padrões institucionais.',
          variableKeys: ['RP', 'RR'],
          formulaExpression: '(RR / RP) * 100',
          goalOperator: GoalOperator.GTE,
          goalValue: 90.0,
          order: 3,
        },
      ],
    },
  ],
};

const prisma = new PrismaClient();
const auditContextService = new AuditContextService(prisma as unknown as PrismaService);

runAsSystemActor(auditContextService, 'Seed proprietario — formulario N3', AUDIT_ORIGIN_SEED, () =>
  auditContextService.runWithAuditContext((tx) => seedFormTemplate(tx, N3_TEMPLATE)),
)
  .catch((error) => {
    console.error('[seed-proprietary] Falha ao executar seed N3:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
