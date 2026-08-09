import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ExportModule } from '../export/export.module';
import { StorageModule } from '../storage/storage.module';
import { AntivirusService } from './antivirus.service';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [StorageModule, AuditModule, ExportModule],
  controllers: [EvidenceController],
  providers: [EvidenceService, AntivirusService],
})
export class EvidenceModule {}
