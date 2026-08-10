import { createHash, timingSafeEqual } from 'crypto';

// FR-105: comparacao em tempo constante — hashear ambos os lados para o
// mesmo tamanho fixo antes de comparar evita que o proprio comprimento da
// string de entrada vaze informacao por atalho de curto-circuito.
export function timingSafeDigestEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

// FR-105: codigo inexistente e codigo malformado devem ser indistinguiveis
// tambem na distribuicao de latencia — todo caminho de resposta (rejeicao
// de formato antes de tocar o banco, selo nao encontrado, selo encontrado)
// espera ate este piso antes de responder.
const MIN_RESPONSE_MS = 150;

export async function normalizeLatency(startedAtNs: bigint): Promise<void> {
  const elapsedMs = Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
  const remaining = MIN_RESPONSE_MS - elapsedMs;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
