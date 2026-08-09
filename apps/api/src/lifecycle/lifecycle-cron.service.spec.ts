import { ReportStatus, Unit } from '@prisma/client';
import * as businessDaysUtil from './business-days.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContextService } from '../common/services/audit-context.service';
import { LifecycleCronService } from './lifecycle-cron.service';
import { ReportLifecycleService } from './report-lifecycle.service';

describe('LifecycleCronService', () => {
  let service: LifecycleCronService;
  let findManyUnitsMock: jest.Mock;
  let findManyReportsMock: jest.Mock;
  let openPeriodForUnitMock: jest.Mock;
  let notifySlaOverdueMock: jest.Mock;

  beforeEach(() => {
    findManyUnitsMock = jest.fn();
    findManyReportsMock = jest.fn();
    openPeriodForUnitMock = jest.fn();
    notifySlaOverdueMock = jest.fn();

    const prisma = {
      unit: { findMany: findManyUnitsMock },
      reportInstance: { findMany: findManyReportsMock },
    } as unknown as PrismaService;
    const reportLifecycleService = { openPeriodForUnit: openPeriodForUnitMock } as unknown as ReportLifecycleService;
    const notificationsService = { notifySlaOverdue: notifySlaOverdueMock } as unknown as NotificationsService;
    const auditContextService = new AuditContextService({} as unknown as PrismaService);

    service = new LifecycleCronService(prisma, reportLifecycleService, notificationsService, auditContextService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleDailyBusinessDayCheck', () => {
    test('does nothing when today is a national holiday (no business-day ordinal)', async () => {
      jest.spyOn(businessDaysUtil, 'getBusinessDayOrdinalInMonth').mockReturnValue(null);
      const openSpy = jest.spyOn(service, 'openMonthlyPeriods').mockResolvedValue(undefined);
      const checkSpy = jest.spyOn(service, 'checkSlaOverdue').mockResolvedValue(undefined);

      await service.handleDailyBusinessDayCheck();

      expect(openSpy).not.toHaveBeenCalled();
      expect(checkSpy).not.toHaveBeenCalled();
    });

    test('opens the monthly period on the 1st business day', async () => {
      jest.spyOn(businessDaysUtil, 'getBusinessDayOrdinalInMonth').mockReturnValue(1);
      const openSpy = jest.spyOn(service, 'openMonthlyPeriods').mockResolvedValue(undefined);
      const checkSpy = jest.spyOn(service, 'checkSlaOverdue').mockResolvedValue(undefined);

      await service.handleDailyBusinessDayCheck();

      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(checkSpy).not.toHaveBeenCalled();
    });

    test('checks SLA overdue on the 5th business day', async () => {
      jest.spyOn(businessDaysUtil, 'getBusinessDayOrdinalInMonth').mockReturnValue(5);
      const openSpy = jest.spyOn(service, 'openMonthlyPeriods').mockResolvedValue(undefined);
      const checkSpy = jest.spyOn(service, 'checkSlaOverdue').mockResolvedValue(undefined);

      await service.handleDailyBusinessDayCheck();

      expect(checkSpy).toHaveBeenCalledTimes(1);
      expect(openSpy).not.toHaveBeenCalled();
    });

    test('does nothing on business days that are neither the 1st nor the 5th', async () => {
      jest.spyOn(businessDaysUtil, 'getBusinessDayOrdinalInMonth').mockReturnValue(3);
      const openSpy = jest.spyOn(service, 'openMonthlyPeriods').mockResolvedValue(undefined);
      const checkSpy = jest.spyOn(service, 'checkSlaOverdue').mockResolvedValue(undefined);

      await service.handleDailyBusinessDayCheck();

      expect(openSpy).not.toHaveBeenCalled();
      expect(checkSpy).not.toHaveBeenCalled();
    });
  });

  describe('openMonthlyPeriods', () => {
    test('opens the period for every active unit with a form template assigned', async () => {
      const units = [{ id: 'unit-1' } as Unit, { id: 'unit-2' } as Unit];
      findManyUnitsMock.mockResolvedValue(units);

      await service.openMonthlyPeriods(new Date('2026-07-15T00:00:00.000Z'));

      expect(findManyUnitsMock).toHaveBeenCalledWith({
        where: { isActive: true, formTemplateId: { not: null } },
      });
      expect(openPeriodForUnitMock).toHaveBeenCalledTimes(2);
      expect(openPeriodForUnitMock).toHaveBeenCalledWith(units[0], new Date(Date.UTC(2026, 6, 1)));
      expect(openPeriodForUnitMock).toHaveBeenCalledWith(units[1], new Date(Date.UTC(2026, 6, 1)));
    });
  });

  describe('checkSlaOverdue', () => {
    test('notifies SLA overdue for every report still PENDENTE in the reference month', async () => {
      const unit = { id: 'unit-1', sigla: 'FIL01' } as Unit;
      const overdueReports = [{ id: 'report-1', unit }, { id: 'report-2', unit }];
      findManyReportsMock.mockResolvedValue(overdueReports);

      await service.checkSlaOverdue(new Date('2026-07-08T00:00:00.000Z'));

      expect(findManyReportsMock).toHaveBeenCalledWith({
        where: { referenceMonth: new Date(Date.UTC(2026, 6, 1)), status: ReportStatus.PENDENTE },
        include: { unit: true },
      });
      expect(notifySlaOverdueMock).toHaveBeenCalledTimes(2);
      expect(notifySlaOverdueMock).toHaveBeenCalledWith(overdueReports[0]);
      expect(notifySlaOverdueMock).toHaveBeenCalledWith(overdueReports[1]);
    });

    test('does nothing when no report is overdue', async () => {
      findManyReportsMock.mockResolvedValue([]);

      await service.checkSlaOverdue(new Date('2026-07-08T00:00:00.000Z'));

      expect(notifySlaOverdueMock).not.toHaveBeenCalled();
    });
  });
});
