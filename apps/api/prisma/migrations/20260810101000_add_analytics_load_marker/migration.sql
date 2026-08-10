-- Fase 10 (T156) — FR-121: marcador de ultima carga exposto ao BI.
-- Enquanto as views permanecerem nao materializadas (research.md D11), a
-- "carga" e a propria leitura — nao existe rotina de ETL que preencha uma
-- tabela separada. "now()" dentro de uma VIEW comum (nao materializada)
-- avalia a cada SELECT, entao loaded_at reflete o instante da consulta,
-- exatamente como o contrato exige. Se um dia a camada for materializada,
-- o contrato exposto ao painel (mesmas duas colunas) e o mesmo — so a
-- fonte de loaded_at muda, para o instante do ultimo REFRESH MATERIALIZED
-- VIEW, sem quebrar quem ja consome esta view (T156a).
--
-- Nasce com SELECT ja concedido a "tableau_ro" via ALTER DEFAULT
-- PRIVILEGES da migracao anterior (20260810100000_grant_tableau_ro).
CREATE VIEW "analytics"."v_load_marker" AS
SELECT
  now() AS "loaded_at",
  'NAO_MATERIALIZADO' AS "load_mode";
