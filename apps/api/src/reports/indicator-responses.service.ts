import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IndicatorValidationStatus, InheritanceState } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { assertCanEditReportData } from '../common/report-edit-access.util';
import { AuditContextService } from '../common/services/audit-context.service';
import { UnitAccessService } from '../common/services/unit-access.service';
import { checkCompliance, evaluateFormula } from '../forms/formula-evaluator.util';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateIndicatorResponseDto } from './dto/update-indicator-response.dto';
import { IndicatorVersionConflictException } from './indicator-version-conflict.exception';

@Injectable()
export class IndicatorResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContextService: AuditContextService,
    private readonly unitAccessService: UnitAccessService,
  ) {}

  // T062 (FR-058/US2): historico completo de versoes de uma resposta, em
  // ordem cronologica estavel — inclui motivo de falha de calculo e
  // overwroteVersionId quando a versao resultou de sobrescrita consciente.
  async getVersionHistory(responseId: string, user: AuthenticatedUser) {
    const response = await this.prisma.indicatorResponse.findUnique({
      where: { id: responseId },
      include: { reportInstance: true },
    });
    if (!response) {
      throw new NotFoundException('Resposta de indicador nao encontrada');
    }
    // Leitura do historico segue o mesmo escopo de unidade de qualquer
    // outra leitura de relatorio (FR-006) — nao introduz acesso novo.
    await this.unitAccessService.assertReadAccess(response.reportInstance.unitId, user);

    return this.prisma.indicatorResponseVersion.findMany({
      where: { indicatorResponseId: responseId },
      orderBy: { validFrom: 'asc' },
      include: { authoredByUser: { select: { nome: true, sobrenome: true, jobTitle: true } } },
    });
  }

  async updateValues(responseId: string, user: AuthenticatedUser, dto: UpdateIndicatorResponseDto) {
    const response = await this.prisma.indicatorResponse.findUnique({
      where: { id: responseId },
      include: { reportInstance: true },
    });
    if (!response) {
      throw new NotFoundException('Resposta de indicador nao encontrada');
    }
    assertCanEditReportData(response.reportInstance, user);

    // FR-129: a gravacao so avanca se a versao que o autor editava ainda e
    // a corrente, OU se ele ja confirmou a sobrescrita deliberada
    // (overwriteVersionId, segunda requisicao explicita apos ver o 409).
    if (dto.expectedVersionId !== response.currentVersionId && !dto.overwriteVersionId) {
      const current = response.currentVersionId
        ? await this.prisma.indicatorResponseVersion.findUnique({
            where: { id: response.currentVersionId },
            include: { authoredByUser: { select: { nome: true, sobrenome: true, jobTitle: true } } },
          })
        : null;
      throw new IndicatorVersionConflictException({
        versionId: current?.id ?? '',
        variableValues: (current?.variableValues as Record<string, number>) ?? {},
        authoredBy: current?.authoredByUser
          ? { name: `${current.authoredByUser.nome} ${current.authoredByUser.sobrenome}`, jobTitle: current.authoredByUser.jobTitle }
          : null,
        authoredAt: (current?.createdAt ?? new Date()).toISOString(),
      });
    }

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

    // US2-7/T065: um indicador ja aprovado na Mesa de Validacao que seja
    // alterado volta IMEDIATAMENTE (nesta mesma gravacao, nao so na
    // devolucao) a exigir nova contraprova — o veredito anterior nao se
    // aplica mais a um conteudo diferente do que foi avaliado.
    const validationStatus =
      response.validationStatus === IndicatorValidationStatus.APROVADO
        ? IndicatorValidationStatus.EM_REVISAO
        : undefined;

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
          // FR-129: preenchido so na segunda requisicao deliberada, apos o
          // autor ver o valor vencedor e decidir conscientemente
          // sobrescreve-lo — fica distinguivel na trilha de versoes.
          overwroteVersionId: dto.overwriteVersionId ?? null,
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
          ...(validationStatus && { validationStatus }),
        },
      });
    });
  }
}
