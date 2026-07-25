import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'ldapts';
import { escapeLdapFilterValue } from './ldap-filter.util';

export interface LdapConnectionConfig {
  hosts: string[];
  port: number;
  useTls: boolean;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
}

export interface LdapAuthenticatedProfile {
  userDn: string;
  nome: string;
  sobrenome: string;
  email: string;
  groupDns: string[];
  accountDisabled: boolean;
}

const CONNECT_TIMEOUT_MS = 5000;
const ACCOUNTDISABLE_BIT = 0x2;

@Injectable()
export class LdapClientService {
  private readonly logger = new Logger(LdapClientService.name);

  async authenticate(
    config: LdapConnectionConfig,
    username: string,
    password: string,
  ): Promise<LdapAuthenticatedProfile | null> {
    const found = await this.findUserEntry(config, username);
    if (!found) {
      return null;
    }

    const credentialsValid = await this.verifyUserPassword(config, found.host, found.profile.userDn, password);
    return credentialsValid ? found.profile : null;
  }

  private async findUserEntry(
    config: LdapConnectionConfig,
    username: string,
  ): Promise<{ profile: LdapAuthenticatedProfile; host: string } | null> {
    let anyHostConnected = false;

    for (const host of config.hosts) {
      const client = this.createClient(host, config);
      try {
        await client.bind(config.bindDn, config.bindPassword);
        anyHostConnected = true;

        const filter = `(&(objectClass=user)(sAMAccountName=${escapeLdapFilterValue(username)}))`;
        const { searchEntries } = await client.search(config.baseDn, {
          scope: 'sub',
          filter,
          attributes: ['distinguishedName', 'givenName', 'sn', 'mail', 'memberOf', 'userAccountControl'],
        });

        if (searchEntries.length === 0) {
          return null;
        }

        const raw = searchEntries[0] as Record<string, unknown>;
        const userAccountControl = Number(raw.userAccountControl ?? 0);
        return {
          host,
          profile: {
            userDn: String(raw.dn),
            nome: String(raw.givenName ?? username),
            sobrenome: String(raw.sn ?? ''),
            email: String(raw.mail ?? ''),
            groupDns: this.toStringArray(raw.memberOf),
            accountDisabled: (userAccountControl & ACCOUNTDISABLE_BIT) === ACCOUNTDISABLE_BIT,
          },
        };
      } catch (error) {
        this.logger.warn(`Falha ao consultar o DC ${host}: ${(error as Error).message}`);
        continue;
      } finally {
        await this.safeUnbind(client);
      }
    }

    if (!anyHostConnected) {
      throw new Error('Nenhum controlador de dominio configurado respondeu a busca do usuario');
    }
    return null;
  }

  private async verifyUserPassword(
    config: LdapConnectionConfig,
    host: string,
    userDn: string,
    password: string,
  ): Promise<boolean> {
    // Guarda contra "unauthenticated bind" (RFC 4513 5.1.2): um bind LDAP
    // com senha vazia e valido para muitos servidores como bind anonimo
    // bem-sucedido, o que permitiria autenticar como qualquer usuario
    // conhecido sem senha. Nunca delegar essa checagem ao servidor.
    if (!password) {
      return false;
    }

    const client = this.createClient(host, config);
    try {
      await client.bind(userDn, password);
      return true;
    } catch {
      return false;
    } finally {
      await this.safeUnbind(client);
    }
  }

  private createClient(host: string, config: LdapConnectionConfig): Client {
    const protocol = config.useTls ? 'ldaps' : 'ldap';
    return new Client({
      url: `${protocol}://${host}:${config.port}`,
      connectTimeout: CONNECT_TIMEOUT_MS,
      timeout: CONNECT_TIMEOUT_MS,
    });
  }

  private async safeUnbind(client: Client): Promise<void> {
    try {
      await client.unbind();
    } catch {
      // conexao pode ja ter caido — nao ha nada a fazer alem de ignorar.
    }
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (typeof value === 'string') {
      return [value];
    }
    return [];
  }
}
