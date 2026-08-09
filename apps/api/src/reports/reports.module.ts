import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { IndicatorResponsesController } from './indicator-responses.controller';
import { IndicatorResponsesService } from './indicator-responses.service';
import { ReportInstancesController } from './report-instances.controller';
import { ReportInstancesService } from './report-instances.service';
import { ReportSubmissionService } from './report-submission.service';

@Module({
  imports: [NotificationsModule, LifecycleModule],
  controllers: [ReportInstancesController, IndicatorResponsesController],
  providers: [ReportInstancesService, IndicatorResponsesService, ReportSubmissionService],
  // ValidationModule (finalizeReport) tambem precisa registrar a submissao
  // da etapa APROVACAO — mesmo servico, para nao duplicar a regra de
  // prazo vigente/extensao (FR-056/FR-057).
  exports: [ReportSubmissionService],
})
export class ReportsModule {}
