import { RoleName } from '@prisma/client';
import { LdapGroupMappingsController } from './ldap-group-mappings.controller';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';

describe('LdapGroupMappingsController', () => {
  let controller: LdapGroupMappingsController;
  let findAllMock: jest.Mock;
  let createMock: jest.Mock;
  let removeMock: jest.Mock;

  beforeEach(() => {
    findAllMock = jest.fn().mockResolvedValue([]);
    createMock = jest.fn().mockResolvedValue({ id: 'map-1' });
    removeMock = jest.fn().mockResolvedValue(undefined);
    const service = { findAll: findAllMock, create: createMock, remove: removeMock } as unknown as LdapGroupMappingsService;
    controller = new LdapGroupMappingsController(service);
  });

  test('findAll delegates with unitId and ldapConfigId', async () => {
    await controller.findAll('unit-1', 'cfg-1');
    expect(findAllMock).toHaveBeenCalledWith('unit-1', 'cfg-1');
  });

  test('create delegates with unitId, ldapConfigId and dto', async () => {
    const dto = { groupDn: 'CN=Revisores,DC=empresa,DC=local', role: RoleName.REVISOR };
    await controller.create('unit-1', 'cfg-1', dto);
    expect(createMock).toHaveBeenCalledWith('unit-1', 'cfg-1', dto);
  });

  test('remove delegates with unitId, ldapConfigId and id', async () => {
    await controller.remove('unit-1', 'cfg-1', 'map-1');
    expect(removeMock).toHaveBeenCalledWith('unit-1', 'cfg-1', 'map-1');
  });
});
