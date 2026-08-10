import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ReportStatus, UnitLevel, ValidationVerdict } from '@prisma/client';

export enum AuditQueryMode {
  BASICO = 'BASICO',
  DETALHADO = 'DETALHADO',
}

export enum ComplianceFilter {
  CONFORME = 'CONFORME',
  NAO_CONFORME = 'NAO_CONFORME',
}

export enum PunctualityFilter {
  NO_PRAZO = 'NO_PRAZO',
  FORA_DO_PRAZO = 'FORA_DO_PRAZO',
}

const REFERENCE_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Query params chegam como string unica quando ha so uma ocorrencia
// (?unitIds=a) e como array quando ha mais de uma (?unitIds=a&unitIds=b) —
// normaliza para array sempre, unico jeito de @IsArray() nao rejeitar o
// caso de selecao unica (nenhum DTO de query no projeto tinha array ate
// aqui, T106 e o primeiro precedente).
const toArray = ({ value }: { value: unknown }) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]);

export class AuditQueryDto {
  @IsEnum(AuditQueryMode)
  @IsOptional()
  mode?: AuditQueryMode = AuditQueryMode.BASICO;

  @IsString()
  @Matches(REFERENCE_PERIOD_PATTERN, { message: 'periodFrom deve estar no formato YYYY-MM' })
  periodFrom!: string;

  @IsString()
  @Matches(REFERENCE_PERIOD_PATTERN, { message: 'periodTo deve estar no formato YYYY-MM' })
  periodTo!: string;

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

  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  indicatorCodes?: string[];

  @Transform(toArray)
  @IsArray()
  @IsEnum(ReportStatus, { each: true })
  @IsOptional()
  statuses?: ReportStatus[];

  @Transform(toArray)
  @IsArray()
  @IsEnum(ComplianceFilter, { each: true })
  @IsOptional()
  compliance?: ComplianceFilter[];

  @Transform(toArray)
  @IsArray()
  @IsEnum(ValidationVerdict, { each: true })
  @IsOptional()
  verdicts?: ValidationVerdict[];

  @Transform(toArray)
  @IsArray()
  @IsEnum(PunctualityFilter, { each: true })
  @IsOptional()
  punctuality?: PunctualityFilter[];

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  scoreFrom?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  scoreTo?: number;

  // Apenas em modo DETALHADO (validado em AuditQueryService).
  @Transform(toArray)
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  authorIds?: string[];

  // Apenas em modo DETALHADO (validado em AuditQueryService).
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  eventTypes?: string[];

  // Busca dentro do resultado (FR-092): alcanca o conjunto inteiro na
  // propria consulta ao banco, nunca filtro sobre a pagina renderizada.
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  cursor?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  pageSize?: number;

  @IsIn(['referencePeriod', 'unitId'])
  @IsOptional()
  sort?: 'referencePeriod' | 'unitId';
}
