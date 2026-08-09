import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_ORIGIN_CRON, runAsSystemActor } from '../common/services/system-actor';
import { AuditContextService } from '../common/services/audit-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getBusinessDayOrdinalInMonth, getMandatoryNationalHolidays } from './business-days.util';
import { ReportLifecycleService } from './report-lifecycle.service';

function firstDayOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

// Engine de Cron do SLA (Secao 4 do PROMPT.md). Roda todo dia util as 06:00
// e decide o que fazer com base em qual DU do mes o dia de hoje representa —
// mais robusto do que tentar mirar uma data fixa por mes, ja que o 1o/5o DU
// caem em dias do calendario diferentes a cada mes.
@Injectable()
export class LifecycleCronService {
  private readonly logger = new Logger(LifecycleCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportLifecycleService: ReportLifecycleService,
    private readonly notificationsService: NotificationsService,
    private readonly auditContextService: AuditContextService,
  ) {}

  @Cron('0 6 * * 1-5')
  async handleDailyBusinessDayCheck(): Promise<void> {
    // Sem requisicao HTTP nao ha AuditContextInterceptor — o cron precisa do
    // seu proprio contexto de ator de sistema para que openMonthlyPeriods
    // (que cria IndicatorResponse via ReportLifecycleService) nao seja
    // rejeitado pelo gatilho de auditoria (T028b).
    return runAsSystemActor(
      this.auditContextService,
      'Motor de SLA — verificacao diaria de dia util',
      AUDIT_ORIGIN_CRON,
      async () => {
        const today = new Date();
        const holidays = getMandatoryNationalHolidays(today.getUTCFullYear());
        const ordinal = getBusinessDayOrdinalInMonth(today, holidays);

        if (ordinal === null) {
          this.logger.debug('Hoje nao e dia util (feriado nacional) — nenhuma acao do motor de SLA.');
          return;
        }

        if (ordinal === 1) {
          await this.openMonthlyPeriods(today);
        }
        if (ordinal === 5) {
          await this.checkSlaOverdue(today);
        }
      },
    );
  }

  async openMonthlyPeriods(today: Date): Promise<void> {
    const referenceMonth = firstDayOfMonthUtc(today);
    const units = await this.prisma.unit.findMany({
      where: { isActive: true, formTemplateId: { not: null } },
    });

    for (const unit of units) {
      await this.reportLifecycleService.openPeriodForUnit(unit, referenceMonth);
    }
    this.logger.log(`Abertura de periodo (1o DU): ${units.length} unidade(s) processada(s).`);
  }

  async checkSlaOverdue(today: Date): Promise<void> {
    const referenceMonth = firstDayOfMonthUtc(today);
    const overdueReports = await this.prisma.reportInstance.findMany({
      where: { referenceMonth, status: ReportStatus.PENDENTE },
      include: { unit: true },
    });

    for (const report of overdueReports) {
      await this.notificationsService.notifySlaOverdue(report);
    }
    this.logger.log(`Checagem de estouro de SLA (5o DU): ${overdueReports.length} relatorio(s) pendente(s).`);
  }
}
