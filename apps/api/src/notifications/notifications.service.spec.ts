import { ReportInstance, RoleName, Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let findManyMock: jest.Mock;
  let sendMock: jest.Mock;
  let notificationFailureCreateMock: jest.Mock;

  const unit = { id: 'unit-1', sigla: 'FIL01', nome: 'Filial Um' } as Unit;
  const report = { id: 'report-1', referenceMonth: new Date('2026-07-01'), slaExtensionDueDate: null } as ReportInstance;

  beforeEach(() => {
    findManyMock = jest.fn();
    sendMock = jest.fn();
    notificationFailureCreateMock = jest.fn().mockResolvedValue({ id: 'failure-1' });
    const prisma = {
      user: { findMany: findManyMock },
      notificationFailure: { create: notificationFailureCreateMock },
    } as unknown as PrismaService;
    const emailService = { send: sendMock } as unknown as EmailService;
    service = new NotificationsService(prisma, emailService);
  });

  test('notifySlaOverdue sends only to ELABORADOR of the report unit', async () => {
    findManyMock.mockResolvedValue([{ email: 'elaborador@formops.local' }]);

    await service.notifySlaOverdue({ ...report, unit });

    expect(findManyMock).toHaveBeenCalledWith({
      where: { primaryUnitId: unit.id, role: { in: [RoleName.ELABORADOR] }, isActive: true },
      select: { email: true },
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: ['elaborador@formops.local'] }));
  });

  test('notifySubmittedForApproval queries org-wide APROVADOR without unit filter', async () => {
    findManyMock.mockResolvedValue([{ email: 'aprovador@formops.local' }]);

    await service.notifySubmittedForApproval(report, unit);

    expect(findManyMock).toHaveBeenCalledWith({
      where: { role: { in: [RoleName.APROVADOR] }, isActive: true },
      select: { email: true },
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: ['aprovador@formops.local'] }));
  });

  test('notifyReportReproved sends to both ELABORADOR and REVISOR of the unit', async () => {
    findManyMock.mockResolvedValue([{ email: 'a@formops.local' }, { email: 'b@formops.local' }]);

    await service.notifyReportReproved(report, unit);

    expect(findManyMock).toHaveBeenCalledWith({
      where: { primaryUnitId: unit.id, role: { in: [RoleName.ELABORADOR, RoleName.REVISOR] }, isActive: true },
      select: { email: true },
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: ['a@formops.local', 'b@formops.local'] }));
  });

  test('does not call EmailService.send with an empty recipient list resolved upstream', async () => {
    findManyMock.mockResolvedValue([]);

    await service.notifyReportConcluded(report, unit);

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: [] }));
  });

  test('does not throw when EmailService.send rejects (SMTP failure must not fail an already-committed transition)', async () => {
    findManyMock.mockResolvedValue([{ email: 'elaborador@formops.local' }]);
    sendMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.notifyReportConcluded(report, unit)).resolves.toBeUndefined();
  });

  // T170/FR-123/FR-112 — a falha nao pode existir so em logger.error: fica
  // registrada em NotificationFailure com servico/operacao/causa (FR-123)
  // e destinatario/transicao afetados (FR-112).
  test('persists a NotificationFailure with service, operation, cause, recipients and the affected report when send fails', async () => {
    findManyMock.mockResolvedValue([{ email: 'elaborador@formops.local' }]);
    sendMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await service.notifyReportConcluded(report, unit);

    expect(notificationFailureCreateMock).toHaveBeenCalledWith({
      data: {
        service: 'notifications',
        operation: 'notifyReportConcluded',
        reportInstanceId: report.id,
        recipients: ['elaborador@formops.local'],
        cause: 'ECONNREFUSED',
      },
    });
  });

  test('persists a NotificationFailure with an empty recipients list when resolving recipients itself fails', async () => {
    findManyMock.mockRejectedValue(new Error('connection terminated'));

    await service.notifySubmittedForApproval(report, unit);

    expect(sendMock).not.toHaveBeenCalled();
    expect(notificationFailureCreateMock).toHaveBeenCalledWith({
      data: {
        service: 'notifications',
        operation: 'notifySubmittedForApproval',
        reportInstanceId: report.id,
        recipients: [],
        cause: 'connection terminated',
      },
    });
  });

  test('does not throw even when persisting the NotificationFailure itself fails', async () => {
    findManyMock.mockResolvedValue([{ email: 'elaborador@formops.local' }]);
    sendMock.mockRejectedValue(new Error('ECONNREFUSED'));
    notificationFailureCreateMock.mockRejectedValue(new Error('banco indisponivel'));

    await expect(service.notifyReportConcluded(report, unit)).resolves.toBeUndefined();
  });

  test('does not persist a NotificationFailure when the notification succeeds', async () => {
    findManyMock.mockResolvedValue([{ email: 'elaborador@formops.local' }]);

    await service.notifyReportConcluded(report, unit);

    expect(notificationFailureCreateMock).not.toHaveBeenCalled();
  });
});
