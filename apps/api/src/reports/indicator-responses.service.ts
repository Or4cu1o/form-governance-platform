import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    const hasAllValues = response.snapshotVariableKeys.every((key) => key in mergedValues);

    let calculatedValue: number | null = null;
    let isCompliant: boolean | null = null;
    if (hasAllValues) {
      calculatedValue = evaluateFormula(response.snapshotFormulaExpression, mergedValues);
      isCompliant = checkCompliance(calculatedValue, response.snapshotGoalOperator, Number(response.snapshotGoalValue));
    }

    return this.auditContextService.runWithAuditContext((tx) =>
      tx.indicatorResponse.update({
        where: { id: responseId },
        data: {
          variableValues: mergedValues,
          calculatedValue,
          isCompliant,
          criticalAnalysis: dto.criticalAnalysis !== undefined ? dto.criticalAnalysis : response.criticalAnalysis,
          actionPlan: dto.actionPlan !== undefined ? dto.actionPlan : response.actionPlan,
          updatedByUserId: user.id,
        },
      }),
    );
  }
}
