import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditExportService } from '../export/audit-export.service';
import { AuditQueryService } from './audit-query.service';
import { AuditExportDto } from './dto/audit-export.dto';
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
    private readonly auditExportService: AuditExportService,
  ) {}

  @Get('query')
  query(@Query() dto: AuditQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.auditQueryService.query(dto, user);
  }

  @Get('filters')
  filters(@Query() dto: AuditFiltersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.auditQueryService.getFilters(dto, user);
  }

  // T135/FR-107: exporta o MESMO recorte consultado, selado (T133 pattern).
  @Post('export')
  async export(
    @Body() dto: AuditExportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.auditExportService.export(dto, user);
    const asciiFallback = file.filename.replace(/[^\x20-\x7e]/g, '_');
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'X-Seal-Verification-Code': file.seal.verificationCode,
    });
    return file.body;
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
