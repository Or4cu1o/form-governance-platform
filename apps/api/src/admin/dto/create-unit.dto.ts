import { IsArray, IsEnum, IsIP, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { UnitLevel } from '@prisma/client';

export class CreateUnitDto {
  @IsString()
  @IsNotEmpty()
  sigla!: string;

  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsEnum(UnitLevel)
  level!: UnitLevel;

  @IsUUID()
  @IsOptional()
  formTemplateId?: string;

  // T159 (FR-009): enderecos de saida conhecidos desta unidade — isentos do
  // bloqueio secundario por IP (o bloqueio por conta continua valendo).
  @IsArray()
  @IsIP(undefined, { each: true })
  @IsOptional()
  knownEgressIps?: string[];
}
