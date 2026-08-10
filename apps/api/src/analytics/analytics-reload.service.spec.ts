import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsReloadService } from './analytics-reload.service';
import { EvidenceResolverService } from './evidence-resolver.service';

describe('AnalyticsReloadService', () => {
  function buildService(evidenceFiles: Array<{ id: string }>) {
    const prisma = {
      evidenceFile: { findMany: jest.fn().mockResolvedValue(evidenceFiles) },
    } as unknown as PrismaService;
    const evidenceResolverService = {
      issueToken: jest.fn().mockResolvedValue({ token: 't', expiresAt: new Date() }),
    } as unknown as EvidenceResolverService;
    return { service: new AnalyticsReloadService(prisma, evidenceResolverService), prisma, evidenceResolverService };
  }

  it('emite um token novo para cada arquivo elegivel sem token vigente', async () => {
    const { service, evidenceResolverService } = buildService([{ id: 'ev-1' }, { id: 'ev-2' }]);

    const result = await service.reload();

    expect(evidenceResolverService.issueToken).toHaveBeenCalledWith('ev-1');
    expect(evidenceResolverService.issueToken).toHaveBeenCalledWith('ev-2');
    expect(result.tokensIssued).toBe(2);
    expect(result.loadedAt).toBeInstanceOf(Date);
  });

  it('nao emite token algum quando nenhum arquivo esta elegivel', async () => {
    const { service, evidenceResolverService } = buildService([]);

    const result = await service.reload();

    expect(evidenceResolverService.issueToken).not.toHaveBeenCalled();
    expect(result.tokensIssued).toBe(0);
  });

  it('restringe a busca a arquivo ativo, liberado, de relatorio concluido, sem token vigente', async () => {
    const { service, prisma } = buildService([]);

    await service.reload();

    expect(prisma.evidenceFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          scanStatus: 'LIBERADO',
          indicatorResponse: { reportInstance: { status: 'CONCLUIDO' } },
          accessTokens: { none: expect.objectContaining({ consumedAt: null }) },
        }),
      }),
    );
  });
});
