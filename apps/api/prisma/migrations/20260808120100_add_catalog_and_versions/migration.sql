-- Fase 2 (T021) — data-model.md, Ordem de migracao, passos 2-5.
--
-- Cria, na mesma migracao: (a) colunas novas nullable em User, SystemSetting,
-- EvidenceFile e FormIndicator (passo 2 — "nullable primeiro"); (b) as seis
-- tabelas novas de Parte B: indicator_catalog, indicator_response_version
-- (com o indice unico parcial de T016), report_submission, audit.access_log,
-- export_seal e export_seal_revocation. Lista exaustiva de proposito: T035
-- revoga DML sobre tres destas e falha se alguma nao existir.
--
-- catalog_entry_id (form_indicators) e bucket (evidence_files) ficam
-- NULLABLE aqui — T024 faz o backfill do primeiro e so entao ambos viram
-- NOT NULL. audit_logs fica de fora: pertence a T025, que move a tabela
-- inteira para o schema audit.

-- CreateEnum
CREATE TYPE "evidence_scan_status" AS ENUM ('PENDENTE', 'LIBERADO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "evidence_retention_mode" AS ENUM ('JANELA', 'INDEFINIDA');

-- CreateEnum
CREATE TYPE "inheritance_state" AS ENUM ('NAO_HERDADO', 'HERDADO', 'HERDADO_PARCIAL');

-- CreateEnum
CREATE TYPE "report_submission_stage" AS ENUM ('ELABORACAO', 'REVISAO', 'APROVACAO');

-- CreateEnum
CREATE TYPE "export_artifact_kind" AS ENUM ('RELATORIO', 'CONSULTA_AUDITORIA');

-- CreateEnum
CREATE TYPE "export_artifact_format" AS ENUM ('PDF', 'CSV', 'JSON');

-- CreateEnum (schema audit)
CREATE TYPE "audit"."actor_kind" AS ENUM ('USUARIO', 'SISTEMA', 'ANONIMO_DECLARADO');

-- CreateEnum (schema audit)
CREATE TYPE "audit"."access_log_event_type" AS ENUM ('CONSULTA_AUDITORIA', 'EXPORTACAO', 'DOWNLOAD_EVIDENCIA', 'VERIFICACAO_SELO', 'LOGIN_SUCESSO', 'LOGIN_FALHA');

-- AlterTable (A4 — cargo distinto do perfil, FR-074)
ALTER TABLE "users" ADD COLUMN "job_title" TEXT;

-- AlterTable (A7 — sete parametros operacionais novos)
ALTER TABLE "system_settings"
  ADD COLUMN "evidence_retention_years" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "include_optional_holidays" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "audit_max_range_months" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "audit_detailed_max_range_months" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "audit_exact_count_threshold" INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN "outlier_rule" TEXT NOT NULL DEFAULT 'IQR',
  ADD COLUMN "forensic_hold_years" INTEGER NOT NULL DEFAULT 1;

-- AlterTable (A5 — verificacao, quarentena e retencao de evidencia)
ALTER TABLE "evidence_files"
  ADD COLUMN "scan_status" "evidence_scan_status" NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN "scanned_at" TIMESTAMP(3),
  ADD COLUMN "scan_engine_version" TEXT,
  ADD COLUMN "bucket" TEXT,
  ADD COLUMN "retain_until" TIMESTAMP(3),
  ADD COLUMN "retention_mode" "evidence_retention_mode" NOT NULL DEFAULT 'JANELA',
  ADD COLUMN "forensic_hold_until" TIMESTAMP(3),
  ADD COLUMN "deactivated_by_user_id" TEXT,
  ADD COLUMN "deactivated_at" TIMESTAMP(3);

-- AlterTable (A1 — IndicatorResponse vira identidade estavel)
ALTER TABLE "indicator_responses" ADD COLUMN "current_version_id" TEXT;

-- CreateTable (B1 — catalogo canonico; precisa existir antes da FK de
-- form_indicators.catalog_entry_id abaixo)
CREATE TABLE "indicator_catalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "measurement_unit" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicator_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "indicator_catalog_code_key" ON "indicator_catalog"("code");

-- AlterTable (A6 — vinculo obrigatorio ao catalogo; NOT NULL soh em T024)
ALTER TABLE "form_indicators" ADD COLUMN "catalog_entry_id" TEXT;

-- AddForeignKey
ALTER TABLE "form_indicators" ADD CONSTRAINT "form_indicators_catalog_entry_id_fkey" FOREIGN KEY ("catalog_entry_id") REFERENCES "indicator_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (B2 — versionamento append-only, coracao do Principio I)
CREATE TABLE "indicator_response_version" (
    "id" TEXT NOT NULL,
    "indicator_response_id" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "variable_values" JSONB NOT NULL DEFAULT '{}',
    "calculated_value" DECIMAL(18,4),
    "calculation_failure_reason" TEXT,
    "is_compliant" BOOLEAN,
    "critical_analysis" TEXT,
    "action_plan" TEXT,
    "inheritance_state" "inheritance_state" NOT NULL DEFAULT 'NAO_HERDADO',
    "unresolved_inherited_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authored_by_user_id" TEXT,
    "overwrote_version_id" TEXT,
    "origin_legacy" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_response_version_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_indicator_response_version_valid_range" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from")
);

