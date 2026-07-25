import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LdapConfigsService } from './ldap-configs.service';

function buildUniqueConstraintError(target: string[]): Prisma.PrismaClientKnownRequestError {
  return Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: 'P2002',
    meta: { target },
    message: 'Unique constraint failed',
  });
}

describe('LdapConfigsService', () => {
  let service: LdapConfigsService;
  let findManyMock: jest.Mock;
  let findUniqueUnitMock: jest.Mock;
  let findUniqueConfigMock: jest.Mock;
  let createMock: jest.Mock;
  let updateMock: jest.Mock;

  const encryptionKeyB64 = randomBytes(32).toString('base64');

  beforeEach(() => {
    findManyMock = jest.fn();
    findUniqueUnitMock = jest.fn();
    findUniqueConfigMock = jest.fn();
    createMock = jest.fn();
    updateMock = jest.fn();
    const prisma = {
      ldapConfig: { findMany: findManyMock, findUnique: findUniqueConfigMock, create: createMock, update: updateMock },
      unit: { findUnique: findUniqueUnitMock },
    } as unknown as PrismaService;
    const configService = { getOrThrow: jest.fn().mockReturnValue(encryptionKeyB64) } as unknown as ConfigService;
    service = new LdapConfigsService(prisma, configService);
  });

  describe('findAllByUnit', () => {
    test('throws NotFoundException when the unit does not exist', async () => {
      findUniqueUnitMock.mockResolvedValue(null);

      await expect(service.findAllByUnit('missing-unit')).rejects.toThrow(NotFoundException);
    });

    test('returns configs without the encrypted password field', async () => {
      findUniqueUnitMock.mockResolvedValue({ id: 'unit-1' });
      findManyMock.mockResolvedValue([
        { id: 'cfg-1', unitId: 'unit-1', name: 'AD Matriz', bindPasswordEncrypted: 'iv:tag:cipher' },
      ]);

      const result = await service.findAllByUnit('unit-1');

      expect(result).toEqual([{ id: 'cfg-1', unitId: 'unit-1', name: 'AD Matriz' }]);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'AD Matriz',
      domain: 'EMPRESA',
      hosts: ['dc1.empresa.local'],
      bindDn: 'CN=svc,DC=empresa,DC=local',
      bindPassword: 'service-account-password',
      baseDn: 'DC=empresa,DC=local',
    };

    test('throws NotFoundException when the unit does not exist', async () => {
      findUniqueUnitMock.mockResolvedValue(null);

      await expect(service.create('missing-unit', dto)).rejects.toThrow(NotFoundException);
    });

    test('encrypts the bind password before persisting and redacts it on return', async () => {
      findUniqueUnitMock.mockResolvedValue({ id: 'unit-1' });
      createMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1', ...dto, bindPasswordEncrypted: 'iv:tag:cipher' });

      const result = await service.create('unit-1', dto);

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitId: 'unit-1',
            bindPasswordEncrypted: expect.not.stringContaining('service-account-password'),
          }),
        }),
      );
      expect(result).not.toHaveProperty('bindPasswordEncrypted');
    });

    test('translates a duplicate domain into ConflictException', async () => {
      findUniqueUnitMock.mockResolvedValue({ id: 'unit-1' });
      createMock.mockRejectedValue(buildUniqueConstraintError(['domain']));

      await expect(service.create('unit-1', dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    test('re-encrypts the bind password only when a new one is provided', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      updateMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1', name: 'Novo nome', bindPasswordEncrypted: 'x' });

      await service.update('unit-1', 'cfg-1', { name: 'Novo nome' });

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        data: { name: 'Novo nome' },
      });
    });

    test('throws NotFoundException when the config does not belong to the unit', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'other-unit' });

      await expect(service.update('unit-1', 'cfg-1', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('setActive', () => {
    test('flips isActive for a config belonging to the unit', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      updateMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1', isActive: false, bindPasswordEncrypted: 'x' });

      await service.setActive('unit-1', 'cfg-1', false);

      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'cfg-1' }, data: { isActive: false } });
    });
  });

  describe('getConnectionConfig', () => {
    test('returns null when the config does not exist or is inactive', async () => {
      findUniqueConfigMock.mockResolvedValue(null);
      expect(await service.getConnectionConfig('missing')).toBeNull();

      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', isActive: false });
      expect(await service.getConnectionConfig('cfg-1')).toBeNull();
    });

    test('returns the connection details with the decrypted password', async () => {
      const { encryptLdapBindPassword, parseLdapEncryptionKey } = jest.requireActual('./ldap-crypto.util');
      const key = parseLdapEncryptionKey(encryptionKeyB64);
      const encrypted = encryptLdapBindPassword('service-account-password', key);
      findUniqueConfigMock.mockResolvedValue({
        id: 'cfg-1',
        unitId: 'unit-1',
        hosts: ['dc1.empresa.local'],
        port: 636,
        useTls: true,
        bindDn: 'CN=svc,DC=empresa,DC=local',
        bindPasswordEncrypted: encrypted,
        baseDn: 'DC=empresa,DC=local',
        isActive: true,
      });

      const result = await service.getConnectionConfig('cfg-1');

      expect(result?.bindPassword).toBe('service-account-password');
    });
  });

  describe('findActiveByDomain', () => {
    test('delegates to prisma.ldapConfig.findFirst', async () => {
      const findFirstMock = jest.fn().mockResolvedValue({ id: 'cfg-1' });
      (service as unknown as { prisma: { ldapConfig: { findFirst: jest.Mock } } }).prisma = {
        ldapConfig: { findFirst: findFirstMock },
      };

      await service.findActiveByDomain('EMPRESA');

      expect(findFirstMock).toHaveBeenCalledWith({ where: { domain: 'EMPRESA', isActive: true } });
    });
  });
});
