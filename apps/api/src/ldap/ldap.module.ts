import { Module } from '@nestjs/common';
import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';

@Module({
  controllers: [LdapConfigsController],
  providers: [LdapConfigsService],
  exports: [LdapConfigsService],
})
export class LdapModule {}
