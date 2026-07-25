import { PartialType } from '@nestjs/mapped-types';
import { CreateLdapConfigDto } from './create-ldap-config.dto';

export class UpdateLdapConfigDto extends PartialType(CreateLdapConfigDto) {}
