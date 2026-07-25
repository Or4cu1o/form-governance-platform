import { ReportInstance, RoleName, Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let findManyMock: jest.Mock;
  let sendMock: jest.Mock;

  const unit = { id: 'unit-1', sigla: 'FIL01', nome: 'Filial Um' } as Unit;
  const report = { id: 'report-1', referenceMonth: new Date('2026-07-01'), slaExtensionDueDate: null } as ReportInstance;

  beforeEach(() => {
    findManyMock = jest.fn();
    sendMock = jest.fn();
    const prisma = { user: { findMany: findManyMock } } as unknown as PrismaService;
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

  describe('notifyElevationRequested', () => {
    test('sends the elevation email to every active ADMINISTRADOR', async () => {
      findManyMock.mockResolvedValue([{ email: 'admin1@empresa.local' }, { email: 'admin2@empresa.local' }]);

      await service.notifyElevationRequested(
        { nome: 'Joao', sobrenome: 'Silva', matricula: '12345' },
        RoleName.ADMINISTRADOR,
      );

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: { in: [RoleName.ADMINISTRADOR] }, isActive: true } }),
      );
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: ['admin1@empresa.local', 'admin2@empresa.local'] }),
      );
    });

    test('does not call EmailService.send when there are no administrators', async () => {
      findManyMock.mockResolvedValue([]);

      await service.notifyElevationRequested({ nome: 'Joao', sobrenome: 'Silva', matricula: '12345' }, RoleName.APROVADOR);

      expect(sendMock).not.toHaveBeenCalled();
    });
  });
});
