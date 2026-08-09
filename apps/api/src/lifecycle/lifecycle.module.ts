import { Module } from '@nestjs/common';
import { ExportModule } from '../export/export.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InheritanceService } from '../reports/inheritance.service';
import { LifecycleCronService } from './lifecycle-cron.service';
import { ReportLifecycleService } from './report-lifecycle.service';

@Module({
  imports: [NotificationsModule, ExportModule],
  providers: [ReportLifecycleService, LifecycleCronService, InheritanceService],
  exports: [ReportLifecycleService],
})
export class LifecycleModule {}
