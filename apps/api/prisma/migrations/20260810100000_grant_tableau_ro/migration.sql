-- Fase 10 (T151) — contracts/analytics-layer.md, secao "Acesso":
-- tableau_ro so pode ler "analytics"; a role da aplicacao ("formops_app")
-- nao pode ler "analytics" (a aplicacao nao le a propria projecao,
-- FR-118). ALTER DEFAULT PRIVILEGES cobre view/tabela futura criada pela
-- role dona ("formops") no schema analytics — a proxima migracao
-- (v_load_marker, T156) ja nasce visivel a tableau_ro sem precisar repetir
-- o GRANT.
GRANT USAGE ON SCHEMA "analytics" TO "tableau_ro";
GRANT SELECT ON ALL TABLES IN SCHEMA "analytics" TO "tableau_ro";
ALTER DEFAULT PRIVILEGES IN SCHEMA "analytics" GRANT SELECT ON TABLES TO "tableau_ro";

-- Defesa em profundidade: "formops_app" nunca recebeu GRANT em "analytics"
-- (20260809090000_revoke_dml_on_append_only so tocou "public"/"audit"), mas
-- o REVOKE explicito documenta a garantia no proprio SQL versionado em vez
-- de depender so da ausencia de um GRANT anterior.
REVOKE ALL ON SCHEMA "analytics" FROM "formops_app";
REVOKE ALL ON ALL TABLES IN SCHEMA "analytics" FROM "formops_app";
