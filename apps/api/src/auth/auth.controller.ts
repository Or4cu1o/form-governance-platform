import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { LdapAuthService } from '../ldap/ldap-auth.service';
import { AuthenticatedUser } from './types/authenticated-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly ldapAuthService: LdapAuthService,
  ) {}

  // Limite mais estrito que o default global (Fase 12 — achado HIGH: login
  // sem rate limiting permitia forca bruta/credential stuffing).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.authenticate(dto);
    return this.authService.login(user);
  }

  // Metadados nao sensiveis (id/sigla/nome das unidades com LDAP habilitado)
  // usados pelo popup de selecao de unidade no primeiro login de um usuario
  // ainda nao provisionado. Throttle mais permissivo que /login por nao
  // expor nenhum dado de credencial.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Public()
  @Get('ldap-units')
  ldapUnits() {
    return this.ldapAuthService.listBootstrapUnits();
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
