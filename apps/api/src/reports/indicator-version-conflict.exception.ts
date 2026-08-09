import { ConflictException } from '@nestjs/common';

export interface IndicatorVersionConflictCurrent {
  versionId: string;
  variableValues: Record<string, number>;
  authoredBy: { name: string; jobTitle: string | null } | null;
  authoredAt: string;
}

// FR-129: gravacao sobre uma versao que ja nao e a corrente nunca e aceita
// nem descartada em silencio — o autor recebe o valor que prevaleceu, quem
// o informou e quando, para decidir conscientemente se sobrescreve.
export class IndicatorVersionConflictException extends ConflictException {
  constructor(current: IndicatorVersionConflictCurrent) {
    super({
      statusCode: 409,
      error: 'CONFLITO_DE_VERSAO',
      message: 'Este indicador foi alterado por outra pessoa enquanto voce editava.',
      current,
    });
  }
}