-- CreateIndex (a garantia de "no maximo uma versao corrente" e do banco)
CREATE UNIQUE INDEX "uq_indicator_response_version_current" ON "indicator_response_version"("indicator_response_id") WHERE "valid_to" IS NULL;

-- AddForeignKey
ALTER TABLE "indicator_response_version" ADD CONSTRAINT "indicator_response_version_indicator_response_id_fkey" FOREIGN KEY ("indicator_response_id") REFERENCES "indicator_responses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_response_version" ADD CONSTRAINT "indicator_response_version_authored_by_user_id_fkey" FOREIGN KEY ("authored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_response_version" ADD CONSTRAINT "indicator_response_version_overwrote_version_id_fkey" FOREIGN KEY ("overwrote_version_id") REFERENCES "indicator_response_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (fecha o ciclo: current_version_id aponta para a versao corrente)
ALTER TABLE "indicator_responses" ADD CONSTRAINT "indicator_responses_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "indicator_response_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_deactivated_by_user_id_fkey" FOREIGN KEY ("deactivated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable (B3 — uma linha por envio, pontualidade nunca sobrescrita)
CREATE TABLE "report_submission" (
    "id" TEXT NOT NULL,
    "report_instance_id" TEXT NOT NULL,
    "stage" "report_submission_stage" NOT NULL,
    "submitted_by_user_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_due_date" DATE NOT NULL,
    "was_on_time" BOOLEAN NOT NULL,
    "reproval_count_at_submission" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "report_submission_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "report_submission" ADD CONSTRAINT "report_submission_report_instance_id_fkey" FOREIGN KEY ("report_instance_id") REFERENCES "report_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_submission" ADD CONSTRAINT "report_submission_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (B4 — trilha de leitura sensivel, schema audit, FR-073)
CREATE TABLE "audit"."access_log" (
    "id" TEXT NOT NULL,
    "event_type" "audit"."access_log_event_type" NOT NULL,
    "user_id" TEXT,
    "actor_kind" "audit"."actor_kind" NOT NULL,
    "filters_applied" JSONB,
    "scope_unit_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "result_volume" INTEGER,
    "source_ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_log_event_type_occurred_at_idx" ON "audit"."access_log"("event_type", "occurred_at");

-- AddForeignKey (referencia cross-schema — user_id continua em public.users)
ALTER TABLE "audit"."access_log" ADD CONSTRAINT "access_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable (B5 — selo de integridade)
CREATE TABLE "export_seal" (
    "id" TEXT NOT NULL,
    "verification_code" TEXT NOT NULL,
    "seal_contract_version" TEXT NOT NULL,
    "content_digest" TEXT NOT NULL,
    "artifact_digest" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "artifact_kind" "export_artifact_kind" NOT NULL,
    "artifact_format" "export_artifact_format" NOT NULL,
    "scope_descriptor" JSONB NOT NULL,
    "issued_by_user_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_empty_result" BOOLEAN NOT NULL DEFAULT false,
    "is_partial" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "export_seal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "export_seal_verification_code_key" ON "export_seal"("verification_code");

-- AddForeignKey
ALTER TABLE "export_seal" ADD CONSTRAINT "export_seal_issued_by_user_id_fkey" FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (revogacao e registro ADICIONAL — o selo original nunca muda, FR-101)
CREATE TABLE "export_seal_revocation" (
    "id" TEXT NOT NULL,
    "seal_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "revoked_by_user_id" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_seal_revocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "export_seal_revocation_seal_id_key" ON "export_seal_revocation"("seal_id");

-- AddForeignKey
ALTER TABLE "export_seal_revocation" ADD CONSTRAINT "export_seal_revocation_seal_id_fkey" FOREIGN KEY ("seal_id") REFERENCES "export_seal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_seal_revocation" ADD CONSTRAINT "export_seal_revocation_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
