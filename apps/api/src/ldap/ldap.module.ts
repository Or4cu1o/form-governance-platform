import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LdapAuthService } from './ldap-auth.service';
import { LdapClientService } from './ldap-client.service';
import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';
import { LdapGroupMappingsController } from './ldap-group-mappings.controller';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';
import { RoleElevationRequestsController } from './role-elevation-requests.controller';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LdapConfigsController, LdapGroupMappingsController, RoleElevationRequestsController],
  providers: [
    LdapClientService,
    LdapConfigsService,
    LdapGroupMappingsService,
    RoleElevationRequestsService,
    LdapAuthService,
  ],
  exports: [LdapAuthService],
})
export class LdapModule {}
