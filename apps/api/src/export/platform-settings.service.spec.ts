import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from './platform-settings.service';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;
  let findFirstMock: jest.Mock;
  let createMock: jest.Mock;
  let updateMock: jest.Mock;

  beforeEach(() => {
    findFirstMock = jest.fn();
    createMock = jest.fn();
    updateMock = jest.fn();
    const prisma = {
      systemSetting: { findFirst: findFirstMock, create: createMock, update: updateMock },
    } as unknown as PrismaService;
    service = new PlatformSettingsService(prisma);
  });

  const defaultSettings = {
    id: 'settings-1',
    exportNamingPattern: '{SIGLA_UNIDADE}_{DATA_ISO}',
    slaElaborationBusinessDay: 6,
    slaReviewBusinessDay: 8,
    slaApprovalBusinessDay: 10,
    slaReprovalExtensionDays: 2,
    slaDeflatorScore: 2,
  };

  describe('getSettings', () => {
    test('returns the existing settings row when one already exists', async () => {
      findFirstMock.mockResolvedValue(defaultSettings);

      const result = await service.getSettings();

      expect(result).toBe(defaultSettings);
      expect(createMock).not.toHaveBeenCalled();
    });

    test('creates default settings when none exist yet', async () => {
      findFirstMock.mockResolvedValue(null);
      createMock.mockResolvedValue(defaultSettings);

      const result = await service.getSettings();

      expect(createMock).toHaveBeenCalledWith({ data: {} });
      expect(result).toBe(defaultSettings);
    });
  });

  describe('updateSettings', () => {
    test('updates only the fields provided in the dto', async () => {
      findFirstMock.mockResolvedValue(defaultSettings);
      updateMock.mockResolvedValue({ ...defaultSettings, exportNamingPattern: 'novo-padrao' });

      await service.updateSettings({ exportNamingPattern: 'novo-padrao' });

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'settings-1' },
        data: { exportNamingPattern: 'novo-padrao' },
      });
    });

    test('updates SLA thresholds and deflator score together', async () => {
      findFirstMock.mockResolvedValue(defaultSettings);
      updateMock.mockResolvedValue({ ...defaultSettings, slaElaborationBusinessDay: 5 });

      await service.updateSettings({
        slaElaborationBusinessDay: 5,
        slaReviewBusinessDay: 9,
        slaApprovalBusinessDay: 11,
        slaReprovalExtensionDays: 3,
        slaDeflatorScore: 1.5,
      });

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'settings-1' },
        data: {
          slaElaborationBusinessDay: 5,
          slaReviewBusinessDay: 9,
          slaApprovalBusinessDay: 11,
          slaReprovalExtensionDays: 3,
          slaDeflatorScore: 1.5,
        },
      });
    });

    // T087: os sete parametros novos de SystemSetting (A7) sao expostos e
    // persistidos por updateSettings, um a um, sem exigir os demais.
    test('updates each of the seven new SystemSetting parameters independently', async () => {
      findFirstMock.mockResolvedValue(defaultSettings);
      updateMock.mockResolvedValue(defaultSettings);

      await service.updateSettings({ evidenceRetentionYears: -1 });
      expect(updateMock).toHaveBeenLastCalledWith({
        where: { id: 'settings-1' },
        data: { evidenceRetentionYears: -1 },
      });

      await service.updateSettings({ includeOptionalHolidays: true });
      expect(updateMock).toHaveBeenLastCalledWith({
        where: { id: 'settings-1' },
        data: { includeOptionalHolidays: true },
      });

      await service.updateSettings({ auditMaxRangeMonths: 18 });
      expect(updateMock).toHaveBeenLastCalledWith({
        where: { id: 'settings-1' },
        data: { auditMaxRangeMonths: 18 },
      });

      await service.updateSettings({ auditDetailedMaxRangeMonths: 6 });
      expect(updateMock).toHaveBeenLastCalledWith({
        where: { id: 'settings-1' },
        data: { auditDetailedMaxRangeMonths: 6 },
      });

      await service.updateSettings({ auditExactCountThreshold: 5000 });
      expect(updateMock).toHaveBeenLastCalledWith({
        where: { id: 'settings-1' },
        data: { auditExactCountThreshold: 5000 },
      });

      await service.updateSettings({ outlierRule: 'IQR' });
      expect(updateMock).toHaveBeenLastCalledWith({
        where: { id: 'settings-1' },
        data: { outlierRule: 'IQR' },
      });

      await service.updateSettings({ forensicHoldYears: 2 });
      expect(updateMock).toHaveBeenLastCalledWith({
        where: { id: 'settings-1' },
        data: { forensicHoldYears: 2 },
      });
    });

    test('rejects when the resulting SLA thresholds are not strictly increasing', async () => {
      findFirstMock.mockResolvedValue(defaultSettings);

      await expect(service.updateSettings({ slaElaborationBusinessDay: 9 })).rejects.toThrow(
        'Os prazos de SLA devem ser crescentes: elaboracao < revisao < aprovacao.',
      );
      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
