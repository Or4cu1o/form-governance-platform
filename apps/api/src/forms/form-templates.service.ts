import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormTemplateDto } from './dto/create-form-template.dto';
import { UpdateFormTemplateDto } from './dto/update-form-template.dto';

@Injectable()
export class FormTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateFormTemplateDto) {
    return this.prisma.formTemplate.create({ data: dto });
  }

  findAll(includeInactive: boolean) {
    return this.prisma.formTemplate.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOneWithStructure(id: string, includeInactive: boolean) {
    const template = await this.prisma.formTemplate.findUnique({
      where: { id },
      include: {
        topics: {
          where: includeInactive ? undefined : { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            indicators: {
              where: includeInactive ? undefined : { isActive: true },
              orderBy: { order: 'asc' },
              include: { catalogEntry: true },
            },
          },
        },
      },
    });
    if (!template) {
      throw new NotFoundException('Formulario nao encontrado');
    }
    return template;
  }

  async update(id: string, dto: UpdateFormTemplateDto) {
    await this.ensureExists(id);
    return this.prisma.formTemplate.update({ where: { id }, data: dto });
  }

  async setActive(id: string, isActive: boolean) {
    await this.ensureExists(id);
    return this.prisma.formTemplate.update({ where: { id }, data: { isActive } });
  }

  private async ensureExists(id: string) {
    const template = await this.prisma.formTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Formulario nao encontrado');
    }
    return template;
  }
}
