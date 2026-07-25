import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LdapConfig, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLdapConfigDto } from './dto/create-ldap-config.dto';
import { UpdateLdapConfigDto } from './dto/update-ldap-config.dto';
import { decryptLdapBindPassword, encryptLdapBindPassword, parseLdapEncryptionKey } from './ldap-crypto.util';

export type LdapConfigSafe = Omit<LdapConfig, 'bindPasswordEncrypted'>;

export interface LdapConnectionDetails {
  id: string;
  unitId: string;
  hosts: string[];
  port: number;
  useTls: boolean;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
}

@Injectable()
export class LdapConfigsService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = parseLdapEncryptionKey(this.configService.getOrThrow<string>('LDAP_CONFIG_ENCRYPTION_KEY'));
  }

  async findAllByUnit(unitId: string): Promise<LdapConfigSafe[]> {
    await this.ensureUnitExists(unitId);
    const configs = await this.prisma.ldapConfig.findMany({ where: { unitId }, orderBy: { name: 'asc' } });
    return configs.map((config) => this.redact(config));
  }

  async create(unitId: string, dto: CreateLdapConfigDto): Promise<LdapConfigSafe> {
    await this.ensureUnitExists(unitId);
    try {
      const created = await this.prisma.ldapConfig.create({
        data: {
          unitId,
          name: dto.name,
          domain: dto.domain,
          hosts: dto.hosts,
          port: dto.port ?? 636,
          useTls: dto.useTls ?? true,
          bindDn: dto.bindDn,
          bindPasswordEncrypted: encryptLdapBindPassword(dto.bindPassword, this.encryptionKey),
          baseDn: dto.baseDn,
        },
      });
      return this.redact(created);
    } catch (error) {
      throw this.translateUniqueConstraintError(error);
    }
  }

  async update(unitId: string, id: string, dto: UpdateLdapConfigDto): Promise<LdapConfigSafe> {
    await this.ensureExists(unitId, id);
    const { bindPassword, ...rest } = dto;
    try {
      const updated = await this.prisma.ldapConfig.update({
        where: { id },
        data: {
          ...rest,
          ...(bindPassword
            ? { bindPasswordEncrypted: encryptLdapBindPassword(bindPassword, this.encryptionKey) }
            : {}),
        },
      });
      return this.redact(updated);
    } catch (error) {
      throw this.translateUniqueConstraintError(error);
    }
  }

  async setActive(unitId: string, id: string, isActive: boolean): Promise<LdapConfigSafe> {
    await this.ensureExists(unitId, id);
    const updated = await this.prisma.ldapConfig.update({ where: { id }, data: { isActive } });
    return this.redact(updated);
  }

  // Uso interno (fluxo de login) — unica leitura que retorna a senha decriptada.
  async getConnectionConfig(id: string): Promise<LdapConnectionDetails | null> {
    const config = await this.prisma.ldapConfig.findUnique({ where: { id } });
    if (!config || !config.isActive) {
      return null;
    }
    return {
      id: config.id,
      unitId: config.unitId,
      hosts: config.hosts,
      port: config.port,
      useTls: config.useTls,
      bindDn: config.bindDn,
      bindPassword: decryptLdapBindPassword(config.bindPasswordEncrypted, this.encryptionKey),
      baseDn: config.baseDn,
    };
  }

  findActiveByDomain(domain: string) {
    return this.prisma.ldapConfig.findFirst({ where: { domain, isActive: true } });
  }

  private redact(config: LdapConfig): LdapConfigSafe {
    const { bindPasswordEncrypted: _bindPasswordEncrypted, ...safe } = config;
    return safe;
  }

  private async ensureUnitExists(unitId: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException('Unidade nao encontrada');
    }
  }

  private async ensureExists(unitId: string, id: string): Promise<LdapConfig> {
    const config = await this.prisma.ldapConfig.findUnique({ where: { id } });
    if (!config || config.unitId !== unitId) {
      throw new NotFoundException('Configuracao LDAP nao encontrada para esta unidade');
    }
    return config;
  }

  private translateUniqueConstraintError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'campo unico';
      return new ConflictException(`Valor duplicado para: ${target}`);
    }
    return error;
  }
}
