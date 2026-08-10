-- Fase 11 (T158, FR-039a) — liberacao antecipada da guarda pericial,
-- exclusiva do administrador, registrada com autor, motivo e data.
--
-- "evidence_files" ja e coberta pelo gatilho de auditoria (T166/T167:
-- fn_write_audit_log em INSERT/UPDATE) — a mudanca de forensic_hold_until
-- feita pelo endpoint de liberacao ja fica no acervo de auditoria pelo
-- mecanismo existente; os tres campos abaixo apenas tornam o motivo e o
-- autor consultaveis diretamente na linha, no mesmo padrao ja usado para a
-- desativacao logica (deactivated_by_user_id/deactivated_at).
ALTER TABLE "evidence_files" ADD COLUMN "forensic_hold_released_by_user_id" TEXT;
ALTER TABLE "evidence_files" ADD COLUMN "forensic_hold_released_at" TIMESTAMP(3);
ALTER TABLE "evidence_files" ADD COLUMN "forensic_hold_release_reason" TEXT;

-- AddForeignKey
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_forensic_hold_released_by_user_id_fkey" FOREIGN KEY ("forensic_hold_released_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
