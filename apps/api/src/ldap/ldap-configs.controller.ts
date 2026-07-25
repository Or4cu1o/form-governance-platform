import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateLdapConfigDto } from './dto/create-ldap-config.dto';
import { UpdateLdapConfigDto } from './dto/update-ldap-config.dto';
import { LdapConfigsService } from './ldap-configs.service';

@Roles(RoleName.ADMINISTRADOR)
@Controller('admin/units/:unitId/ldap-configs')
export class LdapConfigsController {
  constructor(private readonly ldapConfigsService: LdapConfigsService) {}

  @Get()
  findAll(@Param('unitId') unitId: string) {
    return this.ldapConfigsService.findAllByUnit(unitId);
  }

  @Post()
  create(@Param('unitId') unitId: string, @Body() dto: CreateLdapConfigDto) {
    return this.ldapConfigsService.create(unitId, dto);
  }

  @Patch(':id')
  update(@Param('unitId') unitId: string, @Param('id') id: string, @Body() dto: UpdateLdapConfigDto) {
    return this.ldapConfigsService.update(unitId, id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('unitId') unitId: string, @Param('id') id: string) {
    return this.ldapConfigsService.setActive(unitId, id, false);
  }

  @Patch(':id/activate')
  activate(@Param('unitId') unitId: string, @Param('id') id: string) {
    return this.ldapConfigsService.setActive(unitId, id, true);
  }
}
