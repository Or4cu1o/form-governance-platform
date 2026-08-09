import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { GoalOperator } from '@prisma/client';

const VARIABLE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class CreateFormIndicatorDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  objective!: string;

  @IsArray()
  @ArrayNotEmpty()
  @Matches(VARIABLE_KEY_PATTERN, { each: true })
  variableKeys!: string[];

  @IsString()
  @IsNotEmpty()
  formulaExpression!: string;

  @IsEnum(GoalOperator)
  goalOperator!: GoalOperator;

  @IsNumber()
  goalValue!: number;

  // Vinculo obrigatorio ao catalogo canonico (A6, FR-062) — cadastro sem
  // codigo canonico e recusado.
  @IsString()
  @IsNotEmpty()
  catalogEntryId!: string;

  @IsBoolean()
  @IsOptional()
  isResidentState?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
