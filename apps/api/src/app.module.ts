import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { CsrfGuard } from './common/guards/csrf.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditContextInterceptor } from './common/interceptors/audit-context.interceptor';
import { CommonModule } from './common/common.module';
import { EvidenceModule } from './evidence/evidence.module';
import { ExportModule } from './export/export.module';
import { FormsModule } from './forms/forms.module';
import { HealthController } from './health/health.controller';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { ValidationModule } from './validation/validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    // Rate limiting global (Secao "Seguranca" do PROMPT.md): limite generoso
    // por padrao, sobrescrito com um limite mais estrito no login via
    // @Throttle (Fase 12 — achado HIGH da revisao de seguranca: forca bruta
    // em POST /auth/login sem nenhum rate limiting).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
    CommonModule,
    UsersModule,
    AuthModule,
    AdminModule,
    AuditModule,
    FormsModule,
    LifecycleModule,
    ReportsModule,
    EvidenceModule,
    ValidationModule,
    ExportModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Sessao virou cookie enviado automaticamente pelo navegador (F16.2), o
    // que reabre CSRF — roda apos os guards de autenticacao/autorizacao.
    { provide: APP_GUARD, useClass: CsrfGuard },
    // Roda apos os guards (req.user ja populado quando autenticado) e antes
    // de qualquer handler — T028/T166.
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
  ],
})
export class AppModule {}
