import {
  absenceValue,
  canonicalSerialize,
  computeContentDigest,
  formatCanonicalDate,
  formatCanonicalDecimal,
  formatCanonicalInstant,
  sortKeysDeep,
} from './canonical-serialization';

// contracts/canonical-serialization.md — as nove regras do contrato seal-v1.
describe('canonical-serialization (seal-v1)', () => {
  // Regra 1/2: JSON compacto, chaves em ordem lexicografica, nunca a ordem
  // de insercao do objeto.
  it('reorders keys lexicographically regardless of insertion order, with no superfluous whitespace', () => {
    const inOrder = { b: 1, a: 2, c: { z: 3, y: 4 } };
    const reversed = { c: { y: 4, z: 3 }, a: 2, b: 1 };

    const serializedA = canonicalSerialize(inOrder);
    const serializedB = canonicalSerialize(reversed);

    expect(serializedA).toBe(serializedB);
    expect(serializedA).toBe('{"a":2,"b":1,"c":{"y":4,"z":3}}');
    expect(serializedA).not.toMatch(/[\s]/);
  });

  // Regra 8: arrays preservam a ordem do produtor — nunca sao reordenados.
  it('never reorders array elements, only object keys', () => {
    const value = { list: [3, 1, 2] };

    expect(canonicalSerialize(value)).toBe('{"list":[3,1,2]}');
  });

  // Teste obrigatorio do contrato: regressao de byte unico.
  it('produces a different digest for any single-byte change in the canonical content', () => {
    const base = { indicatorCode: 'IND-01', value: formatCanonicalDecimal('42.0000', 4) };
    const changed = { indicatorCode: 'IND-01', value: formatCanonicalDecimal('42.0001', 4) };

    expect(computeContentDigest(base)).not.toBe(computeContentDigest(changed));
  });

  // Teste obrigatorio do contrato: mesmo recorte, ordem de insercao
  // invertida, mesmo digest.
  it('produces the same digest for the same data regardless of key insertion order', () => {
    const a = { alpha: 1, beta: { gamma: 2, delta: 3 } };
    const b = { beta: { delta: 3, gamma: 2 }, alpha: 1 };

    expect(computeContentDigest(a)).toBe(computeContentDigest(b));
  });

  // Teste obrigatorio do contrato: 0 medido e NAO_PREENCHIDO nunca colapsam.
  it('never collapses a measured zero with an absence object into the same digest', () => {
    const measuredZero = { cell: formatCanonicalDecimal('0', 4) };
    const notFilled = { cell: absenceValue('NAO_PREENCHIDO') };

    expect(computeContentDigest(measuredZero)).not.toBe(computeContentDigest(notFilled));
  });

  // Regra 3: escala fixa e declarada, sem expoente.
  it('formats decimals with the declared fixed scale, never scientific notation', () => {
    expect(formatCanonicalDecimal('2', 4)).toBe('2.0000');
    expect(formatCanonicalDecimal(2, 4)).toBe('2.0000');
    expect(formatCanonicalDecimal('-3.5', 2)).toBe('-3.50');
    expect(formatCanonicalDecimal('0', 2)).toBe('0.00');
    // -0 nunca carrega sinal negativo espurio.
    expect(formatCanonicalDecimal('-0.00001', 4)).toBe('0.0000');
  });

  it('rounds half-up at the declared scale boundary without floating-point drift', () => {
    expect(formatCanonicalDecimal('1.23455', 4)).toBe('1.2346');
    expect(formatCanonicalDecimal('9.99995', 4)).toBe('10.0000');
  });

  // Regra 4: ISO-8601 UTC com Z e precisao de milissegundos.
  it('formats instants and pure dates per the contract', () => {
    const date = new Date('2026-08-07T13:45:12.000Z');
    expect(formatCanonicalInstant(date)).toBe('2026-08-07T13:45:12.000Z');
    expect(formatCanonicalDate(date)).toBe('2026-08-07');
  });

  // Regra 5: chave presente com null nunca e omitida; undefined e falha
  // dura, nao serializacao silenciosa que desviaria do que o Principio III
  // protege (distincao entre "nao preenchido" e "campo ausente").
  it('throws instead of silently dropping a field that resolved to undefined', () => {
    expect(() => sortKeysDeep({ a: 1, b: undefined })).toThrow(/ausente/);
  });

  it('keeps an explicit null key present in the serialized output', () => {
    expect(canonicalSerialize({ a: null })).toBe('{"a":null}');
  });

  // Recorte vazio produz envelope selavel (FR-097) — nenhuma excecao so
  // por nao haver linhas.
  it('serializes an empty payload without throwing, so an empty result can still be sealed', () => {
    expect(() => canonicalSerialize({ payload: { rows: [] }, scope: { isEmptyResult: true } })).not.toThrow();
  });

  // Regra 9: booleanos literais, nunca 1/0.
  it('serializes booleans as literals, never as 1/0', () => {
    expect(canonicalSerialize({ flag: true })).toBe('{"flag":true}');
  });
});
