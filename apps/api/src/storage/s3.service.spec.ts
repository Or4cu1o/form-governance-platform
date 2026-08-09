import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Service } from './s3.service';

const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://minio.local/signed-url'),
}));

describe('S3Service', () => {
  let service: S3Service;

  function buildConfigService(): ConfigService {
    const values: Record<string, string> = {
      S3_BUCKET_QUARANTINE: 'formops-quarentena',
      S3_BUCKET_IMMUTABLE: 'formops-imutavel',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
    };
    return {
      getOrThrow: jest.fn((key: string) => values[key]),
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
  }

  beforeEach(() => {
    sendMock.mockReset();
    jest.mocked(getSignedUrl).mockClear();
    service = new S3Service(buildConfigService());
  });

  describe('onModuleInit', () => {
    test('checks both buckets without creating anything when both HeadBucketCommand calls succeed', async () => {
      sendMock.mockResolvedValue({});

      await service.onModuleInit();

      expect(sendMock).toHaveBeenCalledTimes(2);
    });

    test('does not attempt to create a missing bucket — only logs, since Object Lock cannot be enabled after creation', async () => {
      sendMock.mockRejectedValueOnce(new Error('NotFound')).mockResolvedValueOnce({});

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(sendMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('uploadToQuarantine', () => {
    test('uploads the buffer to the quarantine bucket under a randomized key and returns it', async () => {
      sendMock.mockResolvedValue({});

      const key = await service.uploadToQuarantine(Buffer.from('conteudo'), 'evidencia.pdf', 'application/pdf');

      expect(key).toMatch(/^[0-9a-f-]{36}-evidencia\.pdf$/);
      expect(sendMock).toHaveBeenCalledTimes(1);
      const [command] = sendMock.mock.calls[0];
      expect(command.input).toMatchObject({ Bucket: 'formops-quarentena' });
    });
  });

  describe('downloadObject', () => {
    test('reads the object body back into a Buffer', async () => {
      sendMock.mockResolvedValue({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } });

      const buffer = await service.downloadObject('formops-quarentena', 'some-key.pdf');

      expect(buffer).toEqual(Buffer.from([1, 2, 3]));
    });
  });

  describe('promoteToImmutable', () => {
    test('copies from quarantine to the immutable bucket with Object Lock retention and deletes the quarantine copy', async () => {
      sendMock.mockResolvedValue({});
      const retainUntil = new Date('2036-01-01T00:00:00Z');

      await service.promoteToImmutable('some-key.pdf', retainUntil);

      expect(sendMock).toHaveBeenCalledTimes(2);
      const [copyCommand] = sendMock.mock.calls[0];
      expect(copyCommand.input).toMatchObject({
        Bucket: 'formops-imutavel',
        CopySource: '/formops-quarentena/some-key.pdf',
        Key: 'some-key.pdf',
        ObjectLockMode: 'COMPLIANCE',
        ObjectLockRetainUntilDate: retainUntil,
      });
      const [deleteCommand] = sendMock.mock.calls[1];
      expect(deleteCommand.input).toMatchObject({ Bucket: 'formops-quarentena', Key: 'some-key.pdf' });
    });

    test('promotes without an Object Lock retention date when retainUntil is null (retentionMode INDEFINIDA)', async () => {
      sendMock.mockResolvedValue({});

      await service.promoteToImmutable('some-key.pdf', null);

      const [copyCommand] = sendMock.mock.calls[0];
      expect(copyCommand.input).not.toHaveProperty('ObjectLockMode');
      expect(copyCommand.input).not.toHaveProperty('ObjectLockRetainUntilDate');
    });
  });

  describe('getPresignedDownloadUrl', () => {
    test('returns a time-limited presigned URL for the given bucket and key', async () => {
      const url = await service.getPresignedDownloadUrl('formops-imutavel', 'evidences/some-key.pdf');

      expect(url).toBe('https://minio.local/signed-url');
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 300 });
    });
  });
});
