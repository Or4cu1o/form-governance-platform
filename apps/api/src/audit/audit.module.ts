import { Module } from '@nestjs/common';
import { ExportModule } from '../export/export.module';
import { AccessLogService } from './access-log.service';
import { AuditQueryController } from './audit-query.controller';
import { AuditQueryService } from './audit-query.service';
import { TablePreferencesService } from './table-preferences.service';

// Modulo de auditoria (T030 + US6/T106): consulta multi-eixo sobre dado
// vivo (AuditQueryService/Controller) e o registro de acesso generico
// (AccessLogService), reutilizado por outros modulos (selagem, verificacao).
@Module({
  imports: [ExportModule],
  controllers: [AuditQueryController],
  providers: [AccessLogService, AuditQueryService, TablePreferencesService],
  exports: [AccessLogService],
})
export class AuditModule {}
