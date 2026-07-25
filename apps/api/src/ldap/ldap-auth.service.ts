import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthSource, RoleName, User } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LdapClientService } from './ldap-client.service';
import { LdapConfigsService } from './ldap-configs.service';
import { RoleElevationRequestsService } from './role-elevation-requests.service';
import { resolveRoleFromGroups } from './role-sync.util';

export interface BootstrapUnitOption {
  id: string;
  sigla: string;
  nome: string;
}

export class UnitSelectionRequiredException extends HttpException {
  constructor(units: BootstrapUnitOption[]) {
    super({ code: 'UNIT_SELECTION_REQUIRED', units }, HttpStatus.PRECONDITION_REQUIRED);
  }
}

const INVALID_CREDENTIALS_MESSAGE = 'Credenciais invalidas';

type UserWithUnit = User & { primaryUnit?: { id: string; sigla: string; nome: string } };

@Injectable()
export class LdapAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ldapClientService: LdapClientService,
    private readonly ldapConfigsService: LdapConfigsService,
    private readonly roleElevationRequestsService: RoleElevationRequestsService,
  ) {}

  async listBootstrapUnits(): Promise<BootstrapUnitOption[]> {
    return this.prisma.unit.findMany({
      where: { ldapEnabled: true, isActive: true },
      select: { id: true, sigla: true, nome: true },
      orderBy: { sigla: 'asc' },
    });
  }

  async authenticateExistingLdapUser(user: User, password: string): Promise<AuthenticatedUser> {
    if (!user.ldapConfigId || !user.ldapUsername) {
      this.denyGeneric();
    }

    const connection = await this.ldapConfigsService.getConnectionConfig(user.ldapConfigId as string);
    if (!connection) {
      this.denyGeneric();
    }

    const profile = await this.ldapClientService.authenticate(connection!, user.ldapUsername as string, password);
    if (!profile) {
      this.denyGeneric();
    }
    if (profile!.accountDisabled) {
      await this.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
      this.denyGeneric();
    }

    return this.syncGroupsAndReturnUser(user, connection!.id, profile!.groupDns);
  }

  async authenticateByDomain(domain: string, username: string, password: string): Promise<AuthenticatedUser> {
    const config = await this.ldapConfigsService.findActiveByDomain(domain);
    if (!config) {
      this.denyGeneric();
    }
    return this.authenticateAndProvision(config!.id, username, password);
  }

  async authenticateByUnit(unitId: string, username: string, password: string): Promise<AuthenticatedUser> {
    const configs = await this.prisma.ldapConfig.findMany({ where: { unitId, isActive: true } });
    for (const config of configs) {
      try {
        return await this.authenticateAndProvision(config.id, username, password);
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === HttpStatus.UNAUTHORIZED) {
          continue;
        }
        throw error;
      }
    }
    return this.denyGeneric();
  }

  private async authenticateAndProvision(ldapConfigId: string, username: string, password: string): Promise<AuthenticatedUser> {
    const connection = await this.ldapConfigsService.getConnectionConfig(ldapConfigId);
    if (!connection) {
      this.denyGeneric();
    }

    const profile = await this.ldapClientService.authenticate(connection!, username, password);
    if (!profile || profile.accountDisabled) {
      this.denyGeneric();
    }

    const mappings = await this.prisma.ldapGroupMapping.findMany({ where: { ldapConfigId } });
    const { autoRole } = resolveRoleFromGroups(profile!.groupDns, mappings);
    if (!autoRole) {
      this.denyGeneric();
    }

    const created = (await this.prisma.user.create({
      data: {
        matricula: this.buildProvisionedMatricula(connection!.unitId, username),
        nome: profile!.nome,
        sobrenome: profile!.sobrenome,
        email: profile!.email || this.buildFallbackEmail(username, connection!.unitId),
        role: autoRole as RoleName,
        primaryUnitId: connection!.unitId,
        authSource: AuthSource.LDAP,
        ldapConfigId,
        ldapUsername: username,
      },
      include: { primaryUnit: { select: { id: true, sigla: true, nome: true } } },
    })) as UserWithUnit;

    await this.applyElevationCandidates(created.id, profile!.groupDns, mappings);

    return this.toAuthenticatedUser(created);
  }

  private async syncGroupsAndReturnUser(user: User, ldapConfigId: string, groupDns: string[]): Promise<AuthenticatedUser> {
    const mappings = await this.prisma.ldapGroupMapping.findMany({ where: { ldapConfigId } });
    const { autoRole } = resolveRoleFromGroups(groupDns, mappings);

    // Um usuario ja elevado (Aprovador/Administrador) mantem acesso mesmo
    // sem casar com nenhum grupo O/E/R do momento — a elevacao so muda por
    // acao manual de um Administrador ou se a conta for bloqueada no AD
    // (ja tratado antes desta chamada), nunca por ausencia de um grupo
    // O/E/R nao relacionado.
    if (!autoRole && !this.isElevatedRole(user.role)) {
      this.denyGeneric();
    }

    const nextRole = this.isElevatedRole(user.role) ? user.role : (autoRole as RoleName);
    const updated = (await this.prisma.user.update({
      where: { id: user.id },
      data: { role: nextRole, isActive: true },
      include: { primaryUnit: { select: { id: true, sigla: true, nome: true } } },
    })) as UserWithUnit;

    await this.applyElevationCandidates(user.id, groupDns, mappings);

    return this.toAuthenticatedUser(updated);
  }

  private async applyElevationCandidates(
    userId: string,
    groupDns: string[],
    mappings: { groupDn: string; role: RoleName }[],
  ): Promise<void> {
    const { elevationCandidates } = resolveRoleFromGroups(groupDns, mappings);
    const eligibleRoles = elevationCandidates.map((candidate) => candidate.role);
    for (const candidate of elevationCandidates) {
      await this.roleElevationRequestsService.ensurePendingRequest(userId, candidate.role, candidate.sourceGroupDn);
    }
    await this.roleElevationRequestsService.revokeStalePendingRequests(userId, eligibleRoles);
  }

  private isElevatedRole(role: RoleName): boolean {
    return role === RoleName.APROVADOR || role === RoleName.ADMINISTRADOR;
  }

  private buildProvisionedMatricula(unitId: string, username: string): string {
    return `ldap:${unitId}:${username}`;
  }

  private buildFallbackEmail(username: string, unitId: string): string {
    return `${username}@${unitId}.ldap.local`;
  }

  private toAuthenticatedUser(user: UserWithUnit): AuthenticatedUser {
    const { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit } = user;
    return { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit };
  }

  private denyGeneric(): never {
    throw new HttpException(INVALID_CREDENTIALS_MESSAGE, HttpStatus.UNAUTHORIZED);
  }
}
