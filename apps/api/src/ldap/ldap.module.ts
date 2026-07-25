import { Module } from '@nestjs/common';
import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';
import { LdapGroupMappingsController } from './ldap-group-mappings.controller';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';

@Module({
  controllers: [LdapConfigsController, LdapGroupMappingsController],
  providers: [LdapConfigsService, LdapGroupMappingsService],
  exports: [LdapConfigsService],
})
export class LdapModule {}
