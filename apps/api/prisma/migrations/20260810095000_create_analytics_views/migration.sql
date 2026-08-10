-- Fase 10 (T149, T150) — contracts/analytics-layer.md: camada de consumo
-- analitico do BI. Cinco views somente-leitura no schema "analytics",
-- projetando o que o OLTP ja decidiu — nenhuma delas recalcula nota,
-- conformidade ou meta (Principio VII). GRANT SELECT a "tableau_ro" so
-- acontece na proxima migracao (T151), depois que as views ja existem.
--
-- absence_kind espelha exatamente reports/absence.util.ts::classifyIndicatorCell
-- e a simplificacao ja assumida por audit-query.service.ts::buildRows
-- ("indicatorActiveAtPeriod: true" sempre que a resposta existe — a
-- existencia em si ja certifica ativo a epoca, FR-081): dentro de
-- v_report_fact toda linha TEM IndicatorResponse, entao NA_FORA_DO_NIVEL
-- (que descreve a AUSENCIA de linha) nunca aparece como valor de
-- absence_kind aqui — e um dominio formal, compartilhado com
-- v_absence_semantics, nao uma garantia de que os cinco valores ocorrem
-- fisicamente nesta view.
CREATE VIEW "analytics"."v_report_fact" AS
SELECT
  u."id" AS "unit_id",
  u."sigla" AS "unit_acronym",
  -- [verificar na implementação] nao existe historico de nivel de unidade no
  -- modelo (nenhuma tabela de versionamento de Unit.level) — mesma
  -- simplificacao ja em vigor em audit-query.service.ts, que tambem le
  -- "unit.level" corrente. Documentado em contracts/analytics-layer.md:
  -- FR-122 exige que BI e Auditoria leiam a MESMA origem; manter os dois
  -- iguais (ambos correntes) e o que preserva essa paridade hoje.
  u."level" AS "unit_level_at_period",
  ri."reference_month" AS "reference_period",
  ic."code" AS "indicator_code",
  ic."measurement_unit" AS "measurement_unit",
  ir."calculated_value" AS "calculated_value",
  CASE
    WHEN ir."calculated_value" IS NULL THEN 'NAO_PREENCHIDO'
    WHEN ir."calculated_value" = 0 THEN 'ZERO_MEDIDO'
    ELSE 'VALOR'
  END AS "absence_kind",
  ir."snapshot_goal_operator" AS "snapshot_goal_operator",
  ir."snapshot_goal_value" AS "snapshot_goal_value",
  ir."snapshot_score_weight" AS "snapshot_score_weight",
  ir."is_compliant" AS "is_compliant",
  vv."verdict" AS "validation_verdict",
  ri."total_score" AS "report_total_score",
  ir."id" AS "response_id"
FROM "public"."indicator_responses" ir
JOIN "public"."report_instances" ri ON ri."id" = ir."report_instance_id"
JOIN "public"."units" u ON u."id" = ri."unit_id"
JOIN "public"."form_indicators" fi ON fi."id" = ir."form_indicator_id"
JOIN "public"."indicator_catalog" ic ON ic."id" = fi."catalog_entry_id"
LEFT JOIN LATERAL (
  SELECT vr."verdict"
  FROM "public"."validation_records" vr
  WHERE vr."indicator_response_id" = ir."id"
  ORDER BY vr."created_at" DESC
  LIMIT 1
) vv ON true
-- FR-115: relatorio em qualquer estado que nao CONCLUIDO nao aparece em
-- nenhuma view — nenhum numero provisorio circula como consolidado.
WHERE ri."status" = 'CONCLUIDO';

-- FR-116: torna impossivel o erro que o Principio III proibe — nenhuma
-- agregacao de BI pode tratar ausencia como zero. Dominio estatico, os
-- cinco valores fisicos de reports/absence.util.ts::IndicatorCellState.
CREATE VIEW "analytics"."v_absence_semantics" AS
SELECT * FROM (VALUES
  ('VALOR', true, 'Valor apurado — entra normalmente em soma e media.'),
  ('ZERO_MEDIDO', true, 'Zero medido — resultado apurado igual a zero, distinto de ausencia. Entra em soma e media.'),
  ('NA_FORA_DO_NIVEL', false, 'Fora do nivel — a unidade nao tinha este indicador em seu formulario no periodo. Nunca conta no denominador.'),
  ('NA_INATIVO_NO_PERIODO', false, 'Indicador inativo no periodo — existia resposta, mas o indicador estava desativado a epoca. Nunca conta no denominador.'),
  ('NAO_PREENCHIDO', false, 'Nao preenchido — a unidade tinha o indicador, mas nao enviou o valor. Nunca conta no denominador.')
) AS t("absence_kind", "counts_in_denominator", "label_pt_br");

CREATE VIEW "analytics"."v_indicator_dim" AS
SELECT
  ic."id" AS "indicator_catalog_id",
  ic."code" AS "indicator_code",
  ic."name" AS "indicator_name",
  ic."measurement_unit" AS "measurement_unit",
  ic."is_active" AS "is_active"
FROM "public"."indicator_catalog" ic;

CREATE VIEW "analytics"."v_unit_dim" AS
SELECT
  u."id" AS "unit_id",
  u."sigla" AS "unit_acronym",
  u."nome" AS "unit_name",
  -- Mesma simplificacao de v_report_fact.unit_level_at_period acima: nivel
  -- corrente, sem historico.
  u."level" AS "unit_level",
  u."is_active" AS "is_active"
FROM "public"."units" u;

-- FR-119/FR-120: expoe apenas o vinculo resolvido pela plataforma — nunca
-- "bucket"/"file_key" (o endereco real do armazenamento). resolver_token e
-- gerado e renovado por AnalyticsReloadService (T156), nunca calculado
-- dentro desta view (SQL nao guarda o segredo HMAC — ver
-- evidence-token.util.ts). Uma linha por evidencia ativa e liberada de
-- relatorio concluido; resolver_token fica NULL ate a proxima recarga
-- emitir um token vigente para aquele arquivo.
CREATE VIEW "analytics"."v_evidence_link" AS
SELECT
  ir."id" AS "response_id",
  ef."id" AS "evidence_file_id",
  ef."file_name" AS "evidence_file_name",
  eat."token" AS "resolver_token",
  eat."expires_at" AS "resolver_token_expires_at"
FROM "public"."indicator_responses" ir
JOIN "public"."report_instances" ri ON ri."id" = ir."report_instance_id"
JOIN "public"."evidence_files" ef ON ef."indicator_response_id" = ir."id"
LEFT JOIN LATERAL (
  SELECT eat2."token", eat2."expires_at"
  FROM "public"."evidence_access_tokens" eat2
  WHERE eat2."evidence_file_id" = ef."id"
    AND eat2."consumed_at" IS NULL
    AND eat2."expires_at" > now()
  ORDER BY eat2."issued_at" DESC
  LIMIT 1
) eat ON true
WHERE ri."status" = 'CONCLUIDO'
  AND ef."is_active" = true
  AND ef."scan_status" = 'LIBERADO';
