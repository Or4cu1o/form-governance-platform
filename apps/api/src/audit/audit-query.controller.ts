import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditQueryService } from './audit-query.service';
import { AuditFiltersQueryDto } from './dto/audit-filters-query.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
import { SaveTablePreferenceDto } from './dto/save-table-preference.dto';
import { TablePreferencesService } from './table-preferences.service';

// Aberto a qualquer perfil autenticado (sem @Roles) — a restricao real e de
// escopo de unidade, resolvida dentro do service (US6-10), nao de papel.
@Controller('audit')
export class AuditQueryController {
  constructor(
    private readonly auditQueryService: AuditQueryService,
    private readonly tablePreferencesService: TablePreferencesService,
  ) {}

  @Get('query')
  query(@Query() dto: AuditQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.auditQueryService.query(dto, user);
  }

  @Get('filters')
  filters(@Query() dto: AuditFiltersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.auditQueryService.getFilters(dto, user);
  }

  // T119a: ordenacao/visibilidade de coluna sao apresentacao, nunca filtro —
  // esta rota nunca entra em nenhum caminho de query() acima.
  @Get('table-preferences/:tableKey')
  getTablePreference(@Param('tableKey') tableKey: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tablePreferencesService.get(tableKey, user);
  }

  @Post('table-preferences/:tableKey')
  saveTablePreference(
    @Param('tableKey') tableKey: string,
    @Body() dto: SaveTablePreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tablePreferencesService.save(tableKey, dto, user);
  }
}
