import { Global, Module } from '@nestjs/common';
import { AuditContextService } from './services/audit-context.service';
import { UnitAccessService } from './services/unit-access.service';

@Global()
@Module({
  providers: [UnitAccessService, AuditContextService],
  exports: [UnitAccessService, AuditContextService],
})
export class CommonModule {}
