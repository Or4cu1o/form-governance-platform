import { Injectable } from '@nestjs/common';
import { InheritanceState } from '@prisma/client';

export interface InheritanceResult {
  variableValues: Record<string, number>;
  inheritanceState: InheritanceState;
  unresolvedInheritedKeys: string[];
}

// FR-021 a FR-025: herda dados estruturais estaveis do periodo anterior por
// CHAVE DECLARADA, nunca por posicao. Chave presente na definicao vigente e
// ausente no valor herdado fica NAO_PREENCHIDO (nunca zero, nunca o valor de
// outra chave) e a resposta e marcada HERDADO_PARCIAL para conferencia do
// elaborador (cenario US1-3, quickstart V3).
@Injectable()
export class InheritanceService {
  inheritValues(
    currentVariableKeys: string[],
    previousVariableValues: Record<string, number> | null | undefined,
  ): InheritanceResult {
    if (!previousVariableValues) {
      return { variableValues: {}, inheritanceState: InheritanceState.NAO_HERDADO, unresolvedInheritedKeys: [] };
    }

    const variableValues: Record<string, number> = {};
    const unresolvedInheritedKeys: string[] = [];

    for (const key of currentVariableKeys) {
      if (key in previousVariableValues) {
        variableValues[key] = previousVariableValues[key];
      } else {
        unresolvedInheritedKeys.push(key);
      }
    }

    const inheritanceState =
      unresolvedInheritedKeys.length > 0 ? InheritanceState.HERDADO_PARCIAL : InheritanceState.HERDADO;

    return { variableValues, inheritanceState, unresolvedInheritedKeys };
  }
}
