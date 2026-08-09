import { AuditContext, AuditContextService } from './audit-context.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditContextService', () => {
  let service: AuditContextService;
  let transactionMock: jest.Mock;
  let executeRawMock: jest.Mock;

  const baseContext: AuditContext = {
    userId: 'user-1',
    sourceIp: '10.0.0.1',
    userAgent: 'jest-agent',
    origin: 'WEB',
    requestId: 'req-1',
    actorNameSnapshot: 'Fulano de Tal',
    actorJobTitleSnapshot: null,
    actorRoleSnapshot: 'ELABORADOR',
    actorUnitSnapshot: 'UNID-1',
  };

  beforeEach(() => {
    executeRawMock = jest.fn().mockResolvedValue(undefined);
    transactionMock = jest
      .fn()
      .mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ $executeRaw: executeRawMock }));
    const prisma = { $transaction: transactionMock } as unknown as PrismaService;
    service = new AuditContextService(prisma);
  });

  test('rejects a write when no audit context is active, never opening a transaction', async () => {
    await expect(service.runWithAuditContext(async () => 'resultado')).rejects.toThrow(/contexto de auditoria/i);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  test('sets every session variable from the active context before running the callback', async () => {
    const callback = jest.fn().mockResolvedValue('ok');

    const result = await service.run(baseContext, () => service.runWithAuditContext(callback));

    expect(result).toBe('ok');
    expect(callback).toHaveBeenCalledWith({ $executeRaw: executeRawMock });
    expect(executeRawMock).toHaveBeenCalledTimes(9);
  });

  test('propagates the active context across async boundaries within the same run() scope', async () => {
    const result = await service.run(baseContext, async () => {
      await Promise.resolve();
      return service.runWithAuditContext(async () => service.getContext()?.userId);
    });

    expect(result).toBe('user-1');
  });

  test('keeps concurrent run() scopes isolated from each other', async () => {
    const [a, b] = await Promise.all([
      service.run({ ...baseContext, userId: 'user-a' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.getContext()?.userId;
      }),
      service.run({ ...baseContext, userId: 'user-b' }, async () => service.getContext()?.userId),
    ]);

    expect(a).toBe('user-a');
    expect(b).toBe('user-b');
  });

  test('rejects when called again outside of any active scope after the outer one finished', async () => {
    await service.run(baseContext, async () => undefined);

    await expect(service.runWithAuditContext(async () => 'resultado')).rejects.toThrow(/contexto de auditoria/i);
  });
});
