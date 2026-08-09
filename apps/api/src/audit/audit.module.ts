import { Module } from '@nestjs/common';
import { AccessLogService } from './access-log.service';

// Casca do modulo de auditoria (T030) — AuditQueryService/Controller (US6,
// T106) e o restante da trilha de leitura (T107-T113) se registram aqui.
@Module({
  providers: [AccessLogService],
  exports: [AccessLogService],
})
export class AuditModule {}
