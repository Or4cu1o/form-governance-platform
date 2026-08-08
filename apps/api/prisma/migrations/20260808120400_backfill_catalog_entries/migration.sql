-- Fase 2 (T024) — data-model.md, Ordem de migracao, passo 3.
--
-- Cria uma entrada de catalogo por FormIndicator existente, para que
-- catalog_entry_id possa virar obrigatorio sem perda (A6, FR-062). O code
-- e o measurement_unit gerados aqui sao PROVISORIOS — nao havia catalogo
-- antes desta migracao, entao nao ha unidade de medida real para inferir.
-- Marcados para revisao do Administrador quando US4 (T083-T086) entregar a
-- tela de catalogo; ate la o codigo e legivel o bastante para localizar a
-- origem e estavel (nunca muda depois de criado).
INSERT INTO "indicator_catalog" ("id", "code", "name", "measurement_unit", "description", "is_active", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    'LEGADO_' || UPPER(LEFT(REGEXP_REPLACE(fi."title", '[^A-Za-z0-9]+', '_', 'g'), 24)) || '_' || RIGHT(fi."id", 8),
    fi."title",
    'A_DEFINIR',
    'Entrada de catalogo gerada automaticamente no backfill de T024 a partir de FormIndicator.title. measurement_unit e provisorio — revisar via tela de catalogo (US4).',
    fi."is_active",
    now(),
    now()
FROM "form_indicators" fi
WHERE fi."catalog_entry_id" IS NULL;

UPDATE "form_indicators" fi
SET "catalog_entry_id" = ic."id"
FROM "indicator_catalog" ic
WHERE fi."catalog_entry_id" IS NULL
  AND ic."code" = 'LEGADO_' || UPPER(LEFT(REGEXP_REPLACE(fi."title", '[^A-Za-z0-9]+', '_', 'g'), 24)) || '_' || RIGHT(fi."id", 8);

ALTER TABLE "form_indicators" ALTER COLUMN "catalog_entry_id" SET NOT NULL;

-- Correcao correlata de A5 (T012): bucket tambem ficou nullable em T021
-- para acomodar linhas legadas. As unicas evidencias existentes antes da
-- quarentena/imutavel vivem no bucket unico legado (S3_BUCKET nos
-- ambientes ja provisionados) — backfill explicito, sem inventar destino.
UPDATE "evidence_files"
SET "bucket" = 'formops-evidencias'
WHERE "bucket" IS NULL;

ALTER TABLE "evidence_files" ALTER COLUMN "bucket" SET NOT NULL;
