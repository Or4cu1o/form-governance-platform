import { AccessLogEventType, ActorKind } from '@prisma/client';
import { AccessLogService } from './access-log.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AccessLogService', () => {
  let service: AccessLogService;
  let createMock: jest.Mock;

  beforeEach(() => {
    createMock = jest.fn().mockResolvedValue({ id: 'access-log-1' });
    const prisma = { accessLog: { create: createMock } } as unknown as PrismaService;
    service = new AccessLogService(prisma);
  });

  test('records the filters applied, the scope, and the result volume in full — never summarized', async () => {
    const filtersApplied = { unitId: 'unit-1', referenceMonthFrom: '2026-01-01', indicatorCode: 'CA_CB' };

    await service.record({
      eventType: AccessLogEventType.CONSULTA_AUDITORIA,
      userId: 'user-1',
      actorKind: ActorKind.USUARIO,
      filtersApplied,
      scopeUnitIds: ['unit-1', 'unit-2'],
      resultVolume: 4231,
      sourceIp: '203.0.113.9',
      userAgent: 'jest-agent',
      requestId: 'req-abc',
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        eventType: AccessLogEventType.CONSULTA_AUDITORIA,
        userId: 'user-1',
        actorKind: ActorKind.USUARIO,
        filtersApplied,
        scopeUnitIds: ['unit-1', 'unit-2'],
        resultVolume: 4231,
        sourceIp: '203.0.113.9',
        userAgent: 'jest-agent',
        requestId: 'req-abc',
      },
    });
  });

  test('records an anonymous read explicitly (ANONIMO_DECLARADO), never a bare null actor', async () => {
    await service.record({
      eventType: AccessLogEventType.LOGIN_FALHA,
      userId: null,
      actorKind: ActorKind.ANONIMO_DECLARADO,
      sourceIp: '203.0.113.9',
    });

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: null, actorKind: ActorKind.ANONIMO_DECLARADO }),
    });
  });

  test('defaults scopeUnitIds to an empty array and optional fields to null when omitted', async () => {
    await service.record({
      eventType: AccessLogEventType.DOWNLOAD_EVIDENCIA,
      userId: 'user-1',
      actorKind: ActorKind.USUARIO,
    });

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scopeUnitIds: [],
        filtersApplied: undefined,
        resultVolume: null,
        sourceIp: null,
        userAgent: null,
        requestId: null,
      }),
    });
  });
});
