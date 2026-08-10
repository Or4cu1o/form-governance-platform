import { IsArray, IsOptional, IsString } from 'class-validator';

export class SaveTablePreferenceDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  columnOrder?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hiddenColumns?: string[];
}
