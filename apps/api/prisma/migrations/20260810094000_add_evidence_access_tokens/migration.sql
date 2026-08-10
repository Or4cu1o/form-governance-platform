-- Fase 10 (T152) — suporte de estado para o resolver de evidencia exposto ao
-- BI (US8, FR-119/FR-120): token HMAC-SHA256 de uso unico e vida curta.
--
-- A assinatura/verificacao HMAC roda inteiramente em Node
-- (evidence-token.util.ts) — o segredo (EVIDENCE_RESOLVER_HMAC_SECRET)
-- nunca entra no banco, entao esta tabela guarda so o texto ja assinado
-- (mesmo precedente de "export_seal"."verification_code": ja
-- nao-enumeravel, sem necessidade de hash adicional) e o estado de
-- consumo/expiracao que uma VIEW pura nao pode manter.
--
-- Tabela nova em "public": ja coberta pelo GRANT amplo + ALTER DEFAULT
-- PRIVILEGES de 20260809090000_revoke_dml_on_append_only (role
-- "formops_app"). Nao e append-only — o UPDATE que marca "consumed_at" no
-- resgate do token e o proprio ponto do fluxo, entao esta tabela fica fora
-- da lista de REVOKE UPDATE/DELETE daquela migracao.
CREATE TABLE "evidence_access_tokens" (
    "id" TEXT NOT NULL,
    "evidence_file_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "evidence_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_access_tokens_token_key" ON "evidence_access_tokens"("token");

-- CreateIndex
CREATE INDEX "evidence_access_tokens_evidence_file_id_idx" ON "evidence_access_tokens"("evidence_file_id");

-- AddForeignKey
ALTER TABLE "evidence_access_tokens" ADD CONSTRAINT "evidence_access_tokens_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
