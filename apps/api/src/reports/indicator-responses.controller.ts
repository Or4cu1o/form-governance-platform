import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateIndicatorResponseDto } from './dto/update-indicator-response.dto';
import { IndicatorResponsesService } from './indicator-responses.service';

// Contrato documenta a rota como "PUT /api/reports/:reportId/indicators/:id"
// (contracts/api-rest.md) — mas o recurso real, ja em producao desde a Fase
// 1 e dependido pelo frontend (upload de evidencia, desativacao), e
// "indicator-responses/:id". Equivalente: mesmo indicador, mesmo relatorio,
// so o formato do caminho difere (ver precedente T049a/T049b).
@Controller('indicator-responses')
export class IndicatorResponsesController {
  constructor(private readonly indicatorResponsesService: IndicatorResponsesService) {}

  @Roles(RoleName.ELABORADOR, RoleName.REVISOR)
  @Put(':id')
  updateValues(
    @Param('id') id: string,
    @Body() dto: UpdateIndicatorResponseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.indicatorResponsesService.updateValues(id, user, dto);
  }

  @Get(':id/versions')
  getVersionHistory(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.indicatorResponsesService.getVersionHistory(id, user);
  }
}
