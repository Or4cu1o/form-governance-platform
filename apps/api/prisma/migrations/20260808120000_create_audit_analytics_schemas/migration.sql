-- Fase 2 (T020) — data-model.md, Ordem de migracao, passo 1.
--
-- Schemas audit e analytics, isolando trilha imutavel e camada read-only do
-- schema public. A role tableau_ro e criada aqui SEM privilegio algum —
-- GRANT SELECT em analytics.* e concedido somente em T151 (US8), depois que
-- as views existirem. LOGIN e senha da role sao operacionais, definidos fora
-- de migracao versionada (segredo nao entra em SQL commitado).
CREATE SCHEMA IF NOT EXISTS "audit";
CREATE SCHEMA IF NOT EXISTS "analytics";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tableau_ro') THEN
    CREATE ROLE "tableau_ro" NOLOGIN;
  END IF;
END
$$;
