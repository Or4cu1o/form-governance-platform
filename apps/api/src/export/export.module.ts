import { Module } from '@nestjs/common';
import { SealingModule } from '../sealing/sealing.module';
import { PdfService } from './pdf.service';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformSettingsService } from './platform-settings.service';
import { ReportExportController } from './report-export.controller';
import { ReportExportService } from './report-export.service';

@Module({
  imports: [SealingModule],
  controllers: [PlatformSettingsController, ReportExportController],
  providers: [PlatformSettingsService, ReportExportService, PdfService],
  exports: [PlatformSettingsService, PdfService],
})
export class ExportModule {}
