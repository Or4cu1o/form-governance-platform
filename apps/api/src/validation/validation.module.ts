import { Module } from '@nestjs/common';
import { ExportModule } from '../export/export.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { StorageModule } from '../storage/storage.module';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';

@Module({
  imports: [StorageModule, NotificationsModule, ExportModule, ReportsModule],
  controllers: [ValidationController],
  providers: [ValidationService],
})
export class ValidationModule {}
