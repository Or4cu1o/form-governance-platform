import { RoleName } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateLdapGroupMappingDto {
  @IsString()
  @IsNotEmpty()
  groupDn!: string;

  @IsEnum(RoleName)
  role!: RoleName;
}
