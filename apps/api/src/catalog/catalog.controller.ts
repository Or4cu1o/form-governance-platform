import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CatalogService } from './catalog.service';
import { CreateCatalogEntryDto } from './dto/create-catalog-entry.dto';
import { UpdateCatalogEntryDto } from './dto/update-catalog-entry.dto';

@Roles(RoleName.ADMINISTRADOR)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  search(@Query('q') query?: string) {
    return this.catalogService.search(query);
  }

  @Post()
  create(@Body() dto: CreateCatalogEntryDto) {
    return this.catalogService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCatalogEntryDto) {
    return this.catalogService.update(id, dto);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.catalogService.deactivate(id);
  }
}
