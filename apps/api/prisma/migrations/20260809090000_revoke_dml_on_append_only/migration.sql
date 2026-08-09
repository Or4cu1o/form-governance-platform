-- Fase 2 (T035) — data-model.md, Ordem de migracao, passo 6, o ultimo antes
-- que a garantia de append-only passe a ser do banco, nao so da aplicacao.
--
-- "formops" (POSTGRES_USER) e o dono de toda tabela criada pelas migracoes
-- anteriores e, no ambiente Docker, o superusuario de bootstrap do proprio
-- Postgres — REVOKE contra o dono/superusuario e um no-op, o dono sempre
-- ignora ACL. Por isso esta migracao primeiro cria uma role de aplicacao
-- distinta ("formops_app", nao superusuario, nao dona de nada) com o
-- privilegio minimo de que a API precisa, e so entao revoga UPDATE/DELETE
-- dela nas seis tabelas append-only. LOGIN e senha de "formops_app" sao
-- operacionais (mesmo padrao de tableau_ro em T020) — aplicados fora desta
-- migracao versionada por apps/api/scripts/provision-app-role.ts, chamado
-- apos "prisma migrate deploy" tanto por scripts/manage.js quanto por
-- docker-entrypoint.sh.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'formops_app') THEN
    CREATE ROLE "formops_app" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA "public" TO "formops_app";
GRANT USAGE ON SCHEMA "audit" TO "formops_app";

-- Privilegio amplo primeiro (cobre as dezenas de tabelas operacionais que a
-- API precisa ler/escrever), depois estreitado nas seis tabelas append-only
-- abaixo. ALTER DEFAULT PRIVILEGES cobre tabela nova criada por migracao
-- futura executada pela mesma role "formops" (dona/administradora), sem
-- exigir que toda migracao seguinte lembre de conceder GRANT de novo.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO "formops_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "audit" TO "formops_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "formops_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA "audit" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "formops_app";

-- As seis tabelas append-only (T035): identidade estavel, nunca sobrescrita
-- nem apagada por caminho algum da aplicacao (FR-047, FR-070).
REVOKE UPDATE, DELETE ON
  "public"."indicator_response_version",
  "public"."validation_records",
  "audit"."audit_logs",
  "audit"."access_log",
  "public"."export_seal",
  "public"."export_seal_revocation"
FROM "formops_app";
