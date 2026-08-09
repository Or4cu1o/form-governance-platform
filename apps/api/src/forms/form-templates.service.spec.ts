import { NotFoundException } from '@nestjs/common';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { FormTemplatesService } from './form-templates.service';

describe('FormTemplatesService', () => {
  let service: FormTemplatesService;
  let createMock: jest.Mock;
  let findManyMock: jest.Mock;
  let findUniqueMock: jest.Mock;
  let updateMock: jest.Mock;

  beforeEach(() => {
    createMock = jest.fn();
    findManyMock = jest.fn();
    findUniqueMock = jest.fn();
    updateMock = jest.fn();
    const prisma = {
      formTemplate: { findMany: findManyMock, findUnique: findUniqueMock },
    } as unknown as PrismaService;
    const runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) =>
      fn({ formTemplate: { create: createMock, update: updateMock } }),
    );
    const auditContextService = {
      runWithAuditContext: runWithAuditContextMock,
    } as unknown as AuditContextService;
    service = new FormTemplatesService(prisma, auditContextService);
  });

  test('create persists the given dto', async () => {
    await service.create({ name: 'N1', description: 'desc' });

    expect(createMock).toHaveBeenCalledWith({ data: { name: 'N1', description: 'desc' } });
  });

  test('findAll filters by isActive unless includeInactive is set', async () => {
    await service.findAll(false);
    expect(findManyMock).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { name: 'asc' } });

    await service.findAll(true);
    expect(findManyMock).toHaveBeenCalledWith({ where: undefined, orderBy: { name: 'asc' } });
  });

  describe('findOneWithStructure', () => {
    test('throws NotFoundException when the template does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.findOneWithStructure('missing', false)).rejects.toThrow(NotFoundException);
    });

    test('returns the template with nested topics/indicators when found', async () => {
      const template = { id: 'template-1', topics: [] };
      findUniqueMock.mockResolvedValue(template);

      const result = await service.findOneWithStructure('template-1', false);

      expect(result).toBe(template);
    });
  });

  describe('update', () => {
    test('throws NotFoundException when the template does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    test('updates an existing template', async () => {
      findUniqueMock.mockResolvedValue({ id: 'template-1' });

      await service.update('template-1', { name: 'Novo nome' });

      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'template-1' }, data: { name: 'Novo nome' } });
    });
  });

  describe('setActive', () => {
    test('throws NotFoundException when the template does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.setActive('missing', false)).rejects.toThrow(NotFoundException);
    });

    test('flips the isActive flag for an existing template', async () => {
      findUniqueMock.mockResolvedValue({ id: 'template-1' });

      await service.setActive('template-1', false);

      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'template-1' }, data: { isActive: false } });
    });
  });
});
