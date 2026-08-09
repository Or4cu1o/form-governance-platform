import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateIndicatorResponseDto {
  // FR-129: a versao sobre a qual o autor editava quando abriu o formulario.
  // Obrigatorio — sem ele nao ha como detectar que a versao corrente mudou
  // por baixo do autor.
  @IsString()
  expectedVersionId!: string;

  // Preenchido so numa segunda requisicao deliberada, apos o autor ver o
  // 409 e decidir conscientemente sobrescrever (FR-129). Nunca automatico.
  @IsOptional()
  @IsString()
  overwriteVersionId?: string;

  // Chaves e tipos validados dinamicamente no service contra as
  // snapshotVariableKeys do indicador (nao da para tipar estaticamente
  // um DTO cujas chaves variam por indicador).
  @IsObject()
  variableValues!: Record<string, number>;

  @IsOptional()
  @IsString()
  criticalAnalysis?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;
}
