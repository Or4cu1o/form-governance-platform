import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string; // matricula, e-mail, ou usuario de dominio (DOMINIO\usuario / usuario@dominio)

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}
