import { Injectable } from '@nestjs/common';
import { ExportArtifactFormat, ExportArtifactKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SealService } from '../sealing/seal.service';
import { SignatureService } from '../sealing/signature.service';
import { isValidVerificationCodeFormat } from '../sealing/verification-code.util';
import { timingSafeDigestEqual } from './verification.util';

export type VerificationVerdict =
  | 'INTEGRO'
  | 'CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO'
  | 'CONTEUDO_DIVERGENTE'
  | 'REVOGADO'
  | 'NAO_ENCONTRADO';

export interface VerificationEnvelope {
  verdict: VerificationVerdict;
  issuedAt: string | null;
  unitAcronym: string | null;
  referencePeriod: string | null;
  reportStatus: string | null;
  approver: { name: string | null; jobTitle: string | null };
  artifactKind: ExportArtifactKind | null;
  artifactFormat: ExportArtifactFormat | null;
  contentDigest: string | null;
  artifactDigest: string | null;
  signature: string | null;
  keyId: string | null;
  sealContractVersion: string | null;
  revocation: { reason: string; revokedAt: string } | null;
}

const NOT_FOUND_ENVELOPE: VerificationEnvelope = {
  verdict: 'NAO_ENCONTRADO',
  issuedAt: null,
  unitAcronym: null,
  referencePeriod: null,
  reportStatus: null,
  approver: { name: null, jobTitle: null },
  artifactKind: null,
  artifactFormat: null,
  contentDigest: null,
  artifactDigest: null,
  signature: null,
  keyId: null,
  sealContractVersion: null,
  revocation: null,
};

interface Provenance {
  unitAcronym: string | null;
  referencePeriod: string | null;
  reportStatus: string | null;
  approver: { name: string | null; jobTitle: string | null };
}

const EMPTY_PROVENANCE: Provenance = { unitAcronym: null, referencePeriod: null, reportStatus: null, approver: { name: null, jobTitle: null } };

// contracts/public-verification.md — superficie SEM autenticacao (FR-102).
// FR-102: NUNCA expor valor de indicador, analise critica, plano de acao,
// evidencia, ou nome de usuario que nao seja o do aprovador responsavel —
// esta classe so le o necessario para popular o envelope do contrato,
// nunca IndicatorResponse.calculatedValue/criticalAnalysis/actionPlan.
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sealService: SealService,
    private readonly signatureService: SignatureService,
  ) {}

  async resolve(codigo: string, artifactDigest?: string): Promise<VerificationEnvelope> {
    if (!isValidVerificationCodeFormat(codigo)) {
      return NOT_FOUND_ENVELOPE;
    }

    const seal = await this.sealService.findByVerificationCode(codigo);
    if (!seal) {
      return NOT_FOUND_ENVELOPE;
    }

    const provenance = await this.resolveProvenance(seal.artifactKind, seal.scopeDescriptor);

    if (seal.revocation) {
      return this.buildEnvelope(seal, provenance, 'REVOGADO', {
        reason: seal.revocation.reason,
        revokedAt: seal.revocation.revokedAt.toISOString(),
      });
    }

    // Assinatura sempre confere na pratica (o dado nunca sofre UPDATE apos
    // emitido) — checado mesmo assim, defesa em profundidade contra
    // corrupcao de dado que a aplicacao nunca deveria produzir sozinha.
    const signatureValid = this.signatureService.verify(seal.contentDigest, seal.signature, seal.keyId);
    if (!signatureValid) {
      return this.buildEnvelope(seal, provenance, 'CONTEUDO_DIVERGENTE', null);
    }

    if (artifactDigest === undefined) {
      return this.buildEnvelope(seal, provenance, 'INTEGRO', null);
    }

    const matches = timingSafeDigestEqual(artifactDigest, seal.artifactDigest);
    return this.buildEnvelope(seal, provenance, matches ? 'INTEGRO' : 'CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO', null);
  }

  private async resolveProvenance(artifactKind: ExportArtifactKind, scopeDescriptor: unknown): Promise<Provenance> {
    if (artifactKind !== ExportArtifactKind.RELATORIO) {
      return EMPTY_PROVENANCE;
    }
    const reportInstanceId = (scopeDescriptor as { reportInstanceId?: string } | null)?.reportInstanceId;
    if (!reportInstanceId) {
      return EMPTY_PROVENANCE;
    }
    const report = await this.prisma.reportInstance.findUnique({
      where: { id: reportInstanceId },
      include: {
        unit: true,
        indicatorResponses: {
          include: { validationRecords: { orderBy: { createdAt: 'desc' }, include: { aprovadorUser: true } } },
        },
      },
    });
    if (!report) {
      return EMPTY_PROVENANCE;
    }
    const mostRecent = report.indicatorResponses
      .flatMap((ir) => ir.validationRecords)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return {
      unitAcronym: report.unit.sigla,
      referencePeriod: report.referenceMonth.toISOString().slice(0, 7),
      reportStatus: report.status,
      approver: mostRecent
        ? { name: `${mostRecent.aprovadorUser.nome} ${mostRecent.aprovadorUser.sobrenome}`, jobTitle: mostRecent.aprovadorUser.jobTitle ?? null }
        : { name: null, jobTitle: null },
    };
  }

  private buildEnvelope(
    seal: { issuedAt: Date; artifactKind: ExportArtifactKind; artifactFormat: ExportArtifactFormat; contentDigest: string; artifactDigest: string; signature: string; keyId: string; sealContractVersion: string },
    provenance: Provenance,
    verdict: VerificationVerdict,
    revocation: { reason: string; revokedAt: string } | null,
  ): VerificationEnvelope {
    return {
      verdict,
      issuedAt: seal.issuedAt.toISOString(),
      unitAcronym: provenance.unitAcronym,
      referencePeriod: provenance.referencePeriod,
      reportStatus: provenance.reportStatus,
      approver: provenance.approver,
      artifactKind: seal.artifactKind,
      artifactFormat: seal.artifactFormat,
      contentDigest: seal.contentDigest,
      artifactDigest: seal.artifactDigest,
      signature: seal.signature,
      keyId: seal.keyId,
      sealContractVersion: seal.sealContractVersion,
      revocation,
    };
  }
}
