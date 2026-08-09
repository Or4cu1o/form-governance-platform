import { Module } from '@nestjs/common';
import { FormsModule } from '../forms/forms.module';
import { UnitsAdminController } from './units-admin.controller';
import { UnitsAdminService } from './units-admin.service';
import { UsersAdminController } from './users-admin.controller';
import { UsersAdminService } from './users-admin.service';

@Module({
  imports: [FormsModule],
  controllers: [UsersAdminController, UnitsAdminController],
  providers: [UsersAdminService, UnitsAdminService],
})
export class AdminModule {}
