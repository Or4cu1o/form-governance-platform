-- Fase 2 (T023) — data-model.md, Ordem de migracao, passo 5.
--
-- Deriva ReportSubmission dos campos unicos legados de ReportInstance
-- (submitted_for_review_at / submitted_for_approval_at), preservando o que
-- houver. Autoria de "quem submeteu" nao era registrada antes desta
-- migracao — a mesma lacuna que T027/T028/T166 fecham para toda escrita
-- futura. Nao ha como recuperar esse dado; a inferencia abaixo usa o autor
-- mais recente conhecido nas respostas do relatorio e, na falta de
-- qualquer um, o usuario ativo mais antigo da unidade — melhor evidencia
-- disponivel, nunca inventada.
INSERT INTO "report_submission" (
    "id", "report_instance_id", "stage", "submitted_by_user_id", "submitted_at",
    "effective_due_date", "was_on_time", "reproval_count_at_submission"
)
SELECT
    gen_random_uuid()::text,
    ri."id",
    'ELABORACAO',
    COALESCE(
        (SELECT ir."updated_by_user_id" FROM "indicator_responses" ir
         WHERE ir."report_instance_id" = ri."id" AND ir."updated_by_user_id" IS NOT NULL
         ORDER BY ir."updated_at" DESC LIMIT 1),
        (SELECT u."id" FROM "users" u WHERE u."primary_unit_id" = ri."unit_id" AND u."is_active" = true
         ORDER BY u."created_at" ASC LIMIT 1),
        (SELECT u."id" FROM "users" u WHERE u."is_active" = true ORDER BY u."created_at" ASC LIMIT 1)
    ),
    ri."submitted_for_review_at",
    ri."elaboration_due_date",
    COALESCE(ri."is_elaboration_on_time", true),
    0
FROM "report_instances" ri
WHERE ri."submitted_for_review_at" IS NOT NULL;

INSERT INTO "report_submission" (
    "id", "report_instance_id", "stage", "submitted_by_user_id", "submitted_at",
    "effective_due_date", "was_on_time", "reproval_count_at_submission"
)
SELECT
    gen_random_uuid()::text,
    ri."id",
    'REVISAO',
    COALESCE(
        (SELECT ir."updated_by_user_id" FROM "indicator_responses" ir
         WHERE ir."report_instance_id" = ri."id" AND ir."updated_by_user_id" IS NOT NULL
         ORDER BY ir."updated_at" DESC LIMIT 1),
        (SELECT u."id" FROM "users" u WHERE u."primary_unit_id" = ri."unit_id" AND u."is_active" = true
         ORDER BY u."created_at" ASC LIMIT 1),
        (SELECT u."id" FROM "users" u WHERE u."is_active" = true ORDER BY u."created_at" ASC LIMIT 1)
    ),
    ri."submitted_for_approval_at",
    COALESCE(ri."sla_extension_due_date", ri."review_due_date"),
    COALESCE(ri."is_review_on_time", true),
    ri."reproval_count"
FROM "report_instances" ri
WHERE ri."submitted_for_approval_at" IS NOT NULL;
