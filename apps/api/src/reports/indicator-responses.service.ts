import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InheritanceState } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { assertCanEditReportData } from '../common/report-edit-access.util';
import { AuditContextService } from '../common/services/audit-context.service';
import { checkCompliance, evaluateFormula } from '../forms/formula-evaluator.util';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateIndicatorResponseDto } from './dto/update-indicator-response.dto';

@Injectable()
export class IndicatorResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContextService: AuditContextService,
  ) {}

  async updateValues(responseId: string, user: AuthenticatedUser, dto: UpdateIndicatorResponseDto) {
    const response = await this.prisma.indicatorResponse.findUnique({
      where: { id: responseId },
      include: { reportInstance: true },
    });
    if (!response) {
      throw new NotFoundException('Resposta de indicador nao encontrada');
    }
    assertCanEditReportData(response.reportInstance, user);

    const allowedKeys = new Set(response.snapshotVariableKeys);
    const unknownKeys = Object.keys(dto.variableValues).filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
      throw new BadRequestException(`Chaves nao declaradas para este indicador: ${unknownKeys.join(', ')}`);
    }
    for (const [key, value] of Object.entries(dto.variableValues)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new BadRequestException(`Valor invalido para "${key}": deve ser um numero finito`);
      }
    }

    const previousValues = (response.variableValues as Record<string, number>) ?? {};
    const mergedValues = { ...previousValues, ...dto.variableValues };
    const missingKeys = response.snapshotVariableKeys.filter((key) => !(key in mergedValues));
    const hasAllValues = missingKeys.length === 0;

    // FR-028/FR-031: variavel ausente ou calculo impossivel (denominador
    // zero, resultado fora do dominio) NUNCA aborta a gravacao com 400 —
    // persiste ausencia de resultado com o motivo exato, conformidade
    // indefinida. A comparacao de conformidade usa o float de
    // evaluateFormula em precisao inteira, sem arredondamento previo: o
    // arredondamento (Decimal(18,4) no banco) so acontece na escrita, uma
    // unica vez, nunca antes da decisao de conformidade (FR-031).
    let calculatedValue: number | null = null;
    let isCompliant: boolean | null = null;
    let calculationFailureReason: string | null = null;
    if (hasAllValues) {
      try {
        calculatedValue = evaluateFormula(response.snapshotFormulaExpression, mergedValues);
        isCompliant = checkCompliance(
          calculatedValue,
          response.snapshotGoalOperator,
          Number(response.snapshotGoalValue),
        );
      } catch (error) {
        calculatedValue = null;
        isCompliant = null;
        calculationFailureReason = error instanceof Error ? error.message : String(error);
      }
    } else {
      calculationFailureReason = `Aguardando valor de: ${missingKeys.join(', ')}`;
    }

    const criticalAnalysis = dto.criticalAnalysis !== undefined ? dto.criticalAnalysis : response.criticalAnalysis;
    const actionPlan = dto.actionPlan !== undefined ? dto.actionPlan : response.actionPlan;

    return this.auditContextService.runWithAuditContext(async (tx) => {
      // T047 (Principio I): a resposta em si nunca sofre UPDATE de conteudo
      // — toda alteracao abre uma versao nova (INSERT em
      // IndicatorResponseVersion). A versao anterior e fechada pelo gatilho
      // de banco (fn_close_previous_indicator_response_version,
      // 20260810090000): UPDATE esta revogado nessa tabela para a role da
      // aplicacao, entao o fechamento nao pode ser feito por aqui.
      const version = await tx.indicatorResponseVersion.create({
        data: {
          indicatorResponseId: responseId,
          variableValues: mergedValues,
          calculatedValue,
          calculationFailureReason,
          isCompliant,
          criticalAnalysis,
          actionPlan,
          authoredByUserId: user.id,
          // Uma edicao humana supera o estado "herdado, ainda nao
          // conferido" desta resposta — a nova versao passa a ser autoral,
          // nao herdada.
          inheritanceState: InheritanceState.NAO_HERDADO,
          unresolvedInheritedKeys: [],
          originLegacy: false,
        },
      });

      return tx.indicatorResponse.update({
        where: { id: responseId },
        data: {
          variableValues: mergedValues,
          calculatedValue,
          calculationFailureReason,
          isCompliant,
          criticalAnalysis,
          actionPlan,
          inheritanceState: InheritanceState.NAO_HERDADO,
          unresolvedInheritedKeys: [],
          updatedByUserId: user.id,
          updatedAt: new Date(),
          currentVersionId: version.id,
        },
      });
    });
  }
}
