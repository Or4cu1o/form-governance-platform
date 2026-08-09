import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogEntryDto } from './dto/create-catalog-entry.dto';
import { UpdateCatalogEntryDto } from './dto/update-catalog-entry.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  search(query?: string) {
    return this.prisma.indicatorCatalog.findMany({
      where: query
        ? { OR: [{ code: { contains: query, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }] }
        : undefined,
      orderBy: { code: 'asc' },
    });
  }

  create(dto: CreateCatalogEntryDto) {
    return this.prisma.indicatorCatalog.create({ data: dto });
  }

  async update(id: string, dto: UpdateCatalogEntryDto) {
    const entry = await this.ensureExists(id);

    // FR-064: measurementUnit e imutavel apos o primeiro vinculo — checa
    // qualquer vinculo historico (isActive ou nao), nunca so os ativos.
    if (dto.measurementUnit !== undefined && dto.measurementUnit !== entry.measurementUnit) {
      const linkedCount = await this.prisma.formIndicator.count({ where: { catalogEntryId: id } });
      if (linkedCount > 0) {
        throw new ConflictException(
          'Unidade de medida e imutavel apos o primeiro vinculo. Crie um novo codigo de catalogo.',
        );
      }
    }

    return this.prisma.indicatorCatalog.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.ensureExists(id);

    const activeLinkedCount = await this.prisma.formIndicator.count({
      where: { catalogEntryId: id, isActive: true },
    });
    if (activeLinkedCount > 0) {
      throw new ConflictException(
        'Nao e possivel desativar: ha indicadores ativos vinculados a este codigo de catalogo.',
      );
    }

    return this.prisma.indicatorCatalog.update({ where: { id }, data: { isActive: false } });
  }

  private async ensureExists(id: string) {
    const entry = await this.prisma.indicatorCatalog.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Entrada de catalogo nao encontrada');
    }
    return entry;
  }
}
