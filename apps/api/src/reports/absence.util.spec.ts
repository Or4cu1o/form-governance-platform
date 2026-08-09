import { classifyIndicatorCell, IndicatorCellState, isAbsentState } from './absence.util';

describe('classifyIndicatorCell', () => {
  test('classifies a non-null calculatedValue as VALOR_APURADO', () => {
    const state = classifyIndicatorCell({
      responseExists: true,
      indicatorActiveAtPeriod: true,
      calculatedValue: 87.5,
    });

    expect(state).toBe(IndicatorCellState.VALOR_APURADO);
  });

  test('distinguishes a measured 0 (ZERO_MEDIDO) from every other absence representation', () => {
    const state = classifyIndicatorCell({
      responseExists: true,
      indicatorActiveAtPeriod: true,
      calculatedValue: 0,
    });

    expect(state).toBe(IndicatorCellState.ZERO_MEDIDO);
    expect(state).not.toBe(IndicatorCellState.NAO_PREENCHIDO);
  });

  test('classifies as NAO_APLICAVEL_FORA_DO_NIVEL when no IndicatorResponse exists for the pair', () => {
    const state = classifyIndicatorCell({
      responseExists: false,
      indicatorActiveAtPeriod: true,
      calculatedValue: null,
    });

    expect(state).toBe(IndicatorCellState.NAO_APLICAVEL_FORA_DO_NIVEL);
  });

  test('classifies as NAO_APLICAVEL_INDICADOR_INATIVO when the response exists but the indicator was inactive at the period (by snapshot)', () => {
    const state = classifyIndicatorCell({
      responseExists: true,
      indicatorActiveAtPeriod: false,
      calculatedValue: null,
    });

    expect(state).toBe(IndicatorCellState.NAO_APLICAVEL_INDICADOR_INATIVO);
  });

  test('classifies as NAO_PREENCHIDO when the response exists, the indicator was active, but calculatedValue is still null', () => {
    const state = classifyIndicatorCell({
      responseExists: true,
      indicatorActiveAtPeriod: true,
      calculatedValue: null,
    });

    expect(state).toBe(IndicatorCellState.NAO_PREENCHIDO);
  });

  test('never collapses one representation into another: all five states are pairwise distinct', () => {
    const states = new Set([
      classifyIndicatorCell({ responseExists: true, indicatorActiveAtPeriod: true, calculatedValue: 10 }),
      classifyIndicatorCell({ responseExists: true, indicatorActiveAtPeriod: true, calculatedValue: 0 }),
      classifyIndicatorCell({ responseExists: false, indicatorActiveAtPeriod: true, calculatedValue: null }),
      classifyIndicatorCell({ responseExists: true, indicatorActiveAtPeriod: false, calculatedValue: null }),
      classifyIndicatorCell({ responseExists: true, indicatorActiveAtPeriod: true, calculatedValue: null }),
    ]);

    expect(states.size).toBe(5);
  });
});

describe('isAbsentState', () => {
  test('flags every non-VALOR_APURADO/ZERO_MEDIDO state as absent — never eligible for a denominator (FR-086)', () => {
    expect(isAbsentState(IndicatorCellState.NAO_APLICAVEL_FORA_DO_NIVEL)).toBe(true);
    expect(isAbsentState(IndicatorCellState.NAO_APLICAVEL_INDICADOR_INATIVO)).toBe(true);
    expect(isAbsentState(IndicatorCellState.NAO_PREENCHIDO)).toBe(true);
  });

  test('does not flag a measured value — including a measured 0 — as absent', () => {
    expect(isAbsentState(IndicatorCellState.VALOR_APURADO)).toBe(false);
    expect(isAbsentState(IndicatorCellState.ZERO_MEDIDO)).toBe(false);
  });
});
