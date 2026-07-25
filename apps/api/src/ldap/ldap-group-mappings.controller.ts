import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateLdapGroupMappingDto } from './dto/create-ldap-group-mapping.dto';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';

@Roles(RoleName.ADMINISTRADOR)
@Controller('admin/units/:unitId/ldap-configs/:ldapConfigId/group-mappings')
export class LdapGroupMappingsController {
  constructor(private readonly ldapGroupMappingsService: LdapGroupMappingsService) {}

  @Get()
  findAll(@Param('unitId') unitId: string, @Param('ldapConfigId') ldapConfigId: string) {
    return this.ldapGroupMappingsService.findAll(unitId, ldapConfigId);
  }

  @Post()
  create(
    @Param('unitId') unitId: string,
    @Param('ldapConfigId') ldapConfigId: string,
    @Body() dto: CreateLdapGroupMappingDto,
  ) {
    return this.ldapGroupMappingsService.create(unitId, ldapConfigId, dto);
  }

  @Delete(':id')
  remove(@Param('unitId') unitId: string, @Param('ldapConfigId') ldapConfigId: string, @Param('id') id: string) {
    return this.ldapGroupMappingsService.remove(unitId, ldapConfigId, id);
  }
}
