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
    const to = await this.findUnitRoleEmails(report.unit.id, [RoleName.ELABORADOR]);
    await this.sendSafely({ to, ...buildSlaOverdueEmail(report, report.unit) });
  }

  async notifySubmittedForReview(report: ReportInstance, unit: Unit): Promise<void> {
    const to = await this.findUnitRoleEmails(unit.id, [RoleName.REVISOR]);
    await this.sendSafely({ to, ...buildSubmittedForReviewEmail(report, unit) });
  }

  async notifySubmittedForApproval(report: ReportInstance, unit: Unit): Promise<void> {
    const to = await this.findOrgWideRoleEmails([RoleName.APROVADOR]);
    await this.sendSafely({ to, ...buildSubmittedForApprovalEmail(report, unit) });
  }

  async notifyReportReproved(report: ReportInstance, unit: Unit): Promise<void> {
    const to = await this.findUnitRoleEmails(unit.id, [RoleName.ELABORADOR, RoleName.REVISOR]);
    await this.sendSafely({ to, ...buildReportReprovedEmail(report, unit) });
  }

  async notifyReportConcluded(report: ReportInstance, unit: Unit): Promise<void> {
    const to = await this.findUnitRoleEmails(unit.id, [RoleName.ELABORADOR, RoleName.REVISOR]);
    await this.sendSafely({ to, ...buildReportConcludedEmail(report, unit) });
  }

  // As notificacoes sao um efeito colateral best-effort das transicoes de
  // status, que ja foram persistidas no banco quando chegamos aqui. Uma
  // falha de SMTP nao pode virar 500 para o caller depois que a transacao
  // ja comitou — por isso o erro e logado, nunca propagado.
  private async sendSafely(message: Parameters<EmailService['send']>[0]): Promise<void> {
    try {
      await this.emailService.send(message);
    } catch (error) {
      this.logger.error(`Falha ao enviar notificacao por e-mail para ${message.to.join(', ')}`, error);
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
