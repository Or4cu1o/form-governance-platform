import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Conecta pela role de privilegio minimo ("formops_app", T035), nunca pela
  // role de migracao/dona das tabelas ("formops", lida em DATABASE_URL) —
  // sem isso o REVOKE UPDATE/DELETE da migracao nao protege nada em runtime,
  // porque toda escrita da aplicacao passa por este client.
  constructor() {
    super({ datasources: { db: { url: process.env.APP_DATABASE_URL as string } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
