-- Fase 12 (T170) — FR-123/FR-112: falha de notificacao (servico acessorio)
-- deixa de existir so como logger.error e passa a ser um registro
-- consultavel, com servico/operacao/causa (regra geral de FR-123) e
-- destinatario/transicao afetados (o que FR-112 acrescenta).
--
-- Tabela nova em "public": ja coberta pelo GRANT amplo + ALTER DEFAULT
-- PRIVILEGES de 20260809090000_revoke_dml_on_append_only, que aplica a
-- toda tabela criada por migracao futura executada pela role dona
-- ("formops") — nao precisa de GRANT proprio aqui. Nao e append-only (nao
-- consta na lista de REVOKE UPDATE/DELETE daquela migracao): um registro de
-- falha pode ser corrigido/anotado por operacao administrativa futura sem
-- violar nenhuma garantia de auditoria, ao contrario das seis tabelas
-- append-only propriamente ditas.
CREATE TABLE "notification_failures" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "report_instance_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_failures_report_instance_id_idx" ON "notification_failures"("report_instance_id");

-- AddForeignKey
ALTER TABLE "notification_failures" ADD CONSTRAINT "notification_failures_report_instance_id_fkey" FOREIGN KEY ("report_instance_id") REFERENCES "report_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
