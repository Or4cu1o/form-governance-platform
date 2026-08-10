// Cenario US6-8/FR-087: sinalizacao estatistica e APENAS indicacao para
// inspecao humana — a regra e declarada na interface (audit-query.service
// devolve outlierRule na resposta) e nunca altera conformidade, nota ou
// estado de nenhum registro. Regra padrao: IQR (Tukey), unica implementada
// hoje — SystemSetting.outlierRule so aceita 'IQR' na pratica corrente.

function percentile(sortedValues: number[], p: number): number {
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sortedValues[lower];
  }
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

// Com menos de 4 pontos o IQR nao e um sinal confiavel — nenhum valor e
// marcado, em vez de produzir um falso positivo sobre uma amostra minuscula.
const MIN_SAMPLE_SIZE_FOR_IQR = 4;
const IQR_MULTIPLIER = 1.5;

export function flagOutliers(values: readonly number[]): boolean[] {
  if (values.length < MIN_SAMPLE_SIZE_FOR_IQR) {
    return values.map(() => false);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerBound = q1 - IQR_MULTIPLIER * iqr;
  const upperBound = q3 + IQR_MULTIPLIER * iqr;
  return values.map((value) => value < lowerBound || value > upperBound);
}
