import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IndicatorValidationStatus, Prisma, ReportStatus, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UnitAccessService } from '../common/services/unit-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportLifecycleService } from '../lifecycle/report-lifecycle.service';
import { ListReportInstancesQueryDto } from './dto/list-report-instances-query.dto';

@Injectable()
export class ReportInstancesService {
  private readonly logger = new Logger(ReportInstancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly unitAccessService: UnitAccessService,
    private readonly notificationsService: NotificationsService,
    private readonly reportLifecycleService: ReportLifecycleService,
  ) {}

  async startCurrentPeriodForElaborador(user: AuthenticatedUser) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: user.primaryUnitId },
    });
    if (!unit) {
      throw new NotFoundException('Unidade do usuario nao encontrada');
    }
    if (!unit.isActive) {
      throw new BadRequestException('Unidade inativa');
    }
    if (!unit.formTemplateId) {
      throw new BadRequestException('Unidade nao possui formulario associado');
    }

    const now = new Date();
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const report = await this.reportLifecycleService.openPeriodForUnit(unit, currentMonth);
    if (!report) {
      throw new BadRequestException('Nao foi possivel iniciar o relatorio para a unidade');
    }
    return report;
  }

  async ensureCurrentPeriodOpenForAllActiveUnits() {
    try {
      const now = new Date();
      const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const units = await this.prisma.unit.findMany({
        where: { isActive: true, formTemplateId: { not: null } },
      });

      for (const unit of units) {
        await this.reportLifecycleService.openPeriodForUnit(unit, currentMonth);
      }
    } catch (error) {
      // Tolera falhas concorrentes (ex.: duas requisicoes tentando abrir o
      // mesmo periodo ao mesmo tempo), mas registra qualquer outra falha
      // para nao mascarar problemas reais (banco fora do ar, bug de SLA).
      this.logger.warn(
        'Falha ao garantir abertura do periodo corrente para as unidades ativas',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // Painel Central (Secao 5 do PROMPT.md): filtros por unidade, periodo,
  // status, busca global por sigla/nome da unidade, e ordenacao por
  // periodo de referencia ou status.
  async findAllForUser(user: AuthenticatedUser, query: ListReportInstancesQueryDto = {}) {
    await this.ensureCurrentPeriodOpenForAllActiveUnits();

    const hasOrgWideAccess = this.unitAccessService.hasOrgWideReadAccess(user);
    const accessibleUnitIds = hasOrgWideAccess ? null : await this.unitAccessService.getAccessibleUnitIds(user);

    const { unitId, status, referenceMonthFrom, referenceMonthTo, search, sortBy, sortOrder } = query;

    // O filtro de unitId da query nunca pode ALARGAR o escopo do usuario: se
    // ele pedir uma unidade fora do seu acesso, o resultado e vazio, nao a
    // lista sem filtro (ver bypass corrigido nesta revisao).
    if (unitId && accessibleUnitIds && !accessibleUnitIds.includes(unitId)) {
      return [];
    }

    const where: Prisma.ReportInstanceWhereInput = {
      ...(unitId ? { unitId } : accessibleUnitIds ? { unitId: { in: accessibleUnitIds } } : {}),
      ...(status && { status }),
      ...((referenceMonthFrom || referenceMonthTo) && {
        referenceMonth: {
          ...(referenceMonthFrom && { gte: new Date(referenceMonthFrom) }),
          ...(referenceMonthTo && { lte: new Date(referenceMonthTo) }),
        },
      }),
      ...(search && {
        unit: { OR: [{ sigla: { contains: search, mode: 'insensitive' } }, { nome: { contains: search, mode: 'insensitive' } }] },
      }),
    };

    return this.prisma.reportInstance.findMany({
      where,
      include: { unit: true },
      orderBy: { [sortBy ?? 'referenceMonth']: sortOrder ?? 'desc' },
    });
  }

  // Painel Central: visao geral, somente leitura, de TODAS as unidades para
  // qualquer papel autenticado (deliberadamente aberta — informativa e sem
  // acesso ao detalhe do relatorio, que continua protegido por
  // findOneForUser/assertReadAccess). Nao inclui indicatorResponses.
  async findOverviewForAllUnits(query: ListReportInstancesQueryDto = {}) {
    await this.ensureCurrentPeriodOpenForAllActiveUnits();

    const { unitId, status, referenceMonthFrom, referenceMonthTo, search, sortBy, sortOrder } = query;
    const where: Prisma.ReportInstanceWhereInput = {
      ...(unitId && { unitId }),
      ...(status && { status }),
      ...((referenceMonthFrom || referenceMonthTo) && {
        referenceMonth: {
          ...(referenceMonthFrom && { gte: new Date(referenceMonthFrom) }),
          ...(referenceMonthTo && { lte: new Date(referenceMonthTo) }),
        },
      }),
      ...(search && {
        unit: { OR: [{ sigla: { contains: search, mode: 'insensitive' } }, { nome: { contains: search, mode: 'insensitive' } }] },
      }),
    };

    return this.prisma.reportInstance.findMany({
      where,
      select: {
        id: true,
        unitId: true,
        referenceMonth: true,
        status: true,
        totalScore: true,
        elaborationDueDate: true,
        reviewDueDate: true,
        approvalDueDate: true,
        isElaborationOnTime: true,
        isReviewOnTime: true,
        unit: { select: { id: true, sigla: true, nome: true } },
      },
      orderBy: { [sortBy ?? 'referenceMonth']: sortOrder ?? 'desc' },
    });
  }

  async findOneForUser(id: string, user: AuthenticatedUser) {
    const report = await this.prisma.reportInstance.findUnique({
      where: { id },
      include: {
        unit: true,
        indicatorResponses: {
          include: {
            evidenceFiles: { where: { isActive: true } },
            validationRecords: { orderBy: { createdAt: 'asc' } },
            formIndicator: {
              include: {
                formTopic: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!report) {
      throw new NotFoundException('Relatorio nao encontrado');
    }
    await this.unitAccessService.assertReadAccess(report.unitId, user);
    return report;
  }

  async submitForReview(id: string, user: AuthenticatedUser) {
    const updated = await this.transition(
      id,
      user,
      RoleName.ELABORADOR,
      ReportStatus.PENDENTE,
      ReportStatus.EM_REVISAO,
      { submittedForReviewAt: new Date() },
    );
    await this.notificationsService.notifySubmittedForReview(updated, updated.unit);
    return updated;
  }

  async submitForApproval(id: string, user: AuthenticatedUser) {
    const report = await this.prisma.reportInstance.findUnique({ where: { id }, include: { unit: true } });
    if (!report) {
      throw new NotFoundException('Relatorio nao encontrado');
    }
    if (user.role !== RoleName.REVISOR || user.primaryUnitId !== report.unitId) {
      throw new ForbiddenException('Usuario nao autorizado a executar esta transicao para este relatorio');
    }
    if (report.status !== ReportStatus.EM_REVISAO) {
      throw new BadRequestException(
        `Transicao invalida: relatorio esta em ${report.status}, esperado ${ReportStatus.EM_REVISAO}`,
      );
    }

    const updated = await this.prisma.runWithAuditActor(user.id, async (tx) => {
      await tx.indicatorResponse.updateMany({
        where: { reportInstanceId: id },
        data: { validationStatus: IndicatorValidationStatus.PENDENTE_VALIDACAO },
      });
      return tx.reportInstance.update({
        where: { id },
        data: { status: ReportStatus.PENDENTE_APROVACAO, submittedForApprovalAt: new Date() },
      });
    });
    await this.notificationsService.notifySubmittedForApproval(updated, report.unit);
    return updated;
  }

  private async transition(
    id: string,
    user: AuthenticatedUser,
    requiredRole: RoleName,
    expectedFrom: ReportStatus,
    to: ReportStatus,
    extraData: Record<string, unknown>,
  ) {
    const report = await this.prisma.reportInstance.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Relatorio nao encontrado');
    }
    if (user.role !== requiredRole || user.primaryUnitId !== report.unitId) {
      throw new ForbiddenException('Usuario nao autorizado a executar esta transicao para este relatorio');
    }
    if (report.status !== expectedFrom) {
      throw new BadRequestException(
        `Transicao invalida: relatorio esta em ${report.status}, esperado ${expectedFrom}`,
      );
    }
    return this.prisma.reportInstance.update({
      where: { id },
      data: { status: to, ...extraData },
      include: { unit: true },
    });
  }
}
