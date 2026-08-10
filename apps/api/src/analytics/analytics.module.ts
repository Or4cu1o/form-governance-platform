import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsReloadService } from './analytics-reload.service';
import { EvidenceResolverService } from './evidence-resolver.service';

// PrismaService e AccessLogService sao globais (PrismaModule/CommonModule,
// app.module.ts) — nao precisam de import explicito aqui.
@Module({
  imports: [StorageModule],
  controllers: [AnalyticsController],
  providers: [EvidenceResolverService, AnalyticsReloadService],
  exports: [AnalyticsReloadService],
})
export class AnalyticsModule {}
