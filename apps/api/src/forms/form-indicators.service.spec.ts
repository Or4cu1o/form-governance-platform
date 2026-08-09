import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GoalOperator } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FormIndicatorsService } from './form-indicators.service';

describe('FormIndicatorsService', () => {
  let service: FormIndicatorsService;
  let findUniqueTopicMock: jest.Mock;
  let createMock: jest.Mock;
  let findUniqueIndicatorMock: jest.Mock;
  let updateMock: jest.Mock;
  let findUniqueTemplateMock: jest.Mock;
  let findManyIndicatorMock: jest.Mock;
  let transactionMock: jest.Mock;

  const validDto = {
    title: 'Chamados: Backlog',
    objective: 'Medir backlog',
    variableKeys: ['CA', 'CB'],
    formulaExpression: '(CB / CA) * 100',
    goalOperator: GoalOperator.LTE,
    goalValue: 5,
    catalogEntryId: 'catalog-1',
  };

  beforeEach(() => {
    findUniqueTopicMock = jest.fn();
    createMock = jest.fn();
    findUniqueIndicatorMock = jest.fn();
    updateMock = jest.fn();
    findUniqueTemplateMock = jest.fn();
    findManyIndicatorMock = jest.fn();
    transactionMock = jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops));
    const prisma = {
      formTopic: { findUnique: findUniqueTopicMock },
      formTemplate: { findUnique: findUniqueTemplateMock },
      formIndicator: {
        create: createMock,
        findUnique: findUniqueIndicatorMock,
        findMany: findManyIndicatorMock,
        update: updateMock,
      },
      $transaction: transactionMock,
    } as unknown as PrismaService;
    service = new FormIndicatorsService(prisma);
  });

  describe('create', () => {
    test('throws NotFoundException when the parent topic does not exist', async () => {
      findUniqueTopicMock.mockResolvedValue(null);

      await expect(service.create('missing-topic', validDto)).rejects.toThrow(NotFoundException);
    });

    test('throws BadRequestException when the formula references an undeclared variable', async () => {
      findUniqueTopicMock.mockResolvedValue({ id: 'topic-1' });

      await expect(
        service.create('topic-1', { ...validDto, formulaExpression: '(CB / UNDECLARED) * 100' }),
      ).rejects.toThrow(BadRequestException);
      expect(createMock).not.toHaveBeenCalled();
    });

    test('creates the indicator under an existing topic when the formula is valid', async () => {
      findUniqueTopicMock.mockResolvedValue({ id: 'topic-1' });

      await service.create('topic-1', validDto);

      expect(createMock).toHaveBeenCalledWith({ data: { ...validDto, formTopicId: 'topic-1' } });
    });
  });

  describe('update', () => {
    test('throws NotFoundException when the indicator does not exist', async () => {
      findUniqueIndicatorMock.mockResolvedValue(null);

      await expect(service.update('missing', { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    test('re-validates the merged formula/variableKeys before persisting a partial update', async () => {
      findUniqueIndicatorMock.mockResolvedValue({
        id: 'indicator-1',
        variableKeys: validDto.variableKeys,
        formulaExpression: validDto.formulaExpression,
      });

      await expect(service.update('indicator-1', { variableKeys: ['CA'] })).rejects.toThrow(BadRequestException);
      expect(updateMock).not.toHaveBeenCalled();
    });

    test('updates the indicator when the resulting formula/variableKeys remain valid', async () => {
      findUniqueIndicatorMock.mockResolvedValue({
        id: 'indicator-1',
        variableKeys: validDto.variableKeys,
        formulaExpression: validDto.formulaExpression,
      });

      await service.update('indicator-1', { goalValue: 10 });

      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'indicator-1' }, data: { goalValue: 10 } });
    });
  });

  describe('setActive', () => {
    test('throws NotFoundException when the indicator does not exist', async () => {
      findUniqueIndicatorMock.mockResolvedValue(null);

      await expect(service.setActive('missing', false)).rejects.toThrow(NotFoundException);
    });

    test('flips the isActive flag for an existing indicator', async () => {
      findUniqueIndicatorMock.mockResolvedValue({ id: 'indicator-1' });

      await service.setActive('indicator-1', false);

      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'indicator-1' }, data: { isActive: false } });
    });
  });

  describe('getScores', () => {
    test('throws NotFoundException when the template does not exist', async () => {
      findUniqueTemplateMock.mockResolvedValue(null);

      await expect(service.getScores('missing-template')).rejects.toThrow(NotFoundException);
    });

    test('returns the active indicators with their current weight and sum', async () => {
      findUniqueTemplateMock.mockResolvedValue({ id: 'template-1' });
      findManyIndicatorMock.mockResolvedValue([
        { id: 'ind-1', title: 'A', scoreWeight: 4 },
        { id: 'ind-2', title: 'B', scoreWeight: 6 },
      ]);

      const result = await service.getScores('template-1');

      expect(result).toEqual({
        items: [
          { id: 'ind-1', title: 'A', scoreWeight: 4 },
          { id: 'ind-2', title: 'B', scoreWeight: 6 },
        ],
        sum: 10,
        target: 10,
      });
    });
  });

  describe('updateScores', () => {
    beforeEach(() => {
      findUniqueTemplateMock.mockResolvedValue({ id: 'template-1' });
    });

    test('rejects when the provided indicator ids do not match the active set', async () => {
      findManyIndicatorMock.mockResolvedValue([{ id: 'ind-1', title: 'A', scoreWeight: 0 }]);

      await expect(
        service.updateScores('template-1', { weights: [{ indicatorId: 'ind-other', scoreWeight: 10 }] }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    test('rejects when the sum of weights is not 10', async () => {
      findManyIndicatorMock.mockResolvedValue([
        { id: 'ind-1', title: 'A', scoreWeight: 0 },
        { id: 'ind-2', title: 'B', scoreWeight: 0 },
      ]);

      await expect(
        service.updateScores('template-1', {
          weights: [
            { indicatorId: 'ind-1', scoreWeight: 4 },
            { indicatorId: 'ind-2', scoreWeight: 4 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    test('persists the weights when they cover the active set and sum to 10', async () => {
      findManyIndicatorMock
        .mockResolvedValueOnce([
          { id: 'ind-1', title: 'A', scoreWeight: 0 },
          { id: 'ind-2', title: 'B', scoreWeight: 0 },
        ])
        .mockResolvedValueOnce([
          { id: 'ind-1', title: 'A', scoreWeight: 3 },
          { id: 'ind-2', title: 'B', scoreWeight: 7 },
        ]);

      const result = await service.updateScores('template-1', {
        weights: [
          { indicatorId: 'ind-1', scoreWeight: 3 },
          { indicatorId: 'ind-2', scoreWeight: 7 },
        ],
      });

      expect(transactionMock).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'ind-1' }, data: { scoreWeight: 3 } });
      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'ind-2' }, data: { scoreWeight: 7 } });
      expect(result.sum).toBe(10);
    });
  });

  describe('distributeEvenly', () => {
    test('rejects when there are no active indicators', async () => {
      findUniqueTemplateMock.mockResolvedValue({ id: 'template-1' });
      findManyIndicatorMock.mockResolvedValue([]);

      await expect(service.distributeEvenly('template-1')).rejects.toThrow(BadRequestException);
    });

    test('splits the score evenly across active indicators', async () => {
      findUniqueTemplateMock.mockResolvedValue({ id: 'template-1' });
      findManyIndicatorMock
        .mockResolvedValueOnce([
          { id: 'ind-1', title: 'A', scoreWeight: 0 },
          { id: 'ind-2', title: 'B', scoreWeight: 0 },
        ])
        .mockResolvedValueOnce([
          { id: 'ind-1', title: 'A', scoreWeight: 5 },
          { id: 'ind-2', title: 'B', scoreWeight: 5 },
        ]);

      const result = await service.distributeEvenly('template-1');

      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'ind-1' }, data: { scoreWeight: 5 } });
      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'ind-2' }, data: { scoreWeight: 5 } });
      expect(result.sum).toBe(10);
    });
  });
});
