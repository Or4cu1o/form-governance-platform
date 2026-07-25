import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';

describe('LdapConfigsController', () => {
  let controller: LdapConfigsController;
  let findAllByUnitMock: jest.Mock;
  let createMock: jest.Mock;
  let updateMock: jest.Mock;
  let setActiveMock: jest.Mock;

  beforeEach(() => {
    findAllByUnitMock = jest.fn().mockResolvedValue([]);
    createMock = jest.fn().mockResolvedValue({ id: 'cfg-1' });
    updateMock = jest.fn().mockResolvedValue({ id: 'cfg-1' });
    setActiveMock = jest.fn().mockResolvedValue({ id: 'cfg-1' });
    const service = {
      findAllByUnit: findAllByUnitMock,
      create: createMock,
      update: updateMock,
      setActive: setActiveMock,
    } as unknown as LdapConfigsService;
    controller = new LdapConfigsController(service);
  });

  test('findAll delegates to LdapConfigsService.findAllByUnit with the unitId', async () => {
    await controller.findAll('unit-1');
    expect(findAllByUnitMock).toHaveBeenCalledWith('unit-1');
  });

  test('create delegates to LdapConfigsService.create with unitId and dto', async () => {
    const dto = {
      name: 'AD Matriz',
      domain: 'EMPRESA',
      hosts: ['dc1.empresa.local'],
      bindDn: 'CN=svc,DC=empresa,DC=local',
      bindPassword: 'senha',
      baseDn: 'DC=empresa,DC=local',
    };

    await controller.create('unit-1', dto);

    expect(createMock).toHaveBeenCalledWith('unit-1', dto);
  });

  test('update delegates to LdapConfigsService.update with unitId, id and dto', async () => {
    await controller.update('unit-1', 'cfg-1', { name: 'Novo nome' });
    expect(updateMock).toHaveBeenCalledWith('unit-1', 'cfg-1', { name: 'Novo nome' });
  });

  test('deactivate/activate delegate to LdapConfigsService.setActive', async () => {
    await controller.deactivate('unit-1', 'cfg-1');
    expect(setActiveMock).toHaveBeenCalledWith('unit-1', 'cfg-1', false);

    await controller.activate('unit-1', 'cfg-1');
    expect(setActiveMock).toHaveBeenCalledWith('unit-1', 'cfg-1', true);
  });
});
