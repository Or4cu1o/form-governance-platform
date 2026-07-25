import { NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';

describe('LdapGroupMappingsService', () => {
  let service: LdapGroupMappingsService;
  let findUniqueConfigMock: jest.Mock;
  let findManyMock: jest.Mock;
  let createMock: jest.Mock;
  let findUniqueMappingMock: jest.Mock;
  let deleteMock: jest.Mock;

  beforeEach(() => {
    findUniqueConfigMock = jest.fn();
    findManyMock = jest.fn();
    createMock = jest.fn();
    findUniqueMappingMock = jest.fn();
    deleteMock = jest.fn();
    const prisma = {
      ldapConfig: { findUnique: findUniqueConfigMock },
      ldapGroupMapping: { findMany: findManyMock, create: createMock, findUnique: findUniqueMappingMock, delete: deleteMock },
    } as unknown as PrismaService;
    service = new LdapGroupMappingsService(prisma);
  });

  describe('findAll', () => {
    test('throws NotFoundException when the config does not belong to the unit', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'other-unit' });

      await expect(service.findAll('unit-1', 'cfg-1')).rejects.toThrow(NotFoundException);
    });

    test('lists mappings for the config', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      findManyMock.mockResolvedValue([{ id: 'map-1', groupDn: 'CN=Elaboradores,DC=empresa,DC=local', role: RoleName.ELABORADOR }]);

      const result = await service.findAll('unit-1', 'cfg-1');

      expect(findManyMock).toHaveBeenCalledWith({ where: { ldapConfigId: 'cfg-1' }, orderBy: { createdAt: 'asc' } });
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    test('creates a mapping scoped to the ldapConfigId', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      createMock.mockResolvedValue({ id: 'map-1' });

      await service.create('unit-1', 'cfg-1', { groupDn: 'CN=Revisores,DC=empresa,DC=local', role: RoleName.REVISOR });

      expect(createMock).toHaveBeenCalledWith({
        data: { ldapConfigId: 'cfg-1', groupDn: 'CN=Revisores,DC=empresa,DC=local', role: RoleName.REVISOR },
      });
    });
  });

  describe('remove', () => {
    test('throws NotFoundException when the mapping does not belong to the config', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      findUniqueMappingMock.mockResolvedValue({ id: 'map-1', ldapConfigId: 'other-cfg' });

      await expect(service.remove('unit-1', 'cfg-1', 'map-1')).rejects.toThrow(NotFoundException);
    });

    test('deletes the mapping when it belongs to the config', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      findUniqueMappingMock.mockResolvedValue({ id: 'map-1', ldapConfigId: 'cfg-1' });

      await service.remove('unit-1', 'cfg-1', 'map-1');

      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'map-1' } });
    });
  });
});
