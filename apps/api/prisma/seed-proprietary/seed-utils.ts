import { GoalOperator, Prisma } from '@prisma/client';

// Helpers de seed idempotente para os formularios proprietarios N1/N3
// (Secao 4 do PROMPT.md — "Injecao de Templates Proprietarios"). FormTopic e
// FormIndicator nao tem unique constraint composta no schema (so
// FormTemplate.name e @unique), entao usamos findFirst + create/update em
// vez de prisma.upsert() para manter os scripts re-executaveis sem duplicar
// linhas a cada rodada.

export interface IndicatorSeed {
  title: string;
  objective: string;
  variableKeys: string[];
  formulaExpression: string;
  goalOperator: GoalOperator;
  goalValue: number;
  isResidentState?: boolean;
  order: number;
}

// Distribui `total` pontos igualmente entre `count` indicadores usando o
// metodo dos maiores restos, para que a soma exata bata com `total` mesmo
// quando a divisao nao e exata (ex.: 10/13 indicadores no formulario N3).
// Duplicado de apps/api/src/forms/score-distribution.util.ts: os scripts de
// seed rodam isolados do resto do backend (ver comentario no topo deste
// arquivo) e nao importam de src/, entao a logica e replicada aqui.
export function distributeScoreWeights(count: number, total = 10): number[] {
  if (count <= 0) {
    return [];
  }

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  return Array.from({ length: count }, (_, index) => {
    const cents = baseCents + (index < remainderCents ? 1 : 0);
    return cents / 100;
  });
}

export interface TopicSeed {
  title: string;
  order: number;
  indicators: IndicatorSeed[];
}

export interface FormTemplateSeed {
  name: string;
  description: string;
  topics: TopicSeed[];
}

export async function seedFormTemplate(prisma: Prisma.TransactionClient, template: FormTemplateSeed): Promise<void> {
  const formTemplate = await prisma.formTemplate.upsert({
    where: { name: template.name },
    update: { description: template.description },
    create: { name: template.name, description: template.description },
  });

  // Peso de cada indicador distribuido igualmente para que a soma total do
  // template bata exatamente 10 (regra de negocio validada em
  // FormIndicatorsService.updateScores), na mesma ordem em que os
  // indicadores aparecem nos topicos abaixo.
  const totalIndicatorCount = template.topics.reduce((sum, topic) => sum + topic.indicators.length, 0);
  const scoreWeights = distributeScoreWeights(totalIndicatorCount);
  let scoreWeightIndex = 0;

  for (const topic of template.topics) {
    const formTopic = await upsertTopic(prisma, formTemplate.id, topic.title, topic.order);

    for (const indicator of topic.indicators) {
      await upsertIndicator(prisma, formTopic.id, indicator, scoreWeights[scoreWeightIndex]);
      scoreWeightIndex++;
    }
  }

  console.log(`[seed-proprietary] Template "${template.name}" garantido (${template.topics.length} topico(s)).`);
}

async function upsertTopic(prisma: Prisma.TransactionClient, formTemplateId: string, title: string, order: number) {
  const existing = await prisma.formTopic.findFirst({ where: { formTemplateId, title } });
  if (existing) {
    return prisma.formTopic.update({ where: { id: existing.id }, data: { order, isActive: true } });
  }
  return prisma.formTopic.create({ data: { formTemplateId, title, order } });
}

// Deriva um code estavel a partir do titulo, para que reexecucoes do seed
// reaproveitem a mesma entrada de catalogo em vez de duplicar (A6, FR-062).
function catalogCodeFromTitle(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toUpperCase()
    .slice(0, 40);
  return `N1N3_${slug}`;
}

async function upsertCatalogEntry(prisma: Prisma.TransactionClient, indicator: IndicatorSeed) {
  const code = catalogCodeFromTitle(indicator.title);
  const existing = await prisma.indicatorCatalog.findUnique({ where: { code } });
  if (existing) {
    return existing;
  }
  // measurementUnit provisorio — nao ha unidade de medida declarada nos
  // formularios proprietarios hoje; revisar via tela de catalogo (US4).
  return prisma.indicatorCatalog.create({
    data: { code, name: indicator.title, measurementUnit: 'A_DEFINIR', description: indicator.objective },
  });
}

async function upsertIndicator(
  prisma: Prisma.TransactionClient,
  formTopicId: string,
  indicator: IndicatorSeed,
  scoreWeight: number,
) {
  const existing = await prisma.formIndicator.findFirst({ where: { formTopicId, title: indicator.title } });
  const catalogEntry = await upsertCatalogEntry(prisma, indicator);
  const data = {
    objective: indicator.objective,
    variableKeys: indicator.variableKeys,
    formulaExpression: indicator.formulaExpression,
    goalOperator: indicator.goalOperator,
    goalValue: indicator.goalValue,
    isResidentState: indicator.isResidentState ?? false,
    order: indicator.order,
    isActive: true,
    scoreWeight,
    catalogEntryId: catalogEntry.id,
  };

  if (existing) {
    return prisma.formIndicator.update({ where: { id: existing.id }, data });
  }
  return prisma.formIndicator.create({ data: { formTopicId, title: indicator.title, ...data } });
}
