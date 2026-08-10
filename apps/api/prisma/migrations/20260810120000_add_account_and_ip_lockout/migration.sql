-- Fase 11 (T159, FR-009, SC-017) — bloqueio automatico por tentativas
-- malsucedidas de login: primario por conta, secundario por endereco de
-- origem com limiar mais alto/janela curta e lista de excecao por unidade.
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "account_locked_until" TIMESTAMP(3);

ALTER TABLE "units" ADD COLUMN "known_egress_ips" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "ip_login_lockouts" (
    "id" TEXT NOT NULL,
    "source_ip" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_login_lockouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ip_login_lockouts_source_ip_key" ON "ip_login_lockouts"("source_ip");
