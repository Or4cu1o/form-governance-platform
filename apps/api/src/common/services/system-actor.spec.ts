import { AUDIT_ORIGIN_CRON, AUDIT_ORIGIN_SEED, buildSystemAuditContext, runAsSystemActor } from './system-actor';
import { AuditContextService } from './audit-context.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('system-actor', () => {
  describe('buildSystemAuditContext', () => {
    test('never leaves the actor unidentified: userId is null but actorNameSnapshot always names the system', () => {
      const context = buildSystemAuditContext('Abertura automatica de periodo', AUDIT_ORIGIN_CRON);

      expect(context.userId).toBeNull();
      expect(context.origin).toBe(AUDIT_ORIGIN_CRON);
      expect(context.actorNameSnapshot).toContain('Abertura automatica de periodo');
      expect(context.actorNameSnapshot).not.toHaveLength(0);
    });

    test('keeps the origin identifiable and distinct between cron and seed', () => {
      const cronContext = buildSystemAuditContext('rotina diaria', AUDIT_ORIGIN_CRON);
      const seedContext = buildSystemAuditContext('carga inicial', AUDIT_ORIGIN_SEED);

      expect(cronContext.origin).toBe('CRON');
      expect(seedContext.origin).toBe('SEED');
    });
  });

  describe('runAsSystemActor', () => {
    let transactionMock: jest.Mock;
    let executeRawMock: jest.Mock;
    let auditContextService: AuditContextService;

    beforeEach(() => {
      executeRawMock = jest.fn().mockResolvedValue(undefined);
      transactionMock = jest
        .fn()
        .mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ $executeRaw: executeRawMock }));
      const prisma = { $transaction: transactionMock } as unknown as PrismaService;
      auditContextService = new AuditContextService(prisma);
    });

    test('makes the system context available to writes performed inside the callback', async () => {
      const write = jest.fn().mockResolvedValue('ok');

      const result = await runAsSystemActor(auditContextService, 'Abertura automatica de periodo', AUDIT_ORIGIN_CRON, () =>
        auditContextService.runWithAuditContext(write),
      );

      expect(result).toBe('ok');
      expect(write).toHaveBeenCalled();
      expect(auditContextService.getContext()).toBeUndefined();
    });

    test('a write attempted outside of runAsSystemActor is still rejected, never anonymous', async () => {
      await expect(auditContextService.runWithAuditContext(async () => 'resultado')).rejects.toThrow(
        /contexto de auditoria/i,
      );
    });
  });
});
