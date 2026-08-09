import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';
import { RoleName } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  matricula!: string;

  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsString()
  @IsNotEmpty()
  sobrenome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(RoleName)
  role!: RoleName;

  // T095/FR-074: funcao na organizacao, distinta de RoleName — estampada no
  // documento selado quando o veredito e emitido, por isso obrigatoria para
  // quem pode aprovar (unico role autorizado em ValidationController).
  @ValidateIf((dto: CreateUserDto) => dto.role === RoleName.APROVADOR)
  @IsString()
  @IsNotEmpty({ message: 'jobTitle e obrigatorio para o perfil Aprovador' })
  jobTitle?: string;

  @IsUUID()
  primaryUnitId!: string;

  @IsUUID(undefined, { each: true })
  @IsOptional()
  extraUnitIds?: string[];
}
