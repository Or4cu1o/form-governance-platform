import { ConfigService } from '@nestjs/config';
import { AccessLogService } from '../audit/access-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { EvidenceResolverService } from './evidence-resolver.service';
import { signEvidenceToken } from './evidence-token.util';

const SECRET = 'segredo-de-teste-nao-usar-em-producao';

interface MockAccessTokenRow {
  token: string;
  evidenceFile: { isActive: boolean; scanStatus: string; bucket: string; fileKey: string };
}

describe('EvidenceResolverService', () => {
  function buildService(overrides: { accessToken?: MockAccessTokenRow; updateManyCount?: number } = {}) {
    const prisma = {
      evidenceAccessToken: {
        create: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue({ count: overrides.updateManyCount ?? 1 }),
        findUnique: jest.fn().mockResolvedValue(
          overrides.accessToken ?? {
            token: 'irrelevante',
            evidenceFile: { isActive: true, scanStatus: 'LIBERADO', bucket: 'b', fileKey: 'k' },
          },
        ),
      },
    } as unknown as PrismaService;
    const s3Service = {
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.internal/presigned'),
    } as unknown as S3Service;
    const configService = { getOrThrow: jest.fn().mockReturnValue(SECRET) } as unknown as ConfigService;
    const accessLogService = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AccessLogService;
    const service = new EvidenceResolverService(prisma, s3Service, configService, accessLogService);
    return { service, prisma, s3Service, accessLogService };
  }

  const context = { sourceIp: '10.0.0.1', userAgent: 'tableau-desktop' };

  it('resolve com sucesso um token valido e nao consumido, devolvendo a URL assinada', async () => {
    const { service, prisma, s3Service } = buildService();
    const token = signEvidenceToken({ evidenceFileId: 'ev-1', expiresAt: Date.now() + 60_000 }, SECRET);

    const resolution = await service.resolve(token, context);

    expect(resolution).toEqual({ status: 'OK', redirectUrl: 'https://storage.internal/presigned' });
    expect(prisma.evidenceAccessToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ token, consumedAt: null }) }),
    );
    expect(s3Service.getPresignedDownloadUrl).toHaveBeenCalledWith('b', 'k');
  });

  // US8-6/T148: segunda utilizacao do mesmo token — o UPDATE atomico nao
  // encontra mais linha com consumed_at IS NULL (count: 0).
  it('apresenta EXPIRADO, nunca erro cru, na segunda utilizacao do mesmo token', async () => {
    const { service } = buildService({ updateManyCount: 0 });
    const token = signEvidenceToken({ evidenceFileId: 'ev-1', expiresAt: Date.now() + 60_000 }, SECRET);

    const resolution = await service.resolve(token, context);

    expect(resolution).toEqual({ status: 'EXPIRADO' });
  });

  it('apresenta EXPIRADO para token com prazo vencido, sem consultar o banco', async () => {
    const { service, prisma } = buildService();
    const token = signEvidenceToken({ evidenceFileId: 'ev-1', expiresAt: Date.now() - 1 }, SECRET);

    const resolution = await service.resolve(token, context);

    expect(resolution).toEqual({ status: 'EXPIRADO' });
    expect(prisma.evidenceAccessToken.updateMany).not.toHaveBeenCalled();
  });

  it('apresenta EXPIRADO para token invalido/malformado, indistinguivel dos demais casos', async () => {
    const { service } = buildService();

    const resolution = await service.resolve('token-invalido-sem-assinatura', context);

    expect(resolution).toEqual({ status: 'EXPIRADO' });
  });

  it('nunca inclui bucket/fileKey (o endereco real do armazenamento) na resposta de EXPIRADO', async () => {
    const { service } = buildService({ updateManyCount: 0 });
    const token = signEvidenceToken({ evidenceFileId: 'ev-1', expiresAt: Date.now() + 60_000 }, SECRET);

    const resolution = await service.resolve(token, context);

    expect(JSON.stringify(resolution)).not.toMatch(/bucket|fileKey|storage\.internal/i);
  });

  it('registra AccessLog para todo acesso — sucesso, expirado ou ja consumido', async () => {
    const { service, accessLogService } = buildService({ updateManyCount: 0 });
    const token = signEvidenceToken({ evidenceFileId: 'ev-1', expiresAt: Date.now() + 60_000 }, SECRET);

    await service.resolve(token, context);

    expect(accessLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'DOWNLOAD_EVIDENCIA', actorKind: 'ANONIMO_DECLARADO', sourceIp: '10.0.0.1' }),
    );
  });

  it('trata arquivo desativado ou bloqueado apos o token como EXPIRADO', async () => {
    const { service } = buildService({ accessToken: { token: 't', evidenceFile: { isActive: false, scanStatus: 'LIBERADO', bucket: 'b', fileKey: 'k' } } });
    const token = signEvidenceToken({ evidenceFileId: 'ev-1', expiresAt: Date.now() + 60_000 }, SECRET);

    const resolution = await service.resolve(token, context);

    expect(resolution).toEqual({ status: 'EXPIRADO' });
  });
});
