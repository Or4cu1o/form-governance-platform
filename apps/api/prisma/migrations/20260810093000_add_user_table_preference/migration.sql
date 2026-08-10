-- T119a/FR-090: ordenacao e visibilidade de coluna da area de auditoria sao
-- apresentacao, nunca filtro — persistidas por usuario e por tabela. Nao e
-- append-only (preferencia de tela, nao acervo): coberta pelo GRANT amplo +
-- ALTER DEFAULT PRIVILEGES de 20260809090000_revoke_dml_on_append_only, sem
-- entrar na lista de REVOKE UPDATE/DELETE daquela migracao.
CREATE TABLE "user_table_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "table_key" TEXT NOT NULL,
    "column_order" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hidden_columns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_table_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_table_preferences_user_id_table_key_key" ON "user_table_preferences"("user_id", "table_key");

-- AddForeignKey
ALTER TABLE "user_table_preferences" ADD CONSTRAINT "user_table_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
