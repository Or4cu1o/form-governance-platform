import { Global, Module } from '@nestjs/common';
import { AccessLogService } from '../audit/access-log.service';
import { AuditContextService } from './services/audit-context.service';
import { UnitAccessService } from './services/unit-access.service';

// AccessLogService vive aqui (nao em AuditModule) para quebrar a
// dependencia circular: ExportModule precisa dele (T133/T135) e
// AuditModule ja importa ExportModule (para PlatformSettingsService).
// @Global() torna a instancia unica disponivel em todo modulo sem import
// explicito — mesmo racional de UnitAccessService/AuditContextService.
@Global()
@Module({
  providers: [UnitAccessService, AuditContextService, AccessLogService],
  exports: [UnitAccessService, AuditContextService, AccessLogService],
})
export class CommonModule {}
