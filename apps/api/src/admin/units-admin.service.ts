import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FormIndicatorsService } from '../forms/form-indicators.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formIndicatorsService: FormIndicatorsService,
  ) {}

  findAll(includeInactive: boolean) {
    return this.prisma.unit.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { formTemplate: { select: { id: true, name: true } } },
      orderBy: { sigla: 'asc' },
    });
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { formTemplate: { select: { id: true, name: true } } },
    });
    if (!unit) {
      throw new NotFoundException('Unidade nao encontrada');
    }
    return unit;
  }

  async create(dto: CreateUnitDto) {
    if (dto.formTemplateId) {
      await this.formIndicatorsService.assertBalanced(dto.formTemplateId);
    }
    try {
      return await this.prisma.unit.create({ data: dto });
    } catch (error) {
      throw this.translateUniqueConstraintError(error);
    }
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.ensureExists(id);
    if (dto.formTemplateId) {
      await this.formIndicatorsService.assertBalanced(dto.formTemplateId);
    }
    try {
      return await this.prisma.unit.update({ where: { id }, data: dto });
    } catch (error) {
      throw this.translateUniqueConstraintError(error);
    }
  }

  async setActive(id: string, isActive: boolean) {
    await this.ensureExists(id);
    return this.prisma.unit.update({ where: { id }, data: { isActive } });
  }

  private async ensureExists(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException('Unidade nao encontrada');
    }
    return unit;
  }

  private translateUniqueConstraintError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'campo unico';
      return new ConflictException(`Valor duplicado para: ${target}`);
    }
    return error;
  }
}
