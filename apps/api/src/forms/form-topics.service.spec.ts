import { NotFoundException } from '@nestjs/common';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { FormTopicsService } from './form-topics.service';

describe('FormTopicsService', () => {
  let service: FormTopicsService;
  let findUniqueTemplateMock: jest.Mock;
  let createMock: jest.Mock;
  let findUniqueTopicMock: jest.Mock;
  let updateMock: jest.Mock;

  beforeEach(() => {
    findUniqueTemplateMock = jest.fn();
    createMock = jest.fn();
    findUniqueTopicMock = jest.fn();
    updateMock = jest.fn();
    const prisma = {
      formTemplate: { findUnique: findUniqueTemplateMock },
      formTopic: { findUnique: findUniqueTopicMock },
    } as unknown as PrismaService;
    const runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) =>
      fn({ formTopic: { create: createMock, update: updateMock } }),
    );
    const auditContextService = {
      runWithAuditContext: runWithAuditContextMock,
    } as unknown as AuditContextService;
    service = new FormTopicsService(prisma, auditContextService);
  });

  describe('create', () => {
    test('throws NotFoundException when the parent template does not exist', async () => {
      findUniqueTemplateMock.mockResolvedValue(null);

      await expect(service.create('missing-template', { title: 'Governança', order: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });

    test('creates the topic under an existing template', async () => {
      findUniqueTemplateMock.mockResolvedValue({ id: 'template-1' });

      await service.create('template-1', { title: 'Governança', order: 1 });

      expect(createMock).toHaveBeenCalledWith({
        data: { title: 'Governança', order: 1, formTemplateId: 'template-1' },
      });
    });
  });

  describe('update', () => {
    test('throws NotFoundException when the topic does not exist', async () => {
      findUniqueTopicMock.mockResolvedValue(null);

      await expect(service.update('missing', { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    test('updates an existing topic', async () => {
      findUniqueTopicMock.mockResolvedValue({ id: 'topic-1' });

      await service.update('topic-1', { title: 'Novo titulo' });

      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'topic-1' }, data: { title: 'Novo titulo' } });
    });
  });

  describe('setActive', () => {
    test('throws NotFoundException when the topic does not exist', async () => {
      findUniqueTopicMock.mockResolvedValue(null);

      await expect(service.setActive('missing', false)).rejects.toThrow(NotFoundException);
    });

    test('flips the isActive flag for an existing topic', async () => {
      findUniqueTopicMock.mockResolvedValue({ id: 'topic-1' });

      await service.setActive('topic-1', false);

      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'topic-1' }, data: { isActive: false } });
    });
  });
});
