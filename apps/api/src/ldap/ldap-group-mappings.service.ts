import { Injectable, NotFoundException } from '@nestjs/common';
import { LdapGroupMapping } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLdapGroupMappingDto } from './dto/create-ldap-group-mapping.dto';

@Injectable()
export class LdapGroupMappingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(unitId: string, ldapConfigId: string): Promise<LdapGroupMapping[]> {
    await this.ensureConfigExists(unitId, ldapConfigId);
    return this.prisma.ldapGroupMapping.findMany({ where: { ldapConfigId }, orderBy: { createdAt: 'asc' } });
  }

  async create(unitId: string, ldapConfigId: string, dto: CreateLdapGroupMappingDto): Promise<LdapGroupMapping> {
    await this.ensureConfigExists(unitId, ldapConfigId);
    return this.prisma.ldapGroupMapping.create({
      data: { ldapConfigId, groupDn: dto.groupDn, role: dto.role },
    });
  }

  async remove(unitId: string, ldapConfigId: string, id: string): Promise<void> {
    await this.ensureConfigExists(unitId, ldapConfigId);
    const mapping = await this.prisma.ldapGroupMapping.findUnique({ where: { id } });
    if (!mapping || mapping.ldapConfigId !== ldapConfigId) {
      throw new NotFoundException('Mapeamento de grupo nao encontrado');
    }
    await this.prisma.ldapGroupMapping.delete({ where: { id } });
  }

  private async ensureConfigExists(unitId: string, ldapConfigId: string): Promise<void> {
    const config = await this.prisma.ldapConfig.findUnique({ where: { id: ldapConfigId } });
    if (!config || config.unitId !== unitId) {
      throw new NotFoundException('Configuracao LDAP nao encontrada para esta unidade');
    }
  }
}
