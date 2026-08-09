import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormTopicDto } from './dto/create-form-topic.dto';
import { UpdateFormTopicDto } from './dto/update-form-topic.dto';

@Injectable()
export class FormTopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContextService: AuditContextService,
  ) {}

  async create(formTemplateId: string, dto: CreateFormTopicDto) {
    const template = await this.prisma.formTemplate.findUnique({ where: { id: formTemplateId } });
    if (!template) {
      throw new NotFoundException('Formulario nao encontrado');
    }
    return this.auditContextService.runWithAuditContext((tx) =>
      tx.formTopic.create({ data: { ...dto, formTemplateId } }),
    );
  }

  async update(id: string, dto: UpdateFormTopicDto) {
    await this.ensureExists(id);
    return this.auditContextService.runWithAuditContext((tx) => tx.formTopic.update({ where: { id }, data: dto }));
  }

  async setActive(id: string, isActive: boolean) {
    await this.ensureExists(id);
    return this.auditContextService.runWithAuditContext((tx) =>
      tx.formTopic.update({ where: { id }, data: { isActive } }),
    );
  }

  private async ensureExists(id: string) {
    const topic = await this.prisma.formTopic.findUnique({ where: { id } });
    if (!topic) {
      throw new NotFoundException('Topico nao encontrado');
    }
    return topic;
  }
}
