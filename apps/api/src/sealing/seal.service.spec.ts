import { ExportArtifactFormat, ExportArtifactKind } from '@prisma/client';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildCanonicalEnvelope } from './canonical-serialization';
import { SealService } from './seal.service';
import { SignatureService } from './signature.service';

describe('SealService', () => {
  let service: SealService;
  let createSealMock: jest.Mock;
  let createRevocationMock: jest.Mock;
  let findUniqueMock: jest.Mock;
  let runWithAuditContextMock: jest.Mock;
  let signMock: jest.Mock;

  const envelope = buildCanonicalEnvelope({
    issuedAt: new Date('2026-08-07T13:45:12.000Z'),
    kind: 'RELATORIO',
    payload: { indicadores: [] },
    filters: {},
    requesterScopeUnitIds: ['unit-1'],
    isEmptyResult: false,
    isPartial: false,
  });

  beforeEach(() => {
    createSealMock = jest.fn().mockResolvedValue({ id: 'seal-1' });
    createRevocationMock = jest.fn().mockResolvedValue({ id: 'revocation-1' });
    findUniqueMock = jest.fn();
    runWithAuditContextMock = jest.fn((fn: (tx: unknown) => unknown) =>
      fn({ exportSeal: { create: createSealMock }, exportSealRevocation: { create: createRevocationMock } }),
    );
    signMock = jest.fn().mockReturnValue({ signature: 'c2ln', keyId: 'seal-2026-01' });

    const prisma = { exportSeal: { findUnique: findUniqueMock } } as unknown as PrismaService;
    const signatureService = { signContentDigest: signMock } as unknown as SignatureService;
    const auditContextService = { runWithAuditContext: runWithAuditContextMock } as unknown as AuditContextService;

    service = new SealService(prisma, signatureService, auditContextService);
  });

  // FR-098: os tres formatos do mesmo recorte compartilham o mesmo
  // contentDigest e tem artifactDigest distinto.
  it('produces the same contentDigest for the same envelope across formats, and a different artifactDigest per artifact', async () => {
    const prepared = service.prepareSeal(envelope);
    const pdfResult = await service.persistSeal(prepared, {
      artifactBytes: Buffer.from('pdf-bytes'),
      artifactKind: ExportArtifactKind.RELATORIO,
      artifactFormat: ExportArtifactFormat.PDF,
      scopeDescriptor: {},
      issuedByUserId: 'user-1',
      isEmptyResult: false,
      isPartial: false,
    });
    const csvResult = await service.persistSeal(prepared, {
      artifactBytes: Buffer.from('csv-bytes'),
      artifactKind: ExportArtifactKind.RELATORIO,
      artifactFormat: ExportArtifactFormat.CSV,
      scopeDescriptor: {},
      issuedByUserId: 'user-1',
      isEmptyResult: false,
      isPartial: false,
    });

    expect(pdfResult.contentDigest).toBe(csvResult.contentDigest);
    expect(pdfResult.artifactDigest).not.toBe(csvResult.artifactDigest);
  });

  // Pipeline exigido pelo contrato: contentDigest/signature/keyId/
  // verificationCode existem ANTES de qualquer artefato ser renderizado —
  // e por isso podem ser estampados no rodape do PDF antes de calcular o
  // artifactDigest sobre os bytes finais (com o rodape ja embutido).
  it('prepares the content digest, signature and verification code before any artifact exists', () => {
    const prepared = service.prepareSeal(envelope);

    expect(prepared.contentDigest).toBeDefined();
    expect(prepared.signature).toBe('c2ln');
    expect(prepared.keyId).toBe('seal-2026-01');
    expect(prepared.verificationCode).toMatch(/^[0-9A-Z]{17}$/);
    expect(signMock).toHaveBeenCalledWith(prepared.contentDigest);
  });

  it('writes the seal through the audited transaction, never a bare prisma call', async () => {
    const prepared = service.prepareSeal(envelope);

    await service.persistSeal(prepared, {
      artifactBytes: 'bytes',
      artifactKind: ExportArtifactKind.CONSULTA_AUDITORIA,
      artifactFormat: ExportArtifactFormat.JSON,
      scopeDescriptor: {},
      issuedByUserId: 'user-1',
      isEmptyResult: true,
      isPartial: false,
    });

    expect(runWithAuditContextMock).toHaveBeenCalledTimes(1);
    expect(createSealMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isEmptyResult: true }) }),
    );
  });

  // FR-101: revogacao e registro ADICIONAL — nunca update do selo original.
  it('records revocation as an additional row, never mutating the original seal', async () => {
    await service.revokeSeal('seal-1', 'Solicitado pelo titular dos dados', 'admin-1');

    expect(createRevocationMock).toHaveBeenCalledWith({
      data: { sealId: 'seal-1', reason: 'Solicitado pelo titular dos dados', revokedByUserId: 'admin-1' },
    });
  });

  it('normalizes the verification code before looking up a seal', async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await service.findByVerificationCode('abcd-2345-efgh-6789-c');

    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { verificationCode: 'ABCD2345EFGH6789C' } }),
    );
  });
});
