import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthSource } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LdapAuthService, UnitSelectionRequiredException } from '../ldap/ldap-auth.service';
import { parseDomainQualifiedIdentifier } from '../ldap/ldap-identifier.util';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './types/authenticated-user.interface';
import { JwtPayload } from './types/jwt-payload.interface';

type LocalUserRecord = NonNullable<Awaited<ReturnType<UsersService['findActiveByIdentifier']>>>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly ldapAuthService: LdapAuthService,
  ) {}

  async authenticate(dto: LoginDto): Promise<AuthenticatedUser> {
    const existingUser = await this.usersService.findActiveByIdentifier(dto.identifier);

    if (existingUser && existingUser.authSource === AuthSource.LOCAL) {
      return this.validateLocalCredentials(existingUser, dto.password);
    }

    if (existingUser && existingUser.authSource === AuthSource.LDAP) {
      return this.ldapAuthService.authenticateExistingLdapUser(existingUser, dto.password);
    }

    const domainMatch = parseDomainQualifiedIdentifier(dto.identifier);
    if (domainMatch) {
      return this.ldapAuthService.authenticateByDomain(domainMatch.domain, domainMatch.username, dto.password);
    }

    if (!dto.unitId) {
      throw new UnitSelectionRequiredException(await this.ldapAuthService.listBootstrapUnits());
    }

    return this.ldapAuthService.authenticateByUnit(dto.unitId, dto.identifier, dto.password);
  }

  login(user: AuthenticatedUser) {
    const payload: JwtPayload = { sub: user.id, role: user.role, unitId: user.primaryUnitId };
    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }

  private async validateLocalCredentials(user: LocalUserRecord, password: string): Promise<AuthenticatedUser> {
    if (!user.passwordHash) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    return this.toAuthenticatedUser(user);
  }

  private toAuthenticatedUser(user: LocalUserRecord): AuthenticatedUser {
    const { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit } = user;
    return { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit };
  }
}
