-- Fase 2 (T022) — data-model.md, Ordem de migracao, passo 4.
--
-- Para cada IndicatorResponse existente, exatamente UMA versao com
-- origin_legacy = true e valid_to = NULL. Nenhuma versao intermediaria e
-- sintetizada — o historico anterior ao versionamento nao existe, e o
-- modelo diz isso explicitamente em vez de simula-lo (data-model.md B2).
INSERT INTO "indicator_response_version" (
    "id", "indicator_response_id", "valid_from", "valid_to",
    "variable_values", "calculated_value", "calculation_failure_reason",
    "is_compliant", "critical_analysis", "action_plan",
    "inheritance_state", "unresolved_inherited_keys",
    "authored_by_user_id", "overwrote_version_id", "origin_legacy", "created_at"
)
SELECT
    gen_random_uuid()::text,
    ir."id",
    ir."updated_at",
    NULL,
    ir."variable_values",
    ir."calculated_value",
    NULL,
    ir."is_compliant",
    ir."critical_analysis",
    ir."action_plan",
    'NAO_HERDADO',
    ARRAY[]::TEXT[],
    ir."updated_by_user_id",
    NULL,
    true,
    ir."updated_at"
FROM "indicator_responses" ir
WHERE NOT EXISTS (
    SELECT 1 FROM "indicator_response_version" v WHERE v."indicator_response_id" = ir."id"
);

-- Fecha o ciclo: cada IndicatorResponse passa a apontar a versao que acabou
-- de receber, tornando-se a identidade estavel prevista em A1.
UPDATE "indicator_responses" ir
SET "current_version_id" = v."id"
FROM "indicator_response_version" v
WHERE v."indicator_response_id" = ir."id"
  AND v."valid_to" IS NULL
  AND ir."current_version_id" IS NULL;
