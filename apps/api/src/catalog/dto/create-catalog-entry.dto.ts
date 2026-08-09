import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCatalogEntryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  measurementUnit!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
