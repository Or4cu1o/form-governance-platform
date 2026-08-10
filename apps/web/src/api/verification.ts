import { apiGet, apiSend } from '../lib/api-client';

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
  artifactKind: 'RELATORIO' | 'CONSULTA_AUDITORIA' | null;
  artifactFormat: 'PDF' | 'CSV' | 'JSON' | null;
  contentDigest: string | null;
  artifactDigest: string | null;
  signature: string | null;
  keyId: string | null;
  sealContractVersion: string | null;
  revocation: { reason: string; revokedAt: string } | null;
}

// Rotas publicas (contracts/public-verification.md) — sem sessao, sem
// cookie de autenticacao; apiGet/apiSend ja funcionam sem token porque a
// API nao exige @Roles/JwtAuthGuard nestas rotas (@Public()).
export function getSeal(codigo: string): Promise<VerificationEnvelope> {
  return apiGet<VerificationEnvelope>(`/public/seals/${encodeURIComponent(codigo)}`);
}

export function verifyArtifact(codigo: string, artifactDigest: string): Promise<VerificationEnvelope> {
  return apiSend<VerificationEnvelope>('POST', `/public/seals/${encodeURIComponent(codigo)}/verify-artifact`, {
    artifactDigest,
  });
}
