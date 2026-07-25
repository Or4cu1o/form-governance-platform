import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';
import { LdapGroupMappingsController } from './ldap-group-mappings.controller';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';
import { RoleElevationRequestsController } from './role-elevation-requests.controller';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LdapConfigsController, LdapGroupMappingsController, RoleElevationRequestsController],
  providers: [LdapConfigsService, LdapGroupMappingsService, RoleElevationRequestsService],
  exports: [LdapConfigsService],
})
export class LdapModule {}
