import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let findManyCatalogMock: jest.Mock;
  let createCatalogMock: jest.Mock;
  let findUniqueCatalogMock: jest.Mock;
  let updateCatalogMock: jest.Mock;
  let countIndicatorMock: jest.Mock;

  beforeEach(() => {
    findManyCatalogMock = jest.fn();
    createCatalogMock = jest.fn();
    findUniqueCatalogMock = jest.fn();
    updateCatalogMock = jest.fn();
    countIndicatorMock = jest.fn();
    const prisma = {
      indicatorCatalog: {
        findMany: findManyCatalogMock,
        create: createCatalogMock,
        findUnique: findUniqueCatalogMock,
        update: updateCatalogMock,
      },
      formIndicator: { count: countIndicatorMock },
    } as unknown as PrismaService;
    service = new CatalogService(prisma);
  });

  describe('search', () => {
    test('searches by code and name', async () => {
      findManyCatalogMock.mockResolvedValue([]);

      await service.search('disp');

      expect(findManyCatalogMock).toHaveBeenCalledWith({
        where: {
          OR: [
            { code: { contains: 'disp', mode: 'insensitive' } },
            { name: { contains: 'disp', mode: 'insensitive' } },
          ],
        },
        orderBy: { code: 'asc' },
      });
    });

    test('lists every entry when no query is given', async () => {
      findManyCatalogMock.mockResolvedValue([]);

      await service.search();

      expect(findManyCatalogMock).toHaveBeenCalledWith({ where: undefined, orderBy: { code: 'asc' } });
    });
  });

  describe('create', () => {
    test('creates a catalog entry from code, name and measurement unit', async () => {
      const dto = { code: 'DISP-01', name: 'Disponibilidade', measurementUnit: '%' };
      createCatalogMock.mockResolvedValue({ id: 'catalog-1', ...dto });

      await service.create(dto);

      expect(createCatalogMock).toHaveBeenCalledWith({ data: dto });
    });
  });

  // T078/FR-064: measurementUnit e imutavel apos o primeiro vinculo.
  describe('update', () => {
    test('throws NotFoundException when the entry does not exist', async () => {
      findUniqueCatalogMock.mockResolvedValue(null);

      await expect(service.update('missing', { measurementUnit: '%' })).rejects.toThrow(NotFoundException);
    });

    test('allows updating fields other than measurementUnit even when linked', async () => {
      findUniqueCatalogMock.mockResolvedValue({ id: 'catalog-1', measurementUnit: '%' });
      updateCatalogMock.mockResolvedValue({ id: 'catalog-1' });

      await service.update('catalog-1', { name: 'Disponibilidade do servico' });

      expect(countIndicatorMock).not.toHaveBeenCalled();
      expect(updateCatalogMock).toHaveBeenCalledWith({
        where: { id: 'catalog-1' },
        data: { name: 'Disponibilidade do servico' },
      });
    });

    test('allows changing measurementUnit while no indicator has ever been linked', async () => {
      findUniqueCatalogMock.mockResolvedValue({ id: 'catalog-1', measurementUnit: '%' });
      countIndicatorMock.mockResolvedValue(0);
      updateCatalogMock.mockResolvedValue({ id: 'catalog-1' });

      await service.update('catalog-1', { measurementUnit: 'horas' });

      expect(countIndicatorMock).toHaveBeenCalledWith({ where: { catalogEntryId: 'catalog-1' } });
      expect(updateCatalogMock).toHaveBeenCalledWith({
        where: { id: 'catalog-1' },
        data: { measurementUnit: 'horas' },
      });
    });

    test('throws ConflictException when changing measurementUnit after the first link (T078, FR-064)', async () => {
      findUniqueCatalogMock.mockResolvedValue({ id: 'catalog-1', measurementUnit: '%' });
      countIndicatorMock.mockResolvedValue(1);

      await expect(service.update('catalog-1', { measurementUnit: 'horas' })).rejects.toThrow(ConflictException);
      expect(updateCatalogMock).not.toHaveBeenCalled();
    });

    test('does not throw when measurementUnit is sent but unchanged', async () => {
      findUniqueCatalogMock.mockResolvedValue({ id: 'catalog-1', measurementUnit: '%' });
      updateCatalogMock.mockResolvedValue({ id: 'catalog-1' });

      await service.update('catalog-1', { measurementUnit: '%' });

      expect(countIndicatorMock).not.toHaveBeenCalled();
      expect(updateCatalogMock).toHaveBeenCalled();
    });
  });

  // T079/FR-064: nao desativavel com indicador ativo vinculado.
  describe('deactivate', () => {
    test('throws NotFoundException when the entry does not exist', async () => {
      findUniqueCatalogMock.mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toThrow(NotFoundException);
    });

    test('throws ConflictException when an active indicator is linked (T079, FR-064)', async () => {
      findUniqueCatalogMock.mockResolvedValue({ id: 'catalog-1' });
      countIndicatorMock.mockResolvedValue(1);

      await expect(service.deactivate('catalog-1')).rejects.toThrow(ConflictException);
      expect(countIndicatorMock).toHaveBeenCalledWith({ where: { catalogEntryId: 'catalog-1', isActive: true } });
      expect(updateCatalogMock).not.toHaveBeenCalled();
    });

    test('deactivates the entry when no active indicator is linked', async () => {
      findUniqueCatalogMock.mockResolvedValue({ id: 'catalog-1' });
      countIndicatorMock.mockResolvedValue(0);
      updateCatalogMock.mockResolvedValue({ id: 'catalog-1', isActive: false });

      await service.deactivate('catalog-1');

      expect(updateCatalogMock).toHaveBeenCalledWith({ where: { id: 'catalog-1' }, data: { isActive: false } });
    });
  });
});
