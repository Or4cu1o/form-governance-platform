import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ElevationStatus, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

@Roles(RoleName.ADMINISTRADOR)
@Controller('admin/elevation-requests')
export class RoleElevationRequestsController {
  constructor(private readonly roleElevationRequestsService: RoleElevationRequestsService) {}

  @Get()
  findAll(@Query('status') status?: ElevationStatus) {
    return this.roleElevationRequestsService.findAll(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() reviewer: AuthenticatedUser) {
    return this.roleElevationRequestsService.approve(id, reviewer);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() reviewer: AuthenticatedUser) {
    return this.roleElevationRequestsService.reject(id, reviewer);
  }
}
