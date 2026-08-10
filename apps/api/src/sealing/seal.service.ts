import { Injectable } from '@nestjs/common';
import { ExportArtifactFormat, ExportArtifactKind, Prisma } from '@prisma/client';
import { AuditContextService } from '../common/services/audit-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { CanonicalEnvelope, SEAL_CONTRACT_VERSION, computeArtifactDigest, computeContentDigest } from './canonical-serialization';
import { SignatureService } from './signature.service';
import { canonicalizeVerificationCode, generateVerificationCode } from './verification-code.util';

export interface PreparedSeal {
  contentDigest: string;
  signature: string;
  keyId: string;
  verificationCode: string;
}

export interface PersistSealInput {
  artifactBytes: Buffer | string;
  artifactKind: ExportArtifactKind;
  artifactFormat: ExportArtifactFormat;
  scopeDescriptor: Prisma.InputJsonValue;
  issuedByUserId: string;
  isEmptyResult: boolean;
  isPartial: boolean;
}

// FR-097/FR-098/FR-101: TODO artefato recebe selo (inclusive parcial e
// conjunto vazio); o mesmo contentDigest para os tres formatos do mesmo
// recorte (envelope nunca inclui artifactFormat); revogacao e registro
// ADICIONAL, o ExportSeal original nunca sofre UPDATE.
//
// Selagem em DUAS fases, nao uma chamada unica — pipeline exigido pelo
// contrato (verificacao offline, FR-104): contentDigest/signature/keyId/
// verificationCode sao conhecidos ANTES de renderizar o artefato final,
// porque o rodape do PDF (T134) precisa estampa-los em texto legivel; o
// artifactDigest so pode ser calculado DEPOIS, sobre os bytes finais (com
// o rodape ja embutido) — nunca precisa aparecer no proprio documento
// porque so serve para a checagem online de adulteracao do arquivo.
@Injectable()
export class SealService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signatureService: SignatureService,
    private readonly auditContextService: AuditContextService,
  ) {}

  prepareSeal(envelope: CanonicalEnvelope): PreparedSeal {
    const contentDigest = computeContentDigest(envelope);
    const { signature, keyId } = this.signatureService.signContentDigest(contentDigest);
    const verificationCode = canonicalizeVerificationCode(generateVerificationCode());
    return { contentDigest, signature, keyId, verificationCode };
  }

  async persistSeal(prepared: PreparedSeal, input: PersistSealInput) {
    const artifactDigest = computeArtifactDigest(input.artifactBytes);

    const seal = await this.auditContextService.runWithAuditContext((tx) =>
      tx.exportSeal.create({
        data: {
          verificationCode: prepared.verificationCode,
          sealContractVersion: SEAL_CONTRACT_VERSION,
          contentDigest: prepared.contentDigest,
          artifactDigest,
          signature: prepared.signature,
          keyId: prepared.keyId,
          artifactKind: input.artifactKind,
          artifactFormat: input.artifactFormat,
          scopeDescriptor: input.scopeDescriptor,
          issuedByUserId: input.issuedByUserId,
          isEmptyResult: input.isEmptyResult,
          isPartial: input.isPartial,
        },
      }),
    );

    return { seal, ...prepared, artifactDigest };
  }

  async revokeSeal(sealId: string, reason: string, revokedByUserId: string) {
    return this.auditContextService.runWithAuditContext((tx) =>
      tx.exportSealRevocation.create({
        data: { sealId, reason, revokedByUserId },
      }),
    );
  }

  async findByVerificationCode(code: string) {
    return this.prisma.exportSeal.findUnique({
      where: { verificationCode: canonicalizeVerificationCode(code) },
      include: {
        revocation: { include: { revokedByUser: true } },
        issuedByUser: { include: { primaryUnit: true } },
      },
    });
  }
}
