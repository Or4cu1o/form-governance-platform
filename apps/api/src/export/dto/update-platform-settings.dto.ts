import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  exportNamingPattern?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  slaElaborationBusinessDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  slaReviewBusinessDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  slaApprovalBusinessDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  slaReprovalExtensionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  slaDeflatorScore?: number;

  // Janela de retencao de evidencia em anos; -1 = indeterminado (FR-043).
  @IsOptional()
  @IsInt()
  @Min(-1)
  evidenceRetentionYears?: number;

  // Carnaval e Corpus Christi (FR-015).
  @IsOptional()
  @IsBoolean()
  includeOptionalHolidays?: boolean;

  // Amplitude maxima de consulta de auditoria, em meses (FR-091).
  @IsOptional()
  @IsInt()
  @Min(1)
  auditMaxRangeMonths?: number;

  // Modo detalhado sob limite mais estrito.
  @IsOptional()
  @IsInt()
  @Min(1)
  auditDetailedMaxRangeMonths?: number;

  // Contagem exata so abaixo deste teto.
  @IsOptional()
  @IsInt()
  @Min(1)
  auditExactCountThreshold?: number;

  // Regra de deteccao de outlier declarada na interface (FR-087).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  outlierRule?: string;

  // Guarda pericial de evidencia bloqueada, em anos (FR-039a).
  @IsOptional()
  @IsInt()
  @Min(1)
  forensicHoldYears?: number;
}
