import { Client } from 'ldapts';
import { LdapClientService, LdapConnectionConfig } from './ldap-client.service';

jest.mock('ldapts');

describe('LdapClientService', () => {
  let service: LdapClientService;
  let bindMock: jest.Mock;
  let searchMock: jest.Mock;
  let unbindMock: jest.Mock;

  const config: LdapConnectionConfig = {
    hosts: ['dc1.empresa.local'],
    port: 636,
    useTls: true,
    bindDn: 'CN=svc-formops,OU=Service,DC=empresa,DC=local',
    bindPassword: 'service-account-password',
    baseDn: 'DC=empresa,DC=local',
  };

  beforeEach(() => {
    (Client as unknown as jest.Mock).mockClear();
    bindMock = jest.fn().mockResolvedValue(undefined);
    searchMock = jest.fn();
    unbindMock = jest.fn().mockResolvedValue(undefined);
    (Client as unknown as jest.Mock).mockImplementation(() => ({
      bind: bindMock,
      search: searchMock,
      unbind: unbindMock,
    }));
    service = new LdapClientService();
  });

  test('returns null when the username is not found on any configured host', async () => {
    searchMock.mockResolvedValue({ searchEntries: [] });

    const result = await service.authenticate(config, 'jsilva', 'senha');

    expect(result).toBeNull();
  });

  test('returns null when the user is found but the password bind fails', async () => {
    searchMock.mockResolvedValue({
      searchEntries: [
        {
          dn: 'CN=Joao Silva,OU=Usuarios,DC=empresa,DC=local',
          givenName: 'Joao',
          sn: 'Silva',
          mail: 'joao.silva@empresa.local',
          memberOf: ['CN=Elaboradores,OU=Grupos,DC=empresa,DC=local'],
          userAccountControl: '512',
        },
      ],
    });
    bindMock
      .mockResolvedValueOnce(undefined) // bind da conta de servico
      .mockRejectedValueOnce(new Error('Invalid Credentials')); // bind como o usuario

    const result = await service.authenticate(config, 'jsilva', 'senha-errada');

    expect(result).toBeNull();
  });

  test('returns null without attempting a bind when the password is empty (RFC 4513 unauthenticated bind guard)', async () => {
    searchMock.mockResolvedValue({
      searchEntries: [
        {
          dn: 'CN=Joao Silva,OU=Usuarios,DC=empresa,DC=local',
          givenName: 'Joao',
          sn: 'Silva',
          mail: 'joao.silva@empresa.local',
          memberOf: [],
          userAccountControl: '512',
        },
      ],
    });

    const result = await service.authenticate(config, 'jsilva', '');

    expect(result).toBeNull();
    // Somente o bind da conta de servico (para a busca) deve ocorrer — nunca
    // um bind com senha vazia em nome do usuario, que muitos servidores LDAP
    // tratam como "unauthenticated bind" bem-sucedido (RFC 4513 5.1.2).
    expect(bindMock).toHaveBeenCalledTimes(1);
    expect(bindMock).toHaveBeenCalledWith(config.bindDn, config.bindPassword);
  });

  test('returns the profile with groups and accountDisabled=false on successful authentication', async () => {
    searchMock.mockResolvedValue({
      searchEntries: [
        {
          dn: 'CN=Joao Silva,OU=Usuarios,DC=empresa,DC=local',
          givenName: 'Joao',
          sn: 'Silva',
          mail: 'joao.silva@empresa.local',
          memberOf: ['CN=Elaboradores,OU=Grupos,DC=empresa,DC=local'],
          userAccountControl: '512',
        },
      ],
    });
    bindMock.mockResolvedValue(undefined);

    const result = await service.authenticate(config, 'jsilva', 'senha-correta');

    expect(result).toEqual({
      userDn: 'CN=Joao Silva,OU=Usuarios,DC=empresa,DC=local',
      nome: 'Joao',
      sobrenome: 'Silva',
      email: 'joao.silva@empresa.local',
      groupDns: ['CN=Elaboradores,OU=Grupos,DC=empresa,DC=local'],
      accountDisabled: false,
    });
  });

  test('marks accountDisabled=true when userAccountControl has the ACCOUNTDISABLE bit set', async () => {
    searchMock.mockResolvedValue({
      searchEntries: [
        {
          dn: 'CN=Joao Silva,OU=Usuarios,DC=empresa,DC=local',
          givenName: 'Joao',
          sn: 'Silva',
          mail: 'joao.silva@empresa.local',
          memberOf: [],
          userAccountControl: '514', // 512 + 2 (ACCOUNTDISABLE)
        },
      ],
    });
    bindMock.mockResolvedValue(undefined);

    const result = await service.authenticate(config, 'jsilva', 'senha-correta');

    expect(result?.accountDisabled).toBe(true);
  });

  test('tries the next host when the first one fails to connect', async () => {
    const multiHostConfig: LdapConnectionConfig = { ...config, hosts: ['dc1.empresa.local', 'dc2.empresa.local'] };
    bindMock.mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue(undefined);
    searchMock.mockResolvedValue({ searchEntries: [] });

    const result = await service.authenticate(multiHostConfig, 'jsilva', 'senha');

    expect(result).toBeNull();
    expect(Client).toHaveBeenCalledTimes(2);
  });

  test('throws when every configured host fails to connect', async () => {
    bindMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.authenticate(config, 'jsilva', 'senha')).rejects.toThrow(
      'Nenhum controlador de dominio configurado respondeu a busca do usuario',
    );
  });
});
