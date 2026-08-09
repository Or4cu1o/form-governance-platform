-- Fase 3 (T047) — data-model.md D1: "Alterar uma resposta abre versao nova e
-- fecha a anterior com validTo NA MESMA TRANSACAO. UPDATE e DELETE
-- permanecem revogados no banco para a role da aplicacao." As duas frases
-- so coexistem se o fechamento nao for feito pela propria aplicacao: a
-- migracao 20260809090000 (T035) revogou UPDATE/DELETE de "formops_app"
-- sobre "indicator_response_version" — um UPDATE emitido pelo Nest para
-- fechar a versao corrente falharia por privilegio.
--
-- Solucao: funcao de gatilho SECURITY DEFINER, dona "formops" (dona da
-- tabela, ignora ACL). BEFORE INSERT porque nesse momento a nova linha
-- ainda nao existe na tabela — "valid_to IS NULL" so pode casar com a
-- versao verdadeiramente anterior, sem precisar excluir NEW.id da busca.
-- A aplicacao continua fazendo apenas INSERT (privilegio que ela tem); o
-- gatilho, executando como o dono, faz o UPDATE que ela nao pode fazer
-- diretamente — mesmo padrao de "garantia e do banco, nao da disciplina de
-- quem escreve codigo" ja usado no gatilho de auditoria (T025/T027).
CREATE OR REPLACE FUNCTION fn_close_previous_indicator_response_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE "indicator_response_version"
  SET "valid_to" = NEW."valid_from"
  WHERE "indicator_response_id" = NEW."indicator_response_id"
    AND "valid_to" IS NULL;

  RETURN NEW;
END;
$$;

ALTER FUNCTION fn_close_previous_indicator_response_version() OWNER TO "formops";

CREATE TRIGGER trg_close_previous_indicator_response_version
BEFORE INSERT ON "indicator_response_version"
FOR EACH ROW
EXECUTE FUNCTION fn_close_previous_indicator_response_version();
