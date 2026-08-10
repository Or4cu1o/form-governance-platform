import { Module } from '@nestjs/common';
import { AuditExportService } from '../export/audit-export.service';
import { ExportModule } from '../export/export.module';
import { SealingModule } from '../sealing/sealing.module';
import { AuditQueryController } from './audit-query.controller';
import { AuditQueryService } from './audit-query.service';
import { TablePreferencesService } from './table-preferences.service';

// Modulo de auditoria (T030 + US6/T106): consulta multi-eixo sobre dado
// vivo (AuditQueryService/Controller) e a exportacao selada da consulta
// (T135). AccessLogService passou a viver em CommonModule (@Global()) para
// quebrar a dependencia circular com ExportModule (T133) — continua
// injetavel aqui normalmente. SealingModule importado direto (nao via
// ExportModule) porque ExportModule nao reexporta SealService.
@Module({
  imports: [ExportModule, SealingModule],
  controllers: [AuditQueryController],
  providers: [AuditQueryService, TablePreferencesService, AuditExportService],
})
export class AuditModule {}
