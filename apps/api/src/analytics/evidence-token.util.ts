import { createHmac } from 'crypto';
import { timingSafeDigestEqual } from '../verification/verification.util';

// FR-119/FR-120: token HMAC-SHA256, de uso unico e vida curta, que dispensa
// conta na plataforma. Assinatura pura em Node — o segredo
// (EVIDENCE_RESOLVER_HMAC_SECRET) nunca entra no banco nem na view
// analytics.v_evidence_link (ver migration 20260810095000). O uso unico e
// verificado a parte, em evidence-resolver.service.ts, contra a tabela
// evidence_access_tokens — este util so cobre assinatura/expiracao.
export interface EvidenceTokenPayload {
  evidenceFileId: string;
  expiresAt: number;
}

export function signEvidenceToken(payload: EvidenceTokenPayload, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

// Retorna null tanto para token malformado quanto para assinatura invalida —
// caminho unico para "token invalido", que o resolver trata do mesmo jeito
// que expirado/consumido (contracts/analytics-layer.md: resposta
// indistinguivel).
export function verifyEvidenceToken(token: string, secret: string): EvidenceTokenPayload | null {
  const separatorIndex = token.indexOf('.');
  if (separatorIndex < 0) {
    return null;
  }
  const payloadB64 = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  if (!timingSafeDigestEqual(signature, expectedSignature)) {
    return null;
  }
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof (decoded as EvidenceTokenPayload).evidenceFileId !== 'string' ||
      typeof (decoded as EvidenceTokenPayload).expiresAt !== 'number'
    ) {
      return null;
    }
    return decoded as EvidenceTokenPayload;
  } catch {
    return null;
  }
}
