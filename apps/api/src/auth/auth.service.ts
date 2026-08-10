import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  ACCOUNT_LOCKOUT_DURATION_MS,
  ACCOUNT_LOCKOUT_THRESHOLD,
  IP_LOCKOUT_DURATION_MS,
  IP_LOCKOUT_THRESHOLD,
} from './account-lockout.constants';
import { AuthenticatedUser } from './types/authenticated-user.interface';
import { JwtPayload } from './types/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly auditContextService: AuditContextService,
  ) {}

  // T159 (FR-009, SC-017): o bloqueio primario e sempre por conta; o
  // bloqueio secundario por endereco so entra em jogo quando sourceIp e
  // informado (chamador HTTP) e o endereco nao esta na lista de excecao de
  // nenhuma unidade (Unit.knownEgressIps).
  async validateCredentials(
    identifier: string,
    password: string,
    sourceIp: string | null = null,
  ): Promise<AuthenticatedUser> {
    if (sourceIp) {
      await this.assertIpNotLocked(sourceIp);
    }

    const user = await this.usersService.findActiveByIdentifier(identifier);
    if (!user) {
      if (sourceIp) {
        await this.registerIpFailure(sourceIp);
      }
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (user.accountLockedUntil && user.accountLockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(
        'Conta temporariamente bloqueada por tentativas malsucedidas. Tente novamente mais tarde.',
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      if (sourceIp) {
        await this.registerIpFailure(sourceIp);
      }
      await this.registerAccountFailure(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (user.failedLoginAttempts > 0 || user.accountLockedUntil) {
      await this.resetAccountLockout(user.id);
    }

    return this.toAuthenticatedUser(user);
  }

  private async assertIpNotLocked(sourceIp: string): Promise<void> {
    if (await this.isKnownEgressIp(sourceIp)) {
      return;
    }
    const lockout = await this.prisma.ipLoginLockout.findUnique({ where: { sourceIp } });
    if (lockout?.lockedUntil && lockout.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(
        'Endereco temporariamente bloqueado por excesso de tentativas malsucedidas.',
      );
    }
  }

  private isKnownEgressIp(sourceIp: string): Promise<boolean> {
    return this.prisma.unit
      .findFirst({ where: { knownEgressIps: { has: sourceIp } }, select: { id: true } })
      .then((match) => Boolean(match));
  }

  // Nao passa por AuditContextService — "ip_login_lockouts" nao e coberta
  // pelo gatilho de auditoria (mesmo precedente de "evidence_access_tokens"):
  // a propria linha, com updated_at, e o registro consultavel do
  // bloqueio/desbloqueio secundario.
  private async registerIpFailure(sourceIp: string): Promise<void> {
    if (await this.isKnownEgressIp(sourceIp)) {
      return;
    }
    const existing = await this.prisma.ipLoginLockout.findUnique({ where: { sourceIp } });
    const failedAttempts = (existing?.failedAttempts ?? 0) + 1;
    const lockedUntil = failedAttempts >= IP_LOCKOUT_THRESHOLD ? new Date(Date.now() + IP_LOCKOUT_DURATION_MS) : null;
    await this.prisma.ipLoginLockout.upsert({
      where: { sourceIp },
      create: { sourceIp, failedAttempts, lockedUntil },
      update: { failedAttempts, lockedUntil },
    });
  }

  // "users" e coberta pelo gatilho de auditoria (T167) — todo
  // bloqueio/desbloqueio por conta fica no acervo de auditoria pelo
  // mecanismo ja existente, sem precisar de um evento novo.
  private registerAccountFailure(userId: string, currentAttempts: number): Promise<unknown> {
    const failedLoginAttempts = currentAttempts + 1;
    const accountLockedUntil =
      failedLoginAttempts >= ACCOUNT_LOCKOUT_THRESHOLD ? new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS) : null;
    return this.auditContextService.runWithAuditContext((tx) =>
      tx.user.update({ where: { id: userId }, data: { failedLoginAttempts, accountLockedUntil } }),
    );
  }

  private resetAccountLockout(userId: string): Promise<unknown> {
    return this.auditContextService.runWithAuditContext((tx) =>
      tx.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, accountLockedUntil: null } }),
    );
  }

  login(user: AuthenticatedUser) {
    const payload: JwtPayload = { sub: user.id, role: user.role, unitId: user.primaryUnitId };
    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }

  private toAuthenticatedUser(user: {
    id: string;
    matricula: string;
    nome: string;
    sobrenome: string;
    email: string;
    role: AuthenticatedUser['role'];
    primaryUnitId: string;
    primaryUnit?: { id: string; sigla: string; nome: string };
  }): AuthenticatedUser {
    const { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit } = user;
    return { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit };
  }
}
