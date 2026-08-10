-- T109/research.md D6: indices para a area de auditoria (US6).
--
-- B-tree composto sobre a chave de paginacao keyset de D5
-- (referencePeriod DESC, unitId ASC, responseId ASC — o "responseId" da
-- decisao equivale, no grao real da consulta, ao id do proprio
-- ReportInstance, ver nota em audit-query.service.ts).
CREATE INDEX IF NOT EXISTS "report_instances_audit_keyset_idx"
  ON "public"."report_instances" ("reference_month" DESC, "unit_id" ASC, "id" ASC);

-- GIN com jsonb_path_ops sobre os valores de variavel de cada resposta —
-- menor e mais rapido que o operador padrao para consulta de contencao,
-- que e o padrao de acesso desta area (research.md D6).
CREATE INDEX IF NOT EXISTS "indicator_responses_variable_values_gin_idx"
  ON "public"."indicator_responses" USING GIN ("variable_values" jsonb_path_ops);

-- pg_trgm para a busca dentro do resultado (FR-092/T113a) alcancar o
-- conjunto inteiro via banco, nunca o trecho renderizado.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "units_sigla_trgm_idx"
  ON "public"."units" USING GIN ("sigla" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "units_nome_trgm_idx"
  ON "public"."units" USING GIN ("nome" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "form_indicators_title_trgm_idx"
  ON "public"."form_indicators" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "indicator_catalog_code_trgm_idx"
  ON "public"."indicator_catalog" USING GIN ("code" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "indicator_catalog_name_trgm_idx"
  ON "public"."indicator_catalog" USING GIN ("name" gin_trgm_ops);
