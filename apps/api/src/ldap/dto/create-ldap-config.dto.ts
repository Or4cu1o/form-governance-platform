import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateLdapConfigDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  hosts!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsBoolean()
  useTls?: boolean;

  @IsString()
  @IsNotEmpty()
  bindDn!: string;

  @IsString()
  @IsNotEmpty()
  bindPassword!: string;

  @IsString()
  @IsNotEmpty()
  baseDn!: string;
}
