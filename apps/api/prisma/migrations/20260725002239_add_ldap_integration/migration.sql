-- CreateEnum
CREATE TYPE "auth_source" AS ENUM ('LOCAL', 'LDAP');

-- CreateEnum
CREATE TYPE "elevation_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "ldap_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "auth_source" "auth_source" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "ldap_config_id" TEXT,
ADD COLUMN     "ldap_username" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ldap_configs" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "hosts" TEXT[],
    "port" INTEGER NOT NULL DEFAULT 636,
    "use_tls" BOOLEAN NOT NULL DEFAULT true,
    "bind_dn" TEXT NOT NULL,
    "bind_password_encrypted" TEXT NOT NULL,
    "base_dn" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ldap_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ldap_group_mappings" (
    "id" TEXT NOT NULL,
    "ldap_config_id" TEXT NOT NULL,
    "group_dn" TEXT NOT NULL,
    "role" "role_name" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ldap_group_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_elevation_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requested_role" "role_name" NOT NULL,
    "status" "elevation_status" NOT NULL DEFAULT 'PENDING',
    "source_group_dn" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_elevation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ldap_configs_domain_key" ON "ldap_configs"("domain");

-- CreateIndex
CREATE INDEX "ldap_configs_unit_id_idx" ON "ldap_configs"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "ldap_group_mappings_ldap_config_id_group_dn_role_key" ON "ldap_group_mappings"("ldap_config_id", "group_dn", "role");

-- CreateIndex
CREATE INDEX "role_elevation_requests_user_id_status_idx" ON "role_elevation_requests"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_ldap_config_id_ldap_username_key" ON "users"("ldap_config_id", "ldap_username");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_ldap_config_id_fkey" FOREIGN KEY ("ldap_config_id") REFERENCES "ldap_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ldap_configs" ADD CONSTRAINT "ldap_configs_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ldap_group_mappings" ADD CONSTRAINT "ldap_group_mappings_ldap_config_id_fkey" FOREIGN KEY ("ldap_config_id") REFERENCES "ldap_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_elevation_requests" ADD CONSTRAINT "role_elevation_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_elevation_requests" ADD CONSTRAINT "role_elevation_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

