-- Fase 2 (T025) — data-model.md, Ordem de migracao (A3, FR-069).
--
-- Move audit_logs para o schema audit e adiciona o contexto de requisicao
-- e os snapshots de autoria exigidos por FR-069. Reescreve o trigger para
-- (a) gravar nas colunas novas a partir de variaveis de sessao definidas
-- pelo AuditContextService (T027) e (b) REJEITAR a escrita quando
-- app.origin nao estiver definida — a garantia de "nunca gravado em
-- silencio sem contexto" fica no banco, nao so na aplicacao (Principio I,
-- T166).

-- AlterTable: colunas novas. origin entra NOT NULL com DEFAULT constante —
-- Postgres preenche as linhas existentes por metadado, sem reescrever a
-- tabela linha a linha, o que evitaria disparar trg_audit_logs_immutable
-- (audit_logs so aceita INSERT; um UPDATE de backfill, mesmo em migracao,
-- e barrado pelo proprio gatilho de imutabilidade). O DEFAULT e removido
-- em seguida: dai em diante toda escrita nova deve informar origin
-- explicitamente via AuditContextService, nunca por conveniencia.
ALTER TABLE "audit_logs"
  ADD COLUMN "source_ip" TEXT,
  ADD COLUMN "user_agent" TEXT,
  ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'LEGADO',
  ADD COLUMN "request_id" TEXT,
  ADD COLUMN "actor_name_snapshot" TEXT,
  ADD COLUMN "actor_job_title_snapshot" TEXT,
  ADD COLUMN "actor_role_snapshot" TEXT,
  ADD COLUMN "actor_unit_snapshot" TEXT;

ALTER TABLE "audit_logs" ALTER COLUMN "origin" DROP DEFAULT;

-- Mover a tabela inteira: indices, constraints e triggers acompanham a
-- movimentacao automaticamente no Postgres.
ALTER TABLE "audit_logs" SET SCHEMA "audit";

-- Reescreve a funcao do trigger para gravar o contexto novo e para
-- REJEITAR (RAISE EXCEPTION) qualquer escrita sem app.origin definida.
CREATE OR REPLACE FUNCTION fn_write_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_origin text;
BEGIN
  BEGIN
    v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  v_origin := NULLIF(current_setting('app.origin', true), '');
  IF v_origin IS NULL THEN
    RAISE EXCEPTION 'audit: escrita em % sem contexto de auditoria (app.origin nao definida) — use AuditContextService.runWithAuditContext', TG_TABLE_NAME;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN
      RETURN NEW;
    END IF;
    INSERT INTO "audit"."audit_logs" (
      id, table_name, record_id, action, user_id, previous_value, new_value, changed_at,
      source_ip, user_agent, origin, request_id,
      actor_name_snapshot, actor_job_title_snapshot, actor_role_snapshot, actor_unit_snapshot
    )
    VALUES (
      gen_random_uuid(), TG_TABLE_NAME, NEW.id::text, 'UPDATE', v_user_id, to_jsonb(OLD), to_jsonb(NEW), now(),
      NULLIF(current_setting('app.source_ip', true), ''),
      NULLIF(current_setting('app.user_agent', true), ''),
      v_origin,
      NULLIF(current_setting('app.request_id', true), ''),
      NULLIF(current_setting('app.actor_name_snapshot', true), ''),
      NULLIF(current_setting('app.actor_job_title_snapshot', true), ''),
      NULLIF(current_setting('app.actor_role_snapshot', true), ''),
      NULLIF(current_setting('app.actor_unit_snapshot', true), '')
    );
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO "audit"."audit_logs" (
      id, table_name, record_id, action, user_id, previous_value, new_value, changed_at,
      source_ip, user_agent, origin, request_id,
      actor_name_snapshot, actor_job_title_snapshot, actor_role_snapshot, actor_unit_snapshot
    )
    VALUES (
      gen_random_uuid(), TG_TABLE_NAME, NEW.id::text, 'INSERT', v_user_id, NULL, to_jsonb(NEW), now(),
      NULLIF(current_setting('app.source_ip', true), ''),
      NULLIF(current_setting('app.user_agent', true), ''),
      v_origin,
      NULLIF(current_setting('app.request_id', true), ''),
      NULLIF(current_setting('app.actor_name_snapshot', true), ''),
      NULLIF(current_setting('app.actor_job_title_snapshot', true), ''),
      NULLIF(current_setting('app.actor_role_snapshot', true), ''),
      NULLIF(current_setting('app.actor_unit_snapshot', true), '')
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- A funcao de imutabilidade nao referencia a tabela — nao precisa mudar,
-- mas o trigger ja acompanhou a tabela para o schema audit automaticamente.
