import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormIndicatorDto } from './dto/create-form-indicator.dto';
import { UpdateFormIndicatorDto } from './dto/update-form-indicator.dto';
import { UpdateIndicatorScoresDto } from './dto/update-indicator-scores.dto';
import { validateFormulaExpression } from './formula-validator.util';
import { distributeScoreWeights } from './score-distribution.util';

const TOTAL_SCORE_BUDGET = 10;
const SCORE_SUM_TOLERANCE = 0.01;

@Injectable()
export class FormIndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContextService: AuditContextService,
  ) {}

  async create(formTopicId: string, dto: CreateFormIndicatorDto) {
    const topic = await this.prisma.formTopic.findUnique({ where: { id: formTopicId } });
    if (!topic) {
      throw new NotFoundException('Topico nao encontrado');
    }
    validateFormulaExpression(dto.formulaExpression, dto.variableKeys);

    const indicator = await this.auditContextService.runWithAuditContext((tx) =>
      tx.formIndicator.create({ data: { ...dto, formTopicId } }),
    );
    const weightRebalance = await this.buildProposedRedistribution(topic.formTemplateId);
    return { indicator, weightRebalance };
  }

  async update(id: string, dto: UpdateFormIndicatorDto) {
    const indicator = await this.ensureExists(id);

    const nextVariableKeys = dto.variableKeys ?? indicator.variableKeys;
    const nextFormula = dto.formulaExpression ?? indicator.formulaExpression;
    validateFormulaExpression(nextFormula, nextVariableKeys);

    return this.auditContextService.runWithAuditContext((tx) =>
      tx.formIndicator.update({ where: { id }, data: dto }),
    );
  }

  async setActive(id: string, isActive: boolean) {
    const indicator = await this.ensureExists(id);
    const updated = await this.auditContextService.runWithAuditContext((tx) =>
      tx.formIndicator.update({ where: { id }, data: { isActive } }),
    );

    // T085: ativar/inativar altera o conjunto de indicadores ativos, o que
    // pode desbalancear a soma dos pesos — propoe a redistribuicao (sem
    // aplicar) para o admin confirmar, em vez de deixar o desbalanco mudo.
    const topic = await this.prisma.formTopic.findUnique({ where: { id: indicator.formTopicId } });
    const weightRebalance = topic ? await this.buildProposedRedistribution(topic.formTemplateId) : null;
    return { indicator: updated, weightRebalance };
  }

  // FR-064/US4-3: recusa vincular um formulario a uma unidade, ou instanciar
  // um relatorio a partir dele, enquanto a soma dos pesos ativos nao for
  // exatamente 10,00 — sem impedir que o formulario em si seja salvo.
  async assertBalanced(formTemplateId: string): Promise<void> {
    const indicators = await this.findActiveIndicators(formTemplateId);
    const summary = this.buildScoreSummary(indicators);
    if (Math.abs(summary.sum - TOTAL_SCORE_BUDGET) > SCORE_SUM_TOLERANCE) {
      throw new BadRequestException(
        `A soma dos pesos dos indicadores ativos deste formulario deve ser ${TOTAL_SCORE_BUDGET} (atual: ${summary.sum.toFixed(2)}).`,
      );
    }
  }

  async getScores(formTemplateId: string) {
    const indicators = await this.findActiveIndicators(formTemplateId);
    return this.buildScoreSummary(indicators);
  }

  async updateScores(formTemplateId: string, dto: UpdateIndicatorScoresDto) {
    const indicators = await this.findActiveIndicators(formTemplateId);
    const activeIds = new Set(indicators.map((indicator) => indicator.id));
    const providedIds = new Set(dto.weights.map((entry) => entry.indicatorId));

    if (activeIds.size !== providedIds.size || [...activeIds].some((id) => !providedIds.has(id))) {
      throw new BadRequestException(
        'O corpo da requisicao deve conter exatamente os indicadores ativos deste formulario.',
      );
    }

    const sum = dto.weights.reduce((total, entry) => total + entry.scoreWeight, 0);
    if (Math.abs(sum - TOTAL_SCORE_BUDGET) > SCORE_SUM_TOLERANCE) {
      throw new BadRequestException(
        `A soma dos pesos dos indicadores deve ser ${TOTAL_SCORE_BUDGET} (atual: ${sum.toFixed(2)}).`,
      );
    }

    await this.auditContextService.runWithAuditContext(async (tx) => {
      for (const entry of dto.weights) {
        await tx.formIndicator.update({
          where: { id: entry.indicatorId },
          data: { scoreWeight: entry.scoreWeight },
        });
      }
    });

    const updated = await this.findActiveIndicators(formTemplateId);
    return this.buildScoreSummary(updated);
  }

  async distributeEvenly(formTemplateId: string) {
    const indicators = await this.findActiveIndicators(formTemplateId);
    if (indicators.length === 0) {
      throw new BadRequestException('O formulario nao possui indicadores ativos para distribuir a pontuacao.');
    }

    const weights = distributeScoreWeights(indicators.length, TOTAL_SCORE_BUDGET);
    await this.auditContextService.runWithAuditContext(async (tx) => {
      for (const [index, indicator] of indicators.entries()) {
        await tx.formIndicator.update({
          where: { id: indicator.id },
          data: { scoreWeight: weights[index] },
        });
      }
    });

    const updated = await this.findActiveIndicators(formTemplateId);
    return this.buildScoreSummary(updated);
  }

  private async findActiveIndicators(formTemplateId: string) {
    const template = await this.prisma.formTemplate.findUnique({ where: { id: formTemplateId } });
    if (!template) {
      throw new NotFoundException('Formulario nao encontrado');
    }

    return this.prisma.formIndicator.findMany({
      where: { isActive: true, formTopic: { isActive: true, formTemplateId } },
      orderBy: [{ formTopic: { order: 'asc' } }, { order: 'asc' }],
    });
  }

  private buildScoreSummary(indicators: Array<{ id: string; title: string; scoreWeight: unknown }>) {
    const items = indicators.map((indicator) => ({
      id: indicator.id,
      title: indicator.title,
      scoreWeight: Number(indicator.scoreWeight),
    }));
    const sum = items.reduce((total, item) => total + item.scoreWeight, 0);
    return { items, sum, target: TOTAL_SCORE_BUDGET };
  }

  private async buildProposedRedistribution(formTemplateId: string) {
    const indicators = await this.findActiveIndicators(formTemplateId);
    if (indicators.length === 0) {
      return null;
    }

    const currentSummary = this.buildScoreSummary(indicators);
    if (Math.abs(currentSummary.sum - TOTAL_SCORE_BUDGET) <= SCORE_SUM_TOLERANCE) {
      return null;
    }

    const proposedWeights = distributeScoreWeights(indicators.length, TOTAL_SCORE_BUDGET);
    return {
      items: indicators.map((indicator, index) => ({
        id: indicator.id,
        title: indicator.title,
        scoreWeight: proposedWeights[index],
      })),
      sum: TOTAL_SCORE_BUDGET,
      target: TOTAL_SCORE_BUDGET,
    };
  }

  private async ensureExists(id: string) {
    const indicator = await this.prisma.formIndicator.findUnique({ where: { id } });
    if (!indicator) {
      throw new NotFoundException('Indicador nao encontrado');
    }
    return indicator;
  }
}
