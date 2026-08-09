import { ConfigService } from '@nestjs/config';
import { EvidenceScanStatus } from '@prisma/client';
import { AuditContextService } from '../common/services/audit-context.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { AntivirusService } from './antivirus.service';

const scanStreamMock = jest.fn();
const initMock = jest.fn();

jest.mock('clamscan', () => {
  return jest.fn().mockImplementation(() => ({
    init: initMock,
  }));
});

describe('AntivirusService', () => {
  let service: AntivirusService;
  let findUniqueOrThrowMock: jest.Mock;
  let findManyMock: jest.Mock;
  let downloadObjectMock: jest.Mock;
  let promoteToImmutableMock: jest.Mock;
  let getImmutableBucketNameMock: jest.Mock;
  let runWithAuditContextMock: jest.Mock;
  let txUpdateMock: jest.Mock;
  let getSettingsMock: jest.Mock;

  function buildConfigService(): ConfigService {
    const values: Record<string, string> = { CLAMAV_HOST: 'clamav', CLAMAV_PORT: '3310' };
    return { getOrThrow: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
  }

  beforeEach(() => {
    scanStreamMock.mockReset();
    initMock.mockReset().mockResolvedValue({ scanStream: scanStreamMock });

    findUniqueOrThrowMock = jest.fn();
    findManyMock = jest.fn();
    downloadObjectMock = jest.fn().mockResolvedValue(Buffer.from('conteudo'));
    promoteToImmutableMock = jest.fn().mockResolvedValue(undefined);
    getImmutableBucketNameMock = jest.fn().mockReturnValue('formops-imutavel');
    txUpdateMock = jest.fn().mockResolvedValue({ id: 'evidence-1' });
    runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) => fn({ evidenceFile: { update: txUpdateMock } }));
    getSettingsMock = jest.fn().mockResolvedValue({ forensicHoldYears: 1 });

    const prisma = {
      evidenceFile: { findUniqueOrThrow: findUniqueOrThrowMock, findMany: findManyMock },
    } as unknown as PrismaService;
    const s3Service = {
      downloadObject: downloadObjectMock,
      promoteToImmutable: promoteToImmutableMock,
      getImmutableBucketName: getImmutableBucketNameMock,
    } as unknown as S3Service;
    const auditContextService = { runWithAuditContext: runWithAuditContextMock } as unknown as AuditContextService;
    const platformSettingsService = { getSettings: getSettingsMock } as unknown as PlatformSettingsService;

    service = new AntivirusService(buildConfigService(), prisma, s3Service, auditContextService, platformSettingsService);
  });

  describe('scanEvidenceFile', () => {
    test('does nothing when the evidence is not PENDENTE (already scanned)', async () => {
      findUniqueOrThrowMock.mockResolvedValue({ id: 'evidence-1', scanStatus: EvidenceScanStatus.LIBERADO });

      await service.scanEvidenceFile('evidence-1');

      expect(downloadObjectMock).not.toHaveBeenCalled();
    });

    // T050 (FR-037): veredito limpo promove ao bucket imutavel e so entao
    // o registro vira LIBERADO — nunca o contrario.
    test('promotes to the immutable bucket and marks LIBERADO when the file is clean', async () => {
      findUniqueOrThrowMock.mockResolvedValue({
        id: 'evidence-1',
        scanStatus: EvidenceScanStatus.PENDENTE,
        bucket: 'formops-quarentena',
        fileKey: 'some-key.pdf',
        retainUntil: new Date('2036-01-01T00:00:00Z'),
      });
      scanStreamMock.mockResolvedValue({ isInfected: false, viruses: [] });

      await service.scanEvidenceFile('evidence-1');

      expect(promoteToImmutableMock).toHaveBeenCalledWith('some-key.pdf', new Date('2036-01-01T00:00:00Z'));
      expect(txUpdateMock).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: expect.objectContaining({
          scanStatus: EvidenceScanStatus.LIBERADO,
          bucket: 'formops-imutavel',
        }),
      });
    });

    // FR-039/FR-039a: deteccao positiva bloqueia, nunca promove, e recebe
    // guarda pericial de SystemSetting.forensicHoldYears.
    test('marks BLOQUEADO with a forensic hold and never promotes when infected', async () => {
      findUniqueOrThrowMock.mockResolvedValue({
        id: 'evidence-1',
        scanStatus: EvidenceScanStatus.PENDENTE,
        bucket: 'formops-quarentena',
        fileKey: 'some-key.pdf',
        retainUntil: null,
      });
      scanStreamMock.mockResolvedValue({ isInfected: true, viruses: ['Eicar-Test-Signature'] });

      await service.scanEvidenceFile('evidence-1');

      expect(promoteToImmutableMock).not.toHaveBeenCalled();
      const [call] = txUpdateMock.mock.calls;
      expect(call[0].data.scanStatus).toBe(EvidenceScanStatus.BLOQUEADO);
      expect(call[0].data.forensicHoldUntil.getUTCFullYear()).toBe(new Date().getUTCFullYear() + 1);
    });
  });

  describe('scanAllPending', () => {
    test('processes every PENDENTE evidence and tolerates a failure on one without stopping the rest', async () => {
      findManyMock.mockResolvedValue([{ id: 'evidence-1' }, { id: 'evidence-2' }]);
      findUniqueOrThrowMock
        .mockRejectedValueOnce(new Error('falha ao ler evidence-1'))
        .mockResolvedValueOnce({ id: 'evidence-2', scanStatus: EvidenceScanStatus.LIBERADO });

      const processed = await service.scanAllPending();

      expect(processed).toBe(2);
      expect(findUniqueOrThrowMock).toHaveBeenCalledTimes(2);
    });
  });
});
