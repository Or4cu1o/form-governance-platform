import { ExportArtifactFormat, ExportArtifactKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SealService } from '../sealing/seal.service';
import { SignatureService } from '../sealing/signature.service';
import { generateVerificationCode } from '../sealing/verification-code.util';
import { VerificationService } from './verification.service';

// Codigo real (com check digit valido) — a validacao de formato roda
// ANTES de consultar o banco, entao um codigo forjado a mao reprovaria
// isValidVerificationCodeFormat() e todo teste cairia em NAO_ENCONTRADO.
const VALID_CODE = generateVerificationCode();

function buildSeal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'seal-1',
    verificationCode: VALID_CODE,
    sealContractVersion: 'seal-v1',
    contentDigest: 'content-digest-abc',
    artifactDigest: 'artifact-digest-abc',
    signature: 'sig-abc',
    keyId: 'seal-2026-01',
    artifactKind: ExportArtifactKind.RELATORIO,
    artifactFormat: ExportArtifactFormat.PDF,
    scopeDescriptor: { reportInstanceId: 'report-1', unitId: 'unit-1' },
    issuedByUserId: 'user-1',
    issuedAt: new Date('2026-08-07T13:45:12.000Z'),
    isEmptyResult: false,
    isPartial: false,
    revocation: null,
    ...overrides,
  };
}

describe('public verification (contracts/public-verification.md)', () => {
  let service: VerificationService;
  let findByVerificationCodeMock: jest.Mock;
  let verifySignatureMock: jest.Mock;
  let findUniqueReportMock: jest.Mock;

  beforeEach(() => {
    findByVerificationCodeMock = jest.fn();
    verifySignatureMock = jest.fn().mockReturnValue(true);
    findUniqueReportMock = jest.fn().mockResolvedValue(null);

    const prisma = { reportInstance: { findUnique: findUniqueReportMock } } as unknown as PrismaService;
    const sealService = { findByVerificationCode: findByVerificationCodeMock } as unknown as SealService;
    const signatureService = { verify: verifySignatureMock } as unknown as SignatureService;

    service = new VerificationService(prisma, sealService, signatureService);
  });

  // T122: um byte alterado no arquivo -> CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO, nunca INTEGRO.
  it('reports CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO when the artifact digest does not match, never INTEGRO', async () => {
    findByVerificationCodeMock.mockResolvedValue(buildSeal());

    const result = await service.resolve(VALID_CODE, 'a-completely-different-digest');

    expect(result.verdict).toBe('CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO');
    expect(result.verdict).not.toBe('INTEGRO');
  });

  it('reports INTEGRO when the artifact digest matches exactly', async () => {
    findByVerificationCodeMock.mockResolvedValue(buildSeal());

    const result = await service.resolve(VALID_CODE, 'artifact-digest-abc');

    expect(result.verdict).toBe('INTEGRO');
  });

  // T123 (metade de servico — malformado nunca chega ao banco): codigo
  // malformado produz o MESMO corpo (NAO_ENCONTRADO) que um inexistente,
  // sem consultar o SealService.
  it('returns the identical NAO_ENCONTRADO body for a malformed code, without ever querying the database', async () => {
    const malformed = await service.resolve('nao-e-um-codigo-valido');
    expect(malformed.verdict).toBe('NAO_ENCONTRADO');
    expect(findByVerificationCodeMock).not.toHaveBeenCalled();

    findByVerificationCodeMock.mockResolvedValue(null);
    const nonexistent = await service.resolve(VALID_CODE);
    expect(nonexistent.verdict).toBe('NAO_ENCONTRADO');
    expect(nonexistent).toEqual(malformed);
  });

  // T124/FR-102: nenhum valor de indicador, analise critica, plano de acao
  // ou evidencia aparece em qualquer resposta desta superficie — checado
  // pela propria forma do envelope, que nunca tem esses campos.
  it('never includes indicator values, critical analysis, action plans or evidence in the envelope shape', async () => {
    findByVerificationCodeMock.mockResolvedValue(buildSeal());
    findUniqueReportMock.mockResolvedValue({
      status: 'CONCLUIDO',
      unit: { sigla: 'TI' },
      referenceMonth: new Date('2026-06-01T00:00:00.000Z'),
      indicatorResponses: [
        {
          validationRecords: [
            {
              createdAt: new Date('2026-07-01T00:00:00.000Z'),
              aprovadorUser: { nome: 'Ana', sobrenome: 'Aprovadora', jobTitle: 'Chefe' },
            },
          ],
        },
      ],
    });

    const result = await service.resolve(VALID_CODE);

    const forbiddenKeys = ['calculatedValue', 'criticalAnalysis', 'actionPlan', 'evidence', 'evidenceFiles', 'variableValues'];
    const serialized = JSON.stringify(result);
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key);
    }
    // So o nome do aprovador responsavel — nenhum outro usuario aparece.
    expect(result.approver.name).toBe('Ana Aprovadora');
  });

  // T125/FR-101: selo revogado retorna motivo e data; o registro original
  // (contentDigest/artifactDigest/signature) permanece intacto e consultavel.
  it('returns the revocation reason and date while keeping the original seal fields intact', async () => {
    findByVerificationCodeMock.mockResolvedValue(
      buildSeal({ revocation: { reason: 'Emitido por engano', revokedAt: new Date('2026-08-08T00:00:00.000Z') } }),
    );

    const result = await service.resolve(VALID_CODE);

    expect(result.verdict).toBe('REVOGADO');
    expect(result.revocation).toEqual({ reason: 'Emitido por engano', revokedAt: '2026-08-08T00:00:00.000Z' });
    expect(result.contentDigest).toBe('content-digest-abc');
    expect(result.artifactDigest).toBe('artifact-digest-abc');
  });

  // T126/FR-104: selo emitido sob chave aposentada continua verificavel —
  // SignatureService.verify resolve a chave publica certa por keyId,
  // independente de a chave estar ativa ou aposentada.
  it('remains verifiable when the seal was issued under a now-retired key', async () => {
    findByVerificationCodeMock.mockResolvedValue(buildSeal({ keyId: 'seal-2025-06' }));

    const result = await service.resolve(VALID_CODE);

    expect(verifySignatureMock).toHaveBeenCalledWith('content-digest-abc', 'sig-abc', 'seal-2025-06');
    expect(result.verdict).toBe('INTEGRO');
    expect(result.keyId).toBe('seal-2025-06');
  });

  it('reports CONTEUDO_DIVERGENTE when the stored signature no longer verifies against the stored digest', async () => {
    verifySignatureMock.mockReturnValue(false);
    findByVerificationCodeMock.mockResolvedValue(buildSeal());

    const result = await service.resolve(VALID_CODE);

    expect(result.verdict).toBe('CONTEUDO_DIVERGENTE');
  });
});
