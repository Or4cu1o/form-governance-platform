import { InheritanceState } from '@prisma/client';
import { InheritanceService } from './inheritance.service';

describe('InheritanceService', () => {
  const service = new InheritanceService();

  test('marks NAO_HERDADO with empty values when there is no previous response to inherit from', () => {
    const result = service.inheritValues(['CA', 'CB'], null);

    expect(result).toEqual({
      variableValues: {},
      inheritanceState: InheritanceState.NAO_HERDADO,
      unresolvedInheritedKeys: [],
    });
  });

  test('marks HERDADO when every declared key is found in the previous values', () => {
    const result = service.inheritValues(['CA', 'CB'], { CA: 10, CB: 20 });

    expect(result).toEqual({
      variableValues: { CA: 10, CB: 20 },
      inheritanceState: InheritanceState.HERDADO,
      unresolvedInheritedKeys: [],
    });
  });

  // Cenario US1-3 (quickstart V3): chave nova na definicao fica NAO_PREENCHIDO
  // (ausente de variableValues) e a resposta e marcada HERDADO_PARCIAL —
  // jamais recebe zero nem o valor de outra chave.
  test('marks HERDADO_PARCIAL and leaves an unmatched key absent, never zero or borrowed from another key', () => {
    const result = service.inheritValues(['CA', 'CB', 'CC_NOVA'], { CA: 10, CB: 20 });

    expect(result.inheritanceState).toBe(InheritanceState.HERDADO_PARCIAL);
    expect(result.variableValues).toEqual({ CA: 10, CB: 20 });
    expect(result.variableValues).not.toHaveProperty('CC_NOVA');
    expect(result.unresolvedInheritedKeys).toEqual(['CC_NOVA']);
  });

  test('marks HERDADO_PARCIAL with empty values when the previous response has none of the declared keys', () => {
    const result = service.inheritValues(['CA'], { OUTRA: 5 });

    expect(result).toEqual({
      variableValues: {},
      inheritanceState: InheritanceState.HERDADO_PARCIAL,
      unresolvedInheritedKeys: ['CA'],
    });
  });

  test('ignores keys removed from the current definition instead of carrying them over', () => {
    const result = service.inheritValues(['CA'], { CA: 10, CHAVE_REMOVIDA: 99 });

    expect(result.variableValues).toEqual({ CA: 10 });
    expect(result.variableValues).not.toHaveProperty('CHAVE_REMOVIDA');
  });

  test('marks HERDADO with no unresolved keys when the indicator declares no variables at all', () => {
    const result = service.inheritValues([], { CA: 10 });

    expect(result).toEqual({
      variableValues: {},
      inheritanceState: InheritanceState.HERDADO,
      unresolvedInheritedKeys: [],
    });
  });
});
