import { Injectable, Logger } from '@nestjs/common';
import { ReportStatus, Unit } from '@prisma/client';
import { AuditContextService } from '../common/services/audit-context.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { InheritanceService } from '../reports/inheritance.service';
import { PrismaService } from '../prisma/prisma.service';
import { getMandatoryNationalHolidays, getNthBusinessDayOfMonth, toUtcMidnight } from './business-days.util';

function previousMonthUtc(referenceMonth: Date): Date {
  return new Date(Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth() - 1, 1));
}

// Abre o periodo mensal de uma unidade (Secao 4, item 1 do PROMPT.md):
// cria o ReportInstance em status PENDENTE, computa os prazos de cada fase
// em Dias Uteis e instancia um IndicatorResponse (snapshot) para cada
// indicador ativo do formulario da unidade, clonando o valor do periodo
// anterior para os indicadores marcados como Estado Residente.
@Injectable()
export class ReportLifecycleService {
  private readonly logger = new Logger(ReportLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly auditContextService: AuditContextService,
    private readonly inheritanceService: InheritanceService,
  ) {}

  async openPeriodForUnit(unit: Unit, referenceMonth: Date) {
    if (!unit.formTemplateId) {
      this.logger.debug(`Unidade ${unit.sigla} sem formulario associado — nenhum periodo aberto.`);
      return null;
    }

    const normalizedMonth = toUtcMidnight(referenceMonth);
    const existing = await this.prisma.reportInstance.findUnique({
      where: { unitId_referenceMonth: { unitId: unit.id, referenceMonth: normalizedMonth } },
    });
    if (existing) {
      return existing;
    }

    const year = normalizedMonth.getUTCFullYear();
    const monthIndex0 = normalizedMonth.getUTCMonth();
    const holidays = getMandatoryNationalHolidays(year);
    const settings = await this.platformSettingsService.getSettings();

    const elaborationDueDate = getNthBusinessDayOfMonth(
      year,
      monthIndex0,
      settings.slaElaborationBusinessDay,
      holidays,
    );
    const reviewDueDate = getNthBusinessDayOfMonth(year, monthIndex0, settings.slaReviewBusinessDay, holidays);
    const approvalDueDate = getNthBusinessDayOfMonth(year, monthIndex0, settings.slaApprovalBusinessDay, holidays);

    const indicators = await this.prisma.formIndicator.findMany({
      where: { isActive: true, formTopic: { isActive: true, formTemplateId: unit.formTemplateId } },
    });

    const previousInstance = await this.prisma.reportInstance.findUnique({
      where: { unitId_referenceMonth: { unitId: unit.id, referenceMonth: previousMonthUtc(normalizedMonth) } },
      include: { indicatorResponses: true },
    });

    // Cria IndicatorResponse (tabela auditada) — precisa de contexto ativo,
    // seja o da requisicao HTTP (abertura via US1/T052a) seja o do ator de
    // sistema (cron, ver LifecycleCronService/SystemActor — T028b).
    return this.auditContextService.runWithAuditContext(async (tx) => {
      const reportInstance = await tx.reportInstance.create({
        data: {
          unitId: unit.id,
          formTemplateId: unit.formTemplateId as string,
          referenceMonth: normalizedMonth,
          status: ReportStatus.PENDENTE,
          elaborationDueDate,
          reviewDueDate,
          approvalDueDate,
        },
      });

      for (const indicator of indicators) {
        const previousResponse = previousInstance?.indicatorResponses.find(
          (response) => response.formIndicatorId === indicator.id,
        );
        const shouldCloneResidentState = indicator.isResidentState && Boolean(previousResponse);
        const { variableValues, inheritanceState, unresolvedInheritedKeys } = this.inheritanceService.inheritValues(
          indicator.variableKeys,
          shouldCloneResidentState ? (previousResponse!.variableValues as Record<string, number>) : null,
        );

        const response = await tx.indicatorResponse.create({
          data: {
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
            inheritanceState,
            unresolvedInheritedKeys,
            isClonedFromResident: shouldCloneResidentState,
            // updatedAt deixou de ser auto-gerenciado pelo Prisma (A1):
            // IndicatorResponse e identidade estavel, nao sofre UPDATE
            // isolado. O timestamp e mantido explicitamente por quem
            // escreve — aqui, a criacao inicial vazia do periodo.
            updatedAt: new Date(),
          },
        });

        // T046/T047: mesmo o valor inicial (herdado ou vazio) e uma versao
        // real, nao so a projecao — senao a primeira edicao do elaborador
        // (T047) fecharia uma versao anterior que nunca existiu. O gatilho
        // de fechamento (20260810090000) so tem o que fechar se toda
        // resposta nascer com uma versao.
        const version = await tx.indicatorResponseVersion.create({
          data: {
            indicatorResponseId: response.id,
            variableValues,
            inheritanceState,
            unresolvedInheritedKeys,
            originLegacy: false,
          },
        });

        await tx.indicatorResponse.update({
          where: { id: response.id },
          data: { currentVersionId: version.id },
        });
      }

      return reportInstance;
    });
  }
}
