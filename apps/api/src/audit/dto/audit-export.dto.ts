import { IsIn } from 'class-validator';
import { AuditQueryDto } from './audit-query.dto';

// POST /api/audit/export (T135): mesmos parametros de AuditQueryDto — o
// recorte exportado e exatamente o recorte consultado, filtros na
// integra, inclusive os que nao retornaram dado (FR-107).
export class AuditExportDto extends AuditQueryDto {
  @IsIn(['CSV', 'JSON'])
  format!: 'CSV' | 'JSON';
}
