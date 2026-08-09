// As cinco representacoes fisicas de ausencia do Principio III
// (data-model.md, "Semantica de ausencia — representacao fisica") — nao
// podem ser colapsadas. Fundacao para T110 (matriz esparsa da auditoria) e
// T149 (views analiticas), nao codigo de US1.
export enum IndicatorCellState {
  VALOR_APURADO = 'VALOR_APURADO',
  ZERO_MEDIDO = 'ZERO_MEDIDO',
  NAO_APLICAVEL_FORA_DO_NIVEL = 'NAO_APLICAVEL_FORA_DO_NIVEL',
  NAO_APLICAVEL_INDICADOR_INATIVO = 'NAO_APLICAVEL_INDICADOR_INATIVO',
  NAO_PREENCHIDO = 'NAO_PREENCHIDO',
}

export interface IndicatorCellInput {
  // Existe um IndicatorResponse para o par (relatorio, indicador)? false
  // quando a unidade nao tinha o que preencher naquele periodo.
  responseExists: boolean;
  // FormIndicator estava ativo a epoca, decidido pelo snapshot da versao —
  // nunca pelo cadastro corrente (FR-081).
  indicatorActiveAtPeriod: boolean;
  calculatedValue: number | null;
}

export function classifyIndicatorCell(input: IndicatorCellInput): IndicatorCellState {
  if (!input.responseExists) {
    return IndicatorCellState.NAO_APLICAVEL_FORA_DO_NIVEL;
  }
  if (!input.indicatorActiveAtPeriod) {
    return IndicatorCellState.NAO_APLICAVEL_INDICADOR_INATIVO;
  }
  if (input.calculatedValue === null) {
    return IndicatorCellState.NAO_PREENCHIDO;
  }
  if (input.calculatedValue === 0) {
    return IndicatorCellState.ZERO_MEDIDO;
  }
  return IndicatorCellState.VALOR_APURADO;
}

// A celula ausente nunca vira 0 e nunca entra em denominador de agregacao
// (FR-086) — todo consumidor de IndicatorCellState deve checar isto antes de
// somar ou dividir.
export function isAbsentState(state: IndicatorCellState): boolean {
  return state !== IndicatorCellState.VALOR_APURADO && state !== IndicatorCellState.ZERO_MEDIDO;
}
