# Changelog

Todas as mudanças notáveis do projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota
[Versionamento Semântico](https://semver.org/lang/pt-BR/). Este arquivo passou a ser mantido a
partir da execução de `/speckit-implement` sobre `specs/001-plataforma-formops-base/tasks.md`
(2026-08-08) — o histórico anterior a essa data está no `git log`, não reconstruído aqui.

## [Unreleased]

### Added

- Custódia de chave de selagem Ed25519 (`KeyCustodyService`): carregamento por referência a
  arquivo, nunca por variável de ambiente, com suporte a chaves aposentadas (`retired/*.pub.pem`).
- Provisionamento automático de dois buckets de evidência com ciclo de vida distinto: imutável
  (`ObjectLockEnabledForBucket` na criação, modo Compliance) e quarentena (sem lock, expiração de
  30 dias) — `apps/api/scripts/provision-buckets.ts`.
- Serviço ClamAV integrado ao `docker-compose.yml` e ao orquestrador `scripts/manage.js`.
- Suporte a `multiSchema` do Prisma (`public`, `audit`, `analytics`), preparando a separação da
  trilha de auditoria e da camada analítica read-only do restante do modelo.
- Catálogo canônico de indicadores (`IndicatorCatalog`), identidade estável de uma métrica entre
  formulários distintos.
- Versionamento append-only de resposta de indicador (`IndicatorResponseVersion`), com índice único
  parcial garantindo no máximo uma versão corrente por resposta — `IndicatorResponse` deixa de
  sofrer `UPDATE` in place e passa a ser identidade estável.
- Registro de submissão por envio (`ReportSubmission`), substituindo os campos únicos de
  pontualidade de `ReportInstance`, que sobrescreviam o envio anterior a cada reenvio.
- Trilha de leitura sensível (`AccessLog`, schema `audit`) e selo de integridade de exportação
  (`ExportSeal`/`ExportSealRevocation`), ainda sem serviço de aplicação (schema apenas).
- Sete parâmetros operacionais novos em `SystemSetting` (retenção de evidência, feriados
  facultativos, limites de amplitude de consulta de auditoria, regra de outlier, guarda pericial).

- `AuditContextService` (`AsyncLocalStorage`), substituindo `PrismaService.runWithAuditActor`:
  toda escrita auditada agora carrega contexto de requisição completo (usuário, IP, User-Agent,
  origem, request ID, snapshots de nome/cargo/perfil/unidade), não apenas o `userId`.
- `AuditContextInterceptor`, registrado globalmente, popula o contexto de auditoria a partir da
  requisição HTTP autenticada antes de qualquer handler rodar.
- `SystemActor` (`system-actor.ts`): contexto de auditoria para escrita sem requisição HTTP (cron
  do motor de SLA, scripts de seed), sempre com `actorNameSnapshot` identificável e nunca autoria
  nula — mesmo com `userId` ausente.
- `AccessLogService` + `AuditModule`: registro de leitura sensível (consulta de auditoria,
  exportação, download de evidência, verificação de selo, tentativas de login), com filtros, escopo
  e volume gravados na íntegra.
- `absence.util.ts`: as cinco representações físicas de ausência de indicador (valor apurado, zero
  medido, N/A fora do nível, N/A indicador inativo, não preenchido) como classificação pura e
  testada — fundação para a matriz esparsa da auditoria e as views analíticas.
- `apps/api/src/prisma/audit-actor.spec.ts` e `audit-trigger-coverage.spec.ts`: testes de
  integração provando que escrita sem contexto é rejeitada pelo banco e que todas as tabelas
  auditáveis têm o gatilho de auditoria.
- Sessão em cookie `HttpOnly` (F16.2): o JWT deixa de residir em armazenamento acessível a script.
  `apps/api/src/auth/session-cookies.constants.ts` nomeia os dois cookies (`formops_access_token`,
  `formops_csrf_token`); `JwtStrategy` lê o token do cookie em vez do header `Authorization`.
- `CsrfGuard` (`apps/api/src/common/guards/`), global: esquema de submissão dupla — toda rota de
  escrita autenticada exige que o header `x-csrf-token` ecoe o cookie CSRF (legível por JS,
  deliberadamente sem `HttpOnly`). Rota `@Public()` e método seguro (GET/HEAD/OPTIONS) são isentos.
- `POST /auth/logout` e `POST /auth/refresh`: com o token em cookie `HttpOnly`, o cliente não
  consegue mais apagá-lo nem inspecionar sua expiração — encerrar e renovar a sessão viram
  operações de servidor.
- `AuthController.login` grava `AccessLog` (`LOGIN_SUCESSO`/`LOGIN_FALHA`) em toda tentativa de
  autenticação, bem-sucedida ou não (FR-073).
- `apps/web/src/lib/csrf.ts`: lê o cookie CSRF via `document.cookie` e o expõe para `api-client.ts`
  ecoar no header das requisições de escrita.
- Role de banco `formops_app` (T035), privilégio mínimo — sem posse de tabela, sem `UPDATE`/`DELETE`
  em `indicator_response_version`, `validation_records`, `audit.audit_logs`, `audit.access_log`,
  `export_seal` e `export_seal_revocation`. `apps/api/scripts/provision-app-role.ts` provisiona
  `LOGIN`/senha fora da migração versionada (mesmo padrão de `tableau_ro`, T020), chamado por
  `scripts/manage.js` e `apps/api/docker-entrypoint.sh` após `prisma migrate deploy`.
- `apps/api/src/prisma/append-only.spec.ts` e `no-physical-delete.spec.ts` (T036/T037): provam a
  recusa por privilégio nas seis tabelas append-only e a ausência de rota `DELETE` para usuário,
  unidade e evidência (FR-047, FR-067, FR-070).

### Changed

- `AuditLog` movido do schema `public` para `audit`, com contexto de requisição
  (`sourceIp`, `userAgent`, `origin`, `requestId`) e snapshots de autoria (`nome`, `cargo`, `perfil`,
  `unidade` à época do evento) — FR-069.
- O gatilho de auditoria (`fn_write_audit_log`) passa a **rejeitar** qualquer escrita sem
  `app.origin` de sessão definida, em vez de gravar silenciosamente com autor nulo.
- Cobertura do gatilho de auditoria estendida de 2 para 10 tabelas: `users`, `units`,
  `user_unit_access`, `form_templates`, `form_topics`, `form_indicators`, `system_settings` e
  `validation_records`, além de `indicator_responses`/`evidence_files` já cobertas.
- Os 5 pontos de escrita que usavam `PrismaService.runWithAuditActor` (`validation.service.ts`,
  `indicator-responses.service.ts`, `report-instances.service.ts`, `evidence.service.ts`) migrados
  para `AuditContextService.runWithAuditContext`; `runWithAuditActor` removido (zero chamadores).
- `ReportLifecycleService.openPeriodForUnit` (abertura automática/manual de período) e o cron do
  motor de SLA agora escrevem sob contexto de auditoria — sem isso a nova cobertura do gatilho
  rejeitaria a criação de `IndicatorResponse` na abertura de período.
- `POST /auth/login` não retorna mais `accessToken` no corpo — a sessão viaja inteiramente por
  cookie; o corpo passa a conter só `{ user }`.
- `apps/web/src/lib/api-client.ts` troca o header `Authorization: Bearer` por `credentials: 'include'`
  em todo `fetch`, e anexa `x-csrf-token` nas requisições de escrita.
- `apps/web/src/context/AuthContext.tsx` sempre consulta `GET /auth/me` no mount em vez de checar
  um token local — o cookie `HttpOnly` não é legível pelo JavaScript, então a única forma de saber
  se há sessão válida é perguntar ao servidor.
- CORS deixa de ter ramo aberto (`enableCors()` sem opções): `CORS_ORIGIN` virou obrigatória em
  `env.validation.ts` (falha no boot se ausente) e `main.ts` sempre define `credentials: true` —
  requisição com cookie de sessão é incompatível com `Access-Control-Allow-Origin: *` (T171,
  concluída junto com T032 por ser pré-requisito funcional dela, não tarefa separada).
- `apps/api/src/prisma/prisma.service.ts` conecta via `APP_DATABASE_URL` (role `formops_app`) em vez
  de `DATABASE_URL` (role `formops`, dona das tabelas, agora reservada a migração/seed) — sem essa
  troca o `REVOKE` de T035 não protegeria nada em runtime, já que toda escrita da aplicação passa por
  este client. `APP_DATABASE_URL` virou obrigatória em `env.validation.ts`.

### Fixed

- `EvidenceFile.bucket` e `FormIndicator.catalogEntryId`, antes ausentes, agora obrigatórios e
  preenchidos em todos os pontos de escrita (`EvidenceService`, `ValidationService`,
  `FormIndicatorsService`, seeds) — sem esse ajuste o build e os seeds quebravam silenciosamente em
  runtime, já que `prisma/` está fora do escopo de type-check do Nest.
- Dois `IndicatorResponse.upsert` em `seed-demo.ts` sem `updatedAt` (obrigatório desde a remoção de
  `@updatedAt` do schema) — bug latente que só o type-check real do `ts-node` revelou, não o build
  do Nest.

### Removed

- `apps/web/src/lib/token-storage.ts`: sem sucessor — a sessão em cookie `HttpOnly` não deixa nada
  para o cliente guardar.

## Fases do Spec Kit (`specs/001-plataforma-formops-base/`)

Referência cruzada para quem navega por commit em vez de por `tasks.md`:

- **Fase 1 — Setup** (T001-T009): concluída. `multiSchema`, dependências de selagem/antivírus,
  custódia de chave, provisionamento de buckets.
- **Fase 2 — Foundational** (T010-T040): quase concluída. Correções de modelo e entidades novas
  aplicadas (T010-T019); migrações SQL aplicadas e verificadas contra Postgres real (T020-T025);
  contexto e trilha de auditoria completos (T026-T030a); sessão em cookie concluída (T031-T034);
  revogação de DML concluída (T035-T037, com segregação de role `formops_app`); restam T039-T040
  (transversais).
- **Fase 12 — Convergência** (T166-T171): T166 e T167 concluídas junto com a Fase 2 (mesma correção,
  dois ângulos, conforme recomendado); T171 concluída junto com T032 (pré-requisito funcional, não
  tarefa separada). T168-T170 pendentes.
