import { Injectable, Logger } from '@nestjs/common';
import { ReportInstance, RoleName, Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildReportConcludedEmail,
  buildReportReprovedEmail,
  buildSlaOverdueEmail,
  buildSubmittedForApprovalEmail,
  buildSubmittedForReviewEmail,
} from './email-templates.util';
import { EmailService } from './email.service';

// Ponto de contato do motor de ciclo de vida (Fase 5) e dos fluxos de
// Elaboracao/Revisao/Validacao (Secao 6 do PROMPT.md) com o envio real de
// e-mail. Resolve destinatarios por papel — escopo de unidade para
// Elaborador/Revisor, organizacional para Aprovador (Secao 3).
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async notifySlaOverdue(report: ReportInstance & { unit: Unit }): Promise<void> {
    this.logger.warn(
      `[SLA] Relatorio ${report.id} da unidade ${report.unit.sigla} ainda esta PENDENTE no 5o dia util do periodo.`,
    );
    let recipients: string[] = [];
    await this.safely('notifySlaOverdue', report.id, async () => {
      recipients = await this.findUnitRoleEmails(report.unit.id, [RoleName.ELABORADOR]);
      await this.emailService.send({ to: recipients, ...buildSlaOverdueEmail(report, report.unit) });
    }, () => recipients);
  }

  async notifySubmittedForReview(report: ReportInstance, unit: Unit): Promise<void> {
    let recipients: string[] = [];
    await this.safely('notifySubmittedForReview', report.id, async () => {
      recipients = await this.findUnitRoleEmails(unit.id, [RoleName.REVISOR]);
      await this.emailService.send({ to: recipients, ...buildSubmittedForReviewEmail(report, unit) });
    }, () => recipients);
  }

  async notifySubmittedForApproval(report: ReportInstance, unit: Unit): Promise<void> {
    let recipients: string[] = [];
    await this.safely('notifySubmittedForApproval', report.id, async () => {
      recipients = await this.findOrgWideRoleEmails([RoleName.APROVADOR]);
      await this.emailService.send({ to: recipients, ...buildSubmittedForApprovalEmail(report, unit) });
    }, () => recipients);
  }

  async notifyReportReproved(report: ReportInstance, unit: Unit): Promise<void> {
    let recipients: string[] = [];
    await this.safely('notifyReportReproved', report.id, async () => {
      recipients = await this.findUnitRoleEmails(unit.id, [RoleName.ELABORADOR, RoleName.REVISOR]);
      await this.emailService.send({ to: recipients, ...buildReportReprovedEmail(report, unit) });
    }, () => recipients);
  }

  async notifyReportConcluded(report: ReportInstance, unit: Unit): Promise<void> {
    let recipients: string[] = [];
    await this.safely('notifyReportConcluded', report.id, async () => {
      recipients = await this.findUnitRoleEmails(unit.id, [RoleName.ELABORADOR, RoleName.REVISOR]);
      await this.emailService.send({ to: recipients, ...buildReportConcludedEmail(report, unit) });
    }, () => recipients);
  }

  // As notificacoes sao um efeito colateral best-effort das transicoes de
  // status, que ja foram persistidas no banco quando chegamos aqui. Uma
  // falha em QUALQUER etapa (resolver destinatarios ou enviar o e-mail) nao
  // pode virar 500 para o caller depois que a transacao ja comitou — por
  // isso o corpo inteiro do fluxo e protegido, nao so a chamada de envio.
  //
  // T170/FR-123/FR-112 — a falha deixa de existir so em logger.error e vira
  // um registro consultavel (NotificationFailure): servico/operacao/causa
  // (regra geral de FR-123) e destinatario/transicao afetados (o que
  // FR-112 acrescenta). getRecipients() captura o que ja foi resolvido ate
  // o ponto da falha — [] se a propria resolucao de destinatarios falhou.
  private async safely(
    operation: string,
    reportInstanceId: string,
    fn: () => Promise<void>,
    getRecipients: () => string[],
  ): Promise<void> {
    try {
      await fn();
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao processar notificacao (${operation})`, error instanceof Error ? error.stack : cause);
      await this.persistFailure(operation, reportInstanceId, getRecipients(), cause);
    }
  }

  // Registro em si tambem e best-effort (FR-123: nao pode bloquear o
  // ciclo) — se a propria escrita falhar (ex.: banco indisponivel), o log
  // de aplicacao e o unico recurso restante.
  private async persistFailure(
    operation: string,
    reportInstanceId: string,
    recipients: string[],
    cause: string,
  ): Promise<void> {
    try {
      await this.prisma.notificationFailure.create({
        data: { service: 'notifications', operation, reportInstanceId, recipients, cause },
      });
    } catch (persistError) {
      this.logger.error(
        `Falha ao registrar NotificationFailure (${operation})`,
        persistError instanceof Error ? persistError.stack : String(persistError),
      );
    }
  }

  private async findUnitRoleEmails(unitId: string, roles: RoleName[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { primaryUnitId: unitId, role: { in: roles }, isActive: true },
      select: { email: true },
    });
    return users.map((user) => user.email);
  }

  private async findOrgWideRoleEmails(roles: RoleName[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { email: true },
    });
    return users.map((user) => user.email);
  }
}
