# Graph Report - .  (2026-07-30)

## Corpus Check
- 292 files · ~68,328 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1478 nodes · 3532 edges · 95 communities (68 shown, 27 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Form Templates & Topics DTOs
- Form Indicators DTOs
- Admin Module & User DTOs
- Security Notes & Risk Acceptance
- API Package Dependencies
- App Shell, Auth Context & Protected Routes
- Users API Client (Web)
- Admin Services Specs & Common Module
- Unit Admin DTOs & Controller
- Auth Controller & Login DTO
- Roles, Unit Access & Report Query DTO
- Service Orchestration CLI (manage.js)
- Forms API Client & Indicator Score Panel
- Auth/Evidence/Export/Validation API Clients
- Shared UI Components (Table, Modal, EmptyState)
- Report Edit Access & Authenticated User
- Report Deadline & Score Trend
- App Shell & Admin Layout
- API TypeScript Config
- Button/Field/Select UI Components
- Platform Settings DTO Validation
- Business Days & SLA Cron
- Units Management UI
- ecc-universal Package Config
- Demo Seed & Formula Evaluator
- Web Package Dependencies
- Indicator/Validation Cards & Toast
- Web TypeScript Config
- API Dev Dependencies
- Web Dev Dependencies (Testing/Tailwind)
- Report Instances API & Dashboard UI
- Indicator Form Modal & Validation Verdict
- Report Export Controller & CSV DTO
- Email Templates & Notifications
- Page Test Fixtures & Providers
- Email Service
- S3 Storage Service & Validation Service
- Root NPM Scripts
- Platform Settings UI Panels
- Seed Templates N1/N3
- Auth Module & Env Validation
- Jest Coverage Config
- Current User Decorator & Validation Controller
- NestJS Module Wiring (Export/Lifecycle/Notifications)
- Prisma Init Schema Migration
- Evidence Upload Constants & Validation DTO
- CSV/Naming Pattern Export Utilities
- Web Package Manifest
- Evidence Controller
- Vite Node TypeScript Config
- Toast Context
- Health Check & Public Decorator
- Form Topic Modal UI
- Prisma Audit Trigger Migration
- Proprietary Seed Data
- JWT Auth Guard
- Roles Guard
- Indicator Responses Controller
- Seed Package Manifest
- Vite Config & Root Env
- Nest CLI Config
- Prisma System Settings Migration
- App Bootstrap (main.ts)
- Vitest Jest-DOM Types
- Common Module
- Prisma Module
- AGIR Logo Asset & Rationale
- Blob Download Utility
- Docker Entrypoint Script
- Dependency: @nestjs/cli
- Dependency: ts-loader
- Dependency: ts-node
- Dependency: @types/bcryptjs
- Dependency: @types/express
- Dependency: @types/jest
- Dependency: @types/node
- Dependency: @types/nodemailer
- Prisma Score/SLA Settings Migration
- Prisma Indicator Response Migration (Score Snapshot)
- Prisma Indicator Response Migration (Analysis/Plan)
- Reports Module
- SPA Entry Point (index.html)
- Dependency: autoprefixer
- Dependency: @eslint/js
- Dependency: eslint-plugin-react-refresh
- Dependency: globals
- Dependency: @types/react
- Dependency: @types/react-dom
- Dependency: typescript
- Dependency: vitest
- Dependency: @vitest/coverage-v8

## God Nodes (most connected - your core abstractions)
1. `AuthenticatedUser` - 62 edges
2. `PrismaService` - 57 edges
3. `apiSend()` - 53 edges
4. `cn()` - 48 edges
5. `useToast()` - 43 edges
6. `apiGet()` - 31 edges
7. `renderWithProviders()` - 27 edges
8. `Roles()` - 26 edges
9. `Button` - 26 edges
10. `NotificationsService` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Mensageria Transacional Azure` --conceptually_related_to--> `E-mail via SMTP/Nodemailer (Stack)`  [AMBIGUOUS]
  docs/PROMPT.md → README.md
- `apps/api — NestJS API` --conceptually_related_to--> `apps/api (NestJS + Prisma)`  [INFERRED]
  README.md → CLAUDE.md
- `apps/web — SPA React` --conceptually_related_to--> `apps/web (Vite + React + TypeScript)`  [INFERRED]
  README.md → CLAUDE.md
- `Orquestrador NPM (scripts/manage.js)` --conceptually_related_to--> `scripts/manage.js — Orquestrador de Serviços`  [INFERRED]
  README.md → CLAUDE.md
- `Estratégia de Deploy e Migrações Automatizadas` --conceptually_related_to--> `Prisma ORM (generate/migrate)`  [INFERRED]
  docs/PROMPT.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Processo de Documentação de Riscos de Segurança Aceitos** — claude_doc, apps_api_security_notes_doc, apps_web_security_notes_doc [INFERRED 0.85]
- **Topologia de Serviços Docker Compose** — docker_compose_postgres_service, docker_compose_minio_service, docker_compose_api_service, docker_compose_web_service [EXTRACTED 1.00]
- **Governança RBAC (Spec, README, Enforcement Frontend)** — docs_prompt_rbac_roles, readme_rbac_table, apps_web_security_notes_rbac_frontend_ux [INFERRED 0.85]

## Communities (95 total, 27 thin omitted)

### Community 0 - "Form Templates & Topics DTOs"
Cohesion: 0.06
Nodes (32): CreateFormTemplateDto, IsNotEmpty, IsOptional, IsString, CreateFormTopicDto, IsInt, IsNotEmpty, IsOptional (+24 more)

### Community 1 - "Form Indicators DTOs"
Cohesion: 0.06
Nodes (35): CreateFormIndicatorDto, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional (+27 more)

### Community 2 - "Admin Module & User DTOs"
Cohesion: 0.08
Nodes (26): AdminModule, Module, CreateUserDto, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID (+18 more)

### Community 3 - "Security Notes & Risk Acceptance"
Cohesion: 0.05
Nodes (51): Mitigação CSV/Excel Formula Injection, escapeHtml() — Mitigação HTML Injection, EVIDENCE_MIME_TYPE_FILTER, helmet() — Security Headers Bootstrap, MAX_EVIDENCE_UPLOAD_BYTES (10MB), Risco Aceito: CVEs HIGH em multer (via @nestjs/platform-express), Risco Aceito: CVEs HIGH em nodemailer ^6.9.16, sanitizeHeaderValue() — Mitigação CRLF Injection (+43 more)

### Community 4 - "API Package Dependencies"
Cohesion: 0.05
Nodes (43): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, bcryptjs, class-transformer, class-validator, helmet, @nestjs/common (+35 more)

### Community 5 - "App Shell, Auth Context & Protected Routes"
Cohesion: 0.08
Nodes (25): baseUser, Props, ProtectedRoute(), mockUser, brand, BrandColors, BrandColorScale, BrandConfig (+17 more)

### Community 6 - "Users API Client (Web)"
Cohesion: 0.12
Nodes (29): activateUser(), createUser(), CreateUserInput, deactivateUser(), getUser(), grantUnitAccess(), listUsers(), resetPassword() (+21 more)

### Community 7 - "Admin Services Specs & Common Module"
Cohesion: 0.10
Nodes (8): hashMock, ORG_WIDE_READ_ROLES, Injectable, UnitAccessService, ReportLifecycleService, Injectable, PrismaService, Injectable

### Community 8 - "Unit Admin DTOs & Controller"
Cohesion: 0.11
Nodes (17): CreateUnitDto, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, UpdateUnitDto, Body (+9 more)

### Community 9 - "Auth Controller & Login DTO"
Cohesion: 0.09
Nodes (17): AuthController, Body, Controller, Post, AuthService, compareMock, Injectable, LoginDto (+9 more)

### Community 10 - "Roles, Unit Access & Report Query DTO"
Cohesion: 0.10
Nodes (16): Roles(), ListReportInstancesQueryDto, IsEnum, IsIn, IsOptional, IsString, IsUUID, ReportInstancesController (+8 more)

### Community 11 - "Service Orchestration CLI (manage.js)"
Cohesion: 0.16
Nodes (33): checkPort(), commandDeploy(), commandRestart(), commandSeed(), commandSeedDemo(), commandStart(), commandStatus(), commandSummary() (+25 more)

### Community 12 - "Forms API Client & Indicator Score Panel"
Cohesion: 0.16
Nodes (27): activateFormIndicator(), activateFormTemplate(), activateFormTopic(), createFormTemplate(), deactivateFormIndicator(), deactivateFormTemplate(), deactivateFormTopic(), distributeIndicatorScores() (+19 more)

### Community 13 - "Auth/Evidence/Export/Validation API Clients"
Cohesion: 0.13
Nodes (20): fetchCurrentUser(), login(), getEvidenceDownloadUrl(), exportReportInstance(), updateIndicatorResponseValues(), uploadIndicatorEvidence(), uploadValidationEvidence(), validateIndicator() (+12 more)

### Community 14 - "Shared UI Components (Table, Modal, EmptyState)"
Cohesion: 0.16
Nodes (24): ModalState, IndicatorModalState, Props, TopicModalState, EmptyState(), Props, Props, Spinner() (+16 more)

### Community 15 - "Report Edit Access & Authenticated User"
Cohesion: 0.16
Nodes (10): AuthenticatedUser, assertCanEditReportData(), EvidenceService, Injectable, IsOptional, IsString, UpdateIndicatorResponseDto, IndicatorResponsesService (+2 more)

### Community 16 - "Report Deadline & Score Trend"
Cohesion: 0.13
Nodes (19): listReportInstances(), startCurrentReportInstance(), Props, ScoreTrendChart(), ScoreTrendPoint, toCoordinates(), getRelevantDeadline(), buildLastSixMonthsScoreTrend() (+11 more)

### Community 17 - "App Shell & Admin Layout"
Cohesion: 0.10
Nodes (17): App(), ADMIN_TABS, AdminLayout(), AppShell(), initialsOf(), NAV_ITEMS, PageHeader(), Props (+9 more)

### Community 18 - "API TypeScript Config"
Cohesion: 0.07
Nodes (27): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+19 more)

### Community 19 - "Button/Field/Select UI Components"
Cohesion: 0.09
Nodes (15): ButtonSize, ButtonVariant, Props, sizeClasses, variantClasses, Props, Props, Props (+7 more)

### Community 20 - "Platform Settings DTO Validation"
Cohesion: 0.12
Nodes (15): IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, UpdatePlatformSettingsDto (+7 more)

### Community 21 - "Business Days & SLA Cron"
Cohesion: 0.20
Nodes (15): addBusinessDays(), addDaysUtc(), computeEasterSunday(), getBusinessDayOrdinalInMonth(), getMandatoryNationalHolidays(), getNthBusinessDayOfMonth(), isBusinessDay(), isHoliday() (+7 more)

### Community 22 - "Units Management UI"
Cohesion: 0.16
Nodes (19): activateUnit(), createUnit(), deactivateUnit(), getUnit(), listUnits(), UnitInput, updateUnit(), LEVELS (+11 more)

### Community 23 - "ecc-universal Package Config"
Cohesion: 0.08
Nodes (24): ecc-universal, dependencies, ecc-universal, name, private, scripts, build, deploy (+16 more)

### Community 24 - "Demo Seed & Formula Evaluator"
Cohesion: 0.18
Nodes (12): DEMO_UNITS, DemoUnitConfig, generateAnalysisAndPlan(), generateVariableValues(), main(), prisma, checkCompliance(), evaluateFormula() (+4 more)

### Community 25 - "Web Package Dependencies"
Cohesion: 0.09
Nodes (23): dependencies, clsx, @fontsource/inter, @fontsource/jetbrains-mono, lucide-react, react, react-dom, react-hook-form (+15 more)

### Community 26 - "Indicator/Validation Cards & Toast"
Cohesion: 0.25
Nodes (17): IndicatorResponseCard(), Props, useToast(), Props, ValidationIndicatorCard(), formatBytes(), formatDate(), formatDateTime() (+9 more)

### Community 27 - "Web TypeScript Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+14 more)

### Community 28 - "API Dev Dependencies"
Cohesion: 0.10
Nodes (21): devDependencies, jest, @nestjs/schematics, @nestjs/testing, prisma, supertest, ts-jest, @types/multer (+13 more)

### Community 29 - "Web Dev Dependencies (Testing/Tailwind)"
Cohesion: 0.10
Nodes (21): devDependencies, eslint, eslint-plugin-react-hooks, jsdom, postcss, tailwindcss, @testing-library/jest-dom, @testing-library/react (+13 more)

### Community 30 - "Report Instances API & Dashboard UI"
Cohesion: 0.15
Nodes (15): finalizeReportInstance(), getReportInstance(), getReportInstancesOverview(), ListReportsParams, submitForApproval(), submitForReview(), ProgressMeter(), ProgressMeterSegment (+7 more)

### Community 31 - "Indicator Form Modal & Validation Verdict"
Cohesion: 0.14
Nodes (14): createFormIndicator(), FormIndicatorInput, updateFormIndicator(), GOAL_OPERATORS, IndicatorFormModal(), Props, indicator, Modal() (+6 more)

### Community 32 - "Report Export Controller & CSV DTO"
Cohesion: 0.16
Nodes (10): ExportReportQueryDto, IsIn, ReportExportController, Controller, Get, Param, Query, ReportExportService (+2 more)

### Community 33 - "Email Templates & Notifications"
Cohesion: 0.33
Nodes (14): SendEmailInput, buildReportConcludedEmail(), buildReportReprovedEmail(), buildSlaOverdueEmail(), buildSubmittedForApprovalEmail(), buildSubmittedForReviewEmail(), EmailContent, escapeHtml() (+6 more)

### Community 34 - "Page Test Fixtures & Providers"
Cohesion: 0.18
Nodes (10): user, templateWithoutTopics, templateWithTopics, baseResponse, baseResponse, baseSettings, pendingIndicator, renderDetail() (+2 more)

### Community 35 - "Email Service"
Cohesion: 0.19
Nodes (5): EmailService, sendMailMock, Injectable, NotificationsService, Injectable

### Community 36 - "S3 Storage Service & Validation Service"
Cohesion: 0.18
Nodes (5): S3Service, sendMock, Injectable, Injectable, ValidationService

### Community 37 - "Root NPM Scripts"
Cohesion: 0.13
Nodes (15): scripts, build, lint, prisma:generate, prisma:migrate:deploy, prisma:migrate:dev, seed, seed:demo (+7 more)

### Community 38 - "Platform Settings UI Panels"
Cohesion: 0.32
Nodes (10): getPlatformSettings(), updatePlatformSettings(), PlatformNamingPanel(), ScoreSettingsPanel(), SlaSettingsPanel(), Button, Field(), Input (+2 more)

### Community 39 - "Seed Templates N1/N3"
Cohesion: 0.22
Nodes (11): N1_TEMPLATE, prisma, N3_TEMPLATE, prisma, distributeScoreWeights(), FormTemplateSeed, IndicatorSeed, seedFormTemplate() (+3 more)

### Community 40 - "Auth Module & Env Validation"
Cohesion: 0.18
Nodes (10): AuthModule, Module, REQUIRED_ENV_VARS, validateEnv(), EvidenceModule, Module, Module, UsersModule (+2 more)

### Community 41 - "Jest Coverage Config"
Cohesion: 0.15
Nodes (13): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+5 more)

### Community 42 - "Current User Decorator & Validation Controller"
Cohesion: 0.23
Nodes (9): Get, CurrentUser, Body, Controller, Param, Post, UploadedFile, UseInterceptors (+1 more)

### Community 43 - "NestJS Module Wiring (Export/Lifecycle/Notifications)"
Cohesion: 0.26
Nodes (8): ExportModule, Module, LifecycleModule, Module, NotificationsModule, Module, StorageModule, Module

### Community 44 - "Prisma Init Schema Migration"
Cohesion: 0.42
Nodes (11): "audit_logs", "evidence_files", "form_indicators", "form_templates", "form_topics", "indicator_responses", "report_instances", "units" (+3 more)

### Community 45 - "Evidence Upload Constants & Validation DTO"
Cohesion: 0.23
Nodes (7): ALLOWED_EVIDENCE_MIME_TYPES, EVIDENCE_MIME_TYPE_FILTER(), IsEnum, IsNotEmpty, IsString, MinLength, ValidateIndicatorDto

### Community 46 - "CSV/Naming Pattern Export Utilities"
Cohesion: 0.24
Nodes (7): buildCsv(), CsvCell, escapeCsvField(), interpolateNamingPattern(), ExportFile, ReportForExport, VEREDICTO_BY_STATUS

### Community 47 - "Web Package Manifest"
Cohesion: 0.17
Nodes (11): name, private, scripts, build, dev, lint, preview, test (+3 more)

### Community 48 - "Evidence Controller"
Cohesion: 0.20
Nodes (7): EvidenceController, Controller, Get, Param, Post, UploadedFile, UseInterceptors

### Community 49 - "Vite Node TypeScript Config"
Cohesion: 0.20
Nodes (9): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, include (+1 more)

### Community 50 - "Toast Context"
Cohesion: 0.25
Nodes (8): generateId(), ToastContext, ToastContextValue, ToastItem, ToastProvider(), ToastTone, toneClasses, toneIcons

### Community 51 - "Health Check & Public Decorator"
Cohesion: 0.36
Nodes (4): Public(), HealthController, Controller, Get

### Community 52 - "Form Topic Modal UI"
Cohesion: 0.39
Nodes (6): createFormTopic(), updateFormTopic(), Props, topic, TopicFormModal(), FormTopic

### Community 53 - "Prisma Audit Trigger Migration"
Cohesion: 0.43
Nodes (6): evidence_files, fn_prevent_audit_log_mutation(), fn_write_audit_log(), trg_audit_evidence_files, trg_audit_indicator_responses, trg_audit_logs_immutable

### Community 54 - "Proprietary Seed Data"
Cohesion: 0.43
Nodes (6): DEV_ROLE_USERS, ensureDevRoleUsers(), ensureInitialAdmin(), ensureMatrizUnit(), main(), prisma

### Community 57 - "Indicator Responses Controller"
Cohesion: 0.29
Nodes (5): IndicatorResponsesController, Body, Controller, Param, Patch

### Community 58 - "Seed Package Manifest"
Cohesion: 0.33
Nodes (5): name, prisma, seed, private, version

### Community 59 - "Vite Config & Root Env"
Cohesion: 0.33
Nodes (3): defineEnv, RootEnv, { webPort, enableHttps, sslKeyPath, sslCertPath, viteVars }

### Community 60 - "Nest CLI Config"
Cohesion: 0.50
Nodes (3): collection, $schema, sourceRoot

### Community 61 - "Prisma System Settings Migration"
Cohesion: 0.50
Nodes (3): "form_indicators", "report_instances", "system_settings"

### Community 63 - "Vitest Jest-DOM Types"
Cohesion: 0.50
Nodes (3): Assertion, AsymmetricMatchersContaining, @vitest/expect

### Community 64 - "Common Module"
Cohesion: 0.67
Nodes (3): CommonModule, Global, Module

### Community 65 - "Prisma Module"
Cohesion: 0.67
Nodes (3): PrismaModule, Global, Module

### Community 66 - "AGIR Logo Asset & Rationale"
Cohesion: 1.00
Nodes (3): AGIR White Logo Asset (logo-agir-branco.png), brand.logo.dark asset reference ('/logo-agir-branco.png'), Light-background logo variant deliberately omitted to avoid invisible white-on-white logo

## Ambiguous Edges - Review These
- `E-mail via SMTP/Nodemailer (Stack)` → `Mensageria Transacional Azure`  [AMBIGUOUS]
  docs/PROMPT.md · relation: conceptually_related_to
- `api/SECURITY-NOTES.md` → `Trilha de Auditoria Contínua (Audit Trail via Trigger)`  [AMBIGUOUS]
  docs/PROMPT.md · relation: conceptually_related_to

## Knowledge Gaps
- **326 isolated node(s):** `docker-entrypoint.sh script`, `$schema`, `collection`, `sourceRoot`, `name` (+321 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `E-mail via SMTP/Nodemailer (Stack)` and `Mensageria Transacional Azure`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `api/SECURITY-NOTES.md` and `Trilha de Auditoria Contínua (Audit Trail via Trigger)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Roles()` connect `Roles, Unit Access & Report Query DTO` to `Form Templates & Topics DTOs`, `Form Indicators DTOs`, `Admin Module & User DTOs`, `Unit Admin DTOs & Controller`, `Current User Decorator & Validation Controller`, `Evidence Upload Constants & Validation DTO`, `Report Edit Access & Authenticated User`, `Evidence Controller`, `Platform Settings DTO Validation`, `Indicator Responses Controller`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `Admin Services Specs & Common Module` to `Form Templates & Topics DTOs`, `Form Indicators DTOs`, `Admin Module & User DTOs`, `Email Templates & Notifications`, `Email Service`, `S3 Storage Service & Validation Service`, `Unit Admin DTOs & Controller`, `Auth Controller & Login DTO`, `CSV/Naming Pattern Export Utilities`, `Report Edit Access & Authenticated User`, `Platform Settings DTO Validation`, `Business Days & SLA Cron`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `AuthenticatedUser` connect `Report Edit Access & Authenticated User` to `Report Export Controller & CSV DTO`, `S3 Storage Service & Validation Service`, `Admin Services Specs & Common Module`, `Auth Controller & Login DTO`, `Current User Decorator & Validation Controller`, `Roles, Unit Access & Report Query DTO`, `Evidence Upload Constants & Validation DTO`, `CSV/Naming Pattern Export Utilities`, `Evidence Controller`, `Business Days & SLA Cron`, `Indicator Responses Controller`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `docker-entrypoint.sh script`, `$schema`, `collection` to the rest of the system?**
  _326 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Form Templates & Topics DTOs` be split into smaller, more focused modules?**
  _Cohesion score 0.06151062867480778 - nodes in this community are weakly interconnected._