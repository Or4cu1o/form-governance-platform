import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ElevationStatus, RoleElevationRequest, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoleElevationRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll(status?: ElevationStatus): Promise<RoleElevationRequest[]> {
    return this.prisma.roleElevationRequest.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, nome: true, sobrenome: true, matricula: true, primaryUnitId: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, reviewer: AuthenticatedUser): Promise<RoleElevationRequest> {
    const request = await this.ensurePending(id);
    return this.prisma.runWithAuditActor(reviewer.id, async (tx) => {
      await tx.user.update({ where: { id: request.userId }, data: { role: request.requestedRole } });
      return tx.roleElevationRequest.update({
        where: { id },
        data: { status: ElevationStatus.APPROVED, reviewedById: reviewer.id, reviewedAt: new Date() },
      });
    });
  }

  async reject(id: string, reviewer: AuthenticatedUser): Promise<RoleElevationRequest> {
    await this.ensurePending(id);
    return this.prisma.runWithAuditActor(reviewer.id, (tx) =>
      tx.roleElevationRequest.update({
        where: { id },
        data: { status: ElevationStatus.REJECTED, reviewedById: reviewer.id, reviewedAt: new Date() },
      }),
    );
  }

  // Chamado pelo LdapAuthService durante o sync de grupos no login.
  async ensurePendingRequest(userId: string, requestedRole: RoleName, sourceGroupDn: string): Promise<void> {
    const existing = await this.prisma.roleElevationRequest.findFirst({
      where: { userId, requestedRole, status: ElevationStatus.PENDING },
    });
    if (existing) {
      return;
    }

    await this.prisma.roleElevationRequest.create({ data: { userId, requestedRole, sourceGroupDn } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.notificationsService.notifyElevationRequested(user, requestedRole);
    }
  }

  // Chamado pelo LdapAuthService quando o usuario nao pertence mais a um
  // grupo que originou uma solicitacao ainda pendente.
  async revokeStalePendingRequests(userId: string, stillEligibleRoles: RoleName[]): Promise<void> {
    await this.prisma.roleElevationRequest.updateMany({
      where: { userId, status: ElevationStatus.PENDING, requestedRole: { notIn: stillEligibleRoles } },
      data: { status: ElevationStatus.REVOKED },
    });
  }

  private async ensurePending(id: string): Promise<RoleElevationRequest> {
    const request = await this.prisma.roleElevationRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Solicitacao de elevacao nao encontrada');
    }
    if (request.status !== ElevationStatus.PENDING) {
      throw new ForbiddenException('Solicitacao de elevacao ja foi revisada');
    }
    return request;
  }
}
