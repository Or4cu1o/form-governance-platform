import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UnitLevel } from '@prisma/client';

const toArray = ({ value }: { value: unknown }) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]);

// GET /api/audit/filters (T113/FR-076): a selecao corrente restringe as
// opcoes subsequentes as efetivamente elegiveis — por isso aceita o mesmo
// par unitIds/levels que a consulta principal, sem os demais filtros.
export class AuditFiltersQueryDto {
  @Transform(toArray)
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  unitIds?: string[];

  @Transform(toArray)
  @IsArray()
  @IsEnum(UnitLevel, { each: true })
  @IsOptional()
  levels?: UnitLevel[];
}
