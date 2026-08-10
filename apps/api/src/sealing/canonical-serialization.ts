import { createHash } from 'crypto';

// Implementa contracts/canonical-serialization.md (seal-v1) — a UNICA forma
// admitida de reduzir um recorte a bytes antes de calcular o contentDigest.
// Independente de qualquer DTO de apresentacao (Principio VI): mudanca
// cosmetica de tela nao pode invalidar selo ja emitido.
export const SEAL_CONTRACT_VERSION = 'seal-v1';

export type AbsenceKind = 'NAO_PREENCHIDO' | 'NA_FORA_DO_NIVEL' | 'NA_INATIVO_NO_PERIODO';

export interface CanonicalAbsence {
  kind: AbsenceKind;
  value: null;
}

// Regra 6: ausencia e objeto explicito — um 0 medido e SEMPRE o numero
// "0.0000" (formatCanonicalDecimal), jamais este objeto. Os dois nunca
// podem colapsar no mesmo digest.
export function absenceValue(kind: AbsenceKind): CanonicalAbsence {
  return { kind, value: null };
}

// Arredondamento decimal-exato (metade para cima) quando a fonte carrega
// mais casas que a escala declarada — evita o erro de ponto flutuante de
// Number(...).toFixed() em valores de alta precisao.
function roundFractionAtScale(
  integerPart: string,
  fractionPart: string,
  scale: number,
): { integerCarry: string; fraction: string } {
  const kept = fractionPart.slice(0, scale);
  const nextDigit = fractionPart.charCodeAt(scale) - 48;
  if (nextDigit < 5) {
    return { integerCarry: integerPart, fraction: kept.padEnd(scale, '0') };
  }
  const digits = (integerPart + kept).split('').map(Number);
  let i = digits.length - 1;
  let carry = 1;
  while (i >= 0 && carry > 0) {
    digits[i] += carry;
    carry = digits[i] >= 10 ? 1 : 0;
    if (carry) digits[i] -= 10;
    i -= 1;
  }
  const combined = (carry ? '1' : '') + digits.join('');
  const fraction = scale === 0 ? '' : combined.slice(combined.length - scale);
  const integerCarry = scale === 0 ? combined : combined.slice(0, combined.length - scale) || '0';
  return { integerCarry, fraction };
}

// Regra 3: decimais em notacao posicional sem expoente, escala fixa e
// declarada por campo (ver tabela do contrato). Opera sobre a string exata
// do valor (Prisma Decimal/numero/string) para nao introduzir erro de
// ponto flutuante que a base de dados nunca teve.
export function formatCanonicalDecimal(value: { toString(): string } | number | string, scale: number): string {
  const raw = value.toString().trim();
  if (raw === '' || Number.isNaN(Number(raw))) {
    throw new Error(`Valor decimal invalido para serializacao canonica: "${raw}"`);
  }
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [integerPart, fractionPart = ''] = unsigned.split('.');

  let finalInteger: string;
  let finalFraction: string;
  if (fractionPart.length <= scale) {
    finalInteger = integerPart;
    finalFraction = fractionPart.padEnd(scale, '0');
  } else {
    const rounded = roundFractionAtScale(integerPart, fractionPart, scale);
    finalInteger = rounded.integerCarry;
    finalFraction = rounded.fraction;
  }

  const isZero = /^0*$/.test(finalInteger) && /^0*$/.test(finalFraction);
  const sign = negative && !isZero ? '-' : '';
  return scale === 0 ? `${sign}${finalInteger}` : `${sign}${finalInteger}.${finalFraction}`;
}

// Regra 4: instante em ISO-8601 UTC, precisao de milissegundos, sufixo Z —
// Date.prototype.toISOString() ja produz exatamente esse formato.
export function formatCanonicalInstant(date: Date): string {
  return date.toISOString();
}

// Regra 4: data pura (periodo de referencia) em "YYYY-MM-DD".
export function formatCanonicalDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Regra 2: ordem lexicografica por code point, recursivamente, em todos os
// niveis — nunca a ordem de insercao. Arrays preservam a ordem do produtor
// (regra 8): nao sao reordenados. Regra 5: undefined nunca e admitido —
// omitir uma chave e proibido, entao um valor ausente-por-acidente e falha
// dura, nao serializacao silenciosa.
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const sorted: Record<string, unknown> = {};
    for (const key of entries) {
      const fieldValue = (value as Record<string, unknown>)[key];
      if (fieldValue === undefined) {
        throw new Error(`Campo "${key}" esta ausente (undefined) — regra 5 exige chave presente com null, nunca omissao`);
      }
      sorted[key] = sortKeysDeep(fieldValue);
    }
    return sorted;
  }
  return value;
}

// Regra 1: JSON UTF-8 sem BOM, sem espaco superfluo — JSON.stringify sem
// argumento de indentacao ja produz o formato compacto exigido.
export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

export function computeContentDigest(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex');
}

export function computeArtifactDigest(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export interface CanonicalEnvelope {
  contract: typeof SEAL_CONTRACT_VERSION;
  issuedAt: string;
  kind: 'RELATORIO' | 'CONSULTA_AUDITORIA';
  payload: unknown;
  scope: {
    filters: unknown;
    requesterScopeUnitIds: string[];
    isEmptyResult: boolean;
    isPartial: boolean;
  };
}

export function buildCanonicalEnvelope(input: {
  issuedAt: Date;
  kind: CanonicalEnvelope['kind'];
  payload: unknown;
  filters: unknown;
  requesterScopeUnitIds: string[];
  isEmptyResult: boolean;
  isPartial: boolean;
}): CanonicalEnvelope {
  return {
    contract: SEAL_CONTRACT_VERSION,
    issuedAt: formatCanonicalInstant(input.issuedAt),
    kind: input.kind,
    payload: input.payload,
    scope: {
      filters: input.filters,
      requesterScopeUnitIds: input.requesterScopeUnitIds,
      isEmptyResult: input.isEmptyResult,
      isPartial: input.isPartial,
    },
  };
}
