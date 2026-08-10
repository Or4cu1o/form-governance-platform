import { normalizeLatency, timingSafeDigestEqual } from './verification.util';

describe('verification.util', () => {
  describe('timingSafeDigestEqual', () => {
    it('returns true for identical digests', () => {
      expect(timingSafeDigestEqual('abc123', 'abc123')).toBe(true);
    });

    it('returns false for a single differing character', () => {
      expect(timingSafeDigestEqual('abc123', 'abc124')).toBe(false);
    });

    it('returns false for digests of different length without throwing', () => {
      expect(timingSafeDigestEqual('short', 'a-much-longer-digest-string')).toBe(false);
    });
  });

  // T123/FR-105: toda resposta desta area espera ate o mesmo piso de
  // latencia — um caminho que terminou quase instantaneamente (rejeicao
  // de formato) e normalizado para o mesmo patamar de um que consultou o
  // banco.
  describe('normalizeLatency', () => {
    it('pads a fast path up to the minimum response floor', async () => {
      const startedAt = process.hrtime.bigint();

      await normalizeLatency(startedAt);

      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      expect(elapsedMs).toBeGreaterThanOrEqual(140);
    });

    it('adds no extra delay when the elapsed time already exceeds the floor', async () => {
      const startedAt = process.hrtime.bigint() - BigInt(300_000_000);

      const before = process.hrtime.bigint();
      await normalizeLatency(startedAt);
      const extraMs = Number(process.hrtime.bigint() - before) / 1_000_000;

      expect(extraMs).toBeLessThan(50);
    });
  });
});
