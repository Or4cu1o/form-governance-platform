-- Fase 3 (T046/T047) — espelha em "indicator_responses" os mesmos campos ja
-- existentes em "indicator_response_version" (calculation_failure_reason,
-- inheritance_state, unresolved_inherited_keys), completando a projecao da
-- versao corrente descrita no comentario do model. Sem essas colunas, a
-- tela do indicador (T053) precisaria de outra consulta so para mostrar o
-- motivo de falha de calculo ou a sinalizacao de heranca.
ALTER TABLE "indicator_responses"
  ADD COLUMN "calculation_failure_reason" TEXT,
  ADD COLUMN "inheritance_state" "inheritance_state" NOT NULL DEFAULT 'NAO_HERDADO',
  ADD COLUMN "unresolved_inherited_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
