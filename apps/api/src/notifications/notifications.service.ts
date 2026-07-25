import { Injectable, Logger } from '@nestjs/common';
import { ReportInstance, RoleName, Unit, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildElevationRequestedEmail,
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
    await this.emailService.send({ to, ...buildSlaOverdueEmail(report, report.unit) });
  }

  async notifySubmittedForReview(report: ReportInstance, unit: Unit): Promise<void> {
    const to = await this.findUnitRoleEmails(unit.id, [RoleName.REVISOR]);
    await this.emailService.send({ to, ...buildSubmittedForReviewEmail(report, unit) });
  }

  async notifySubmittedForApproval(report: ReportInstance, unit: Unit): Promise<void> {
    const to = await this.findOrgWideRoleEmails([RoleName.APROVADOR]);
    await this.emailService.send({ to, ...buildSubmittedForApprovalEmail(report, unit) });
  }

  async notifyReportReproved(report: ReportInstance, unit: Unit): Promise<void> {
    const to = await this.findUnitRoleEmails(unit.id, [RoleName.ELABORADOR, RoleName.REVISOR]);
    await this.emailService.send({ to, ...buildReportReprovedEmail(report, unit) });
  }

  async notifyReportConcluded(report: ReportInstance, unit: Unit): Promise<void> {
    const to = await this.findUnitRoleEmails(unit.id, [RoleName.ELABORADOR, RoleName.REVISOR]);
    await this.emailService.send({ to, ...buildReportConcludedEmail(report, unit) });
  }

  async notifyElevationRequested(
    user: Pick<User, 'nome' | 'sobrenome' | 'matricula'>,
    requestedRole: RoleName,
  ): Promise<void> {
    const to = await this.findOrgWideRoleEmails([RoleName.ADMINISTRADOR]);
    if (to.length === 0) {
      return;
    }
    await this.emailService.send({ to, ...buildElevationRequestedEmail(user, requestedRole) });
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
