# Tasks: FormOps — Plataforma BASE de Governança de Indicadores de TI (Etapa 1)

**Input**: `specs/001-plataforma-formops-base/` · **Date**: 2026-08-07

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Testes**: **obrigatórios**. A constituição exige cobertura explícita das invariantes e o repositório
já opera com piso de 80% em ambos os workspaces. Toda tarefa `[TEST]` é escrita **antes** da
implementação correspondente e deve falhar antes de passar.

## Leia isto antes de começar

Este **não** é um plano greenfield. O repositório já entrega boa parte de US1–US5. As tarefas abaixo
são de **fechamento de lacuna** e de **correção de desvio**, não de reconstrução. Onde uma tarefa diz
"alterar", o arquivo existe; onde diz "criar", não existe.

Três desvios estruturais herdados, todos endereçados na Fase 2:

1. `IndicatorResponse` sofre `UPDATE` in place (`@updatedAt`) — contraria o Princípio I e FR-068.
2. `ReportInstance` guarda pontualidade em campo único, sobrescrito a cada reenvio — contraria FR-058.
3. Sessão em `sessionStorage` — única **violação** ativa da constituição (Princípio V).

Mais dois, descobertos pela reconciliação de 2026-08-08 e endereçados na **Fase 12**. Ambos são piores
que ausência, porque a infraestrutura existe e passa a impressão de estar funcionando:

4. `PrismaService.runWithAuditActor` está implementado e **não tem um único chamador** — toda escrita
   audita com `user_id = NULL`. A trilha existe, roda, e é anônima de ponta a ponta (T166).
5. O gatilho de auditoria cobre **duas** tabelas de dezenove. Nenhuma alteração administrativa —
   usuário, unidade, acesso, formulário, parâmetro — deixa rastro (T167).

## Format: `[ID] [P?] [Story] Descrição com caminho`

- **[P]**: paralelizável — arquivo distinto, sem dependência pendente
- **[TEST]**: teste, escrito antes da implementação que o satisfaz
- **[Story]**: US1–US8; ausente em Setup, Foundational e Polish
- **ID sufixado** (`T005a`, `T030a`): tarefa inserida por `/speckit-analyze` depois da geração
  original. O sufixo preserva as referências cruzadas do arquivo, que renumerar 165 IDs quebraria.
  `T048` foi **aposentado** — o conteúdo migrou para T030a, na Fase 2

## Path Conventions

Monorepo npm workspaces. Backend em `apps/api/src/<módulo>/`, frontend em `apps/web/src/`.
Testes **co-localizados**: `*.spec.ts` ao lado do fonte na API, `*.test.tsx` na web.

---

## Phase 1: Setup (Infraestrutura compartilhada)

**Objetivo**: habilitar as capacidades que a Fase 2 pressupõe. Nenhuma regra de negócio aqui.

- [x] T001 Habilitar `previewFeatures = ["multiSchema"]` e declarar `schemas = ["public", "audit", "analytics"]` nos blocos `generator`/`datasource` de `apps/api/prisma/schema.prisma` — todos os 13 modelos e 7 enums anotados com `@@schema("public")`
- [x] T002 Verificar em execução que `multiSchema` funciona na versão de Prisma instalada e registrar o resultado em `specs/001-plataforma-formops-base/research.md` (D4) — confirmado com `npx prisma validate` na CLI 5.22.0 pinada; achado colateral sobre `npx` sem `node_modules` local registrado no mesmo item
- [x] T003 [P] Adicionar dependências de selagem e saída a `apps/api/package.json`: `qrcode` e `pdfkit`; bibliotecas registradas em `research.md` (D3)
- [x] T004 [P] Adicionar cliente de antivírus (`clamscan`) a `apps/api/package.json` e o serviço `clamav` a `docker-compose.yml`
- [x] T005 [P] Declaradas em `apps/api/src/config/env.validation.ts`: `SEALING_PRIVATE_KEY_PATH`, `SEALING_KEY_ID`, `EVIDENCE_RESOLVER_HMAC_SECRET`, `S3_BUCKET_QUARANTINE`, `S3_BUCKET_IMMUTABLE`, `CLAMAV_HOST`, `CLAMAV_PORT`
- [x] T005a Criado `apps/api/src/sealing/key-custody.service.ts` e o `.spec.ts`: chave carregada de arquivo referenciado (nunca do valor da env var), acesso registrado via `Logger`, chaves aposentadas resolvíveis a partir de `retired/<keyId>.pub.pem`
- [x] T006 [P] Estendido `apps/api/src/config/env.validation.spec.ts` [TEST] com um caso por variável nova, todas passando
- [x] T007 `docker-compose.yml` + `scripts/manage.js` + `apps/api/scripts/provision-buckets.ts`: bucket imutável criado com `ObjectLockEnabledForBucket: true` **na criação** (`research.md`, D7)
- [x] T008 Bucket de quarentena criado sem lock, com `PutBucketLifecycleConfiguration` de expiração em 30 dias, na mesma rotina `provision-buckets.ts` chamada por `waitAndProvisionBuckets()` em `scripts/manage.js`
- [x] T009 [P] Documentado em `.env.example` e `README.md` (seção "Custódia da chave de selagem (Ed25519)") — geração via `node:crypto`, referência apenas por caminho, procedimento de rotação preservando a chave pública aposentada

**Checkpoint**: infraestrutura pronta. `npm run docker:up` sobe com os dois buckets e o antivírus.

---

## Phase 2: Foundational (Pré-requisitos bloqueantes)

**⚠️ CRÍTICO**: nenhuma história pode começar antes desta fase fechar. Ela transforma as garantias
constitucionais de disciplina de código em garantia do banco.

**Ordem da migração**: os passos seguem `data-model.md` §Ordem de migração. O passo que revoga DML
(T035) é o **último** — revogar antes quebra os passos anteriores.

### Correções de modelo (data-model.md, Parte A)

- [x] T010 Alterar `apps/api/prisma/schema.prisma`: `IndicatorResponse` perde `@updatedAt` e passa a ser a identidade estável, ganhando `currentVersionId String?` (§A1)
- [x] T011 Alterar `apps/api/prisma/schema.prisma`: adicionar `User.jobTitle` (§A4)
- [x] T012 Alterar `apps/api/prisma/schema.prisma`: `EvidenceFile` ganha `scanStatus`, `scannedAt`, `scanEngineVersion`, `bucket`, `retainUntil`, `retentionMode`, `forensicHoldUntil`, `deactivatedByUserId`, `deactivatedAt` (§A5)
- [x] T013 Alterar `apps/api/prisma/schema.prisma`: `FormIndicator.catalogEntryId` obrigatório, com relação a `IndicatorCatalog` (§A6)
- [x] T014 Alterar `apps/api/prisma/schema.prisma`: `SystemSetting` ganha os sete parâmetros novos — `evidenceRetentionYears`, `includeOptionalHolidays`, `auditMaxRangeMonths`, `auditDetailedMaxRangeMonths`, `auditExactCountThreshold`, `outlierRule`, `forensicHoldYears` (§A7)

### Entidades novas (data-model.md, Parte B)

- [x] T015 [P] Criar o modelo `IndicatorCatalog` em `apps/api/prisma/schema.prisma` (§B1)
- [x] T016 Criar o modelo `IndicatorResponseVersion` em `apps/api/prisma/schema.prisma` com `validFrom`/`validTo`, `overwroteVersionId`, `originLegacy` e índice único parcial `UNIQUE (indicator_response_id) WHERE valid_to IS NULL` (§B2) — o índice parcial em si é criado na migração SQL (T021), o Prisma schema não expressa `WHERE`
- [x] T017 [P] Criar o modelo `ReportSubmission` em `apps/api/prisma/schema.prisma`, substituindo os campos únicos de pontualidade de `ReportInstance` (§B3, §A2)
- [x] T018 [P] Criar o modelo `AccessLog` no schema `audit` em `apps/api/prisma/schema.prisma`, com enum `actorKind` (`USUARIO` | `SISTEMA` | `ANONIMO_DECLARADO`) (§B4)
- [x] T018a [P] Criar os modelos `ExportSeal` e `ExportSealRevocation` em `apps/api/prisma/schema.prisma` (§B5), com `contentDigest`, `artifactDigest`, `signature`, `keyId`, `verificationCode` único, escopo, autoria e emissão; a revogação é entidade separada, jamais coluna do selo
- [x] T019 Mover `AuditLog` para o schema `audit` e adicionar `sourceIp`, `userAgent`, `origin`, `requestId`, `actorNameSnapshot`, `actorJobTitleSnapshot`, `actorRoleSnapshot`, `actorUnitSnapshot` (§A3, FR-069)

### Migração SQL

- [x] T020 Criar migração `apps/api/prisma/migrations/20260808120000_create_audit_analytics_schemas/migration.sql`: `CREATE SCHEMA audit`, `CREATE SCHEMA analytics`, role `tableau_ro` ainda sem privilégio (`NOLOGIN`; login/senha são operacionais, fora de migração versionada)
- [x] T021 Criar migração `apps/api/prisma/migrations/20260808120100_add_catalog_and_versions/migration.sql` criando explicitamente `indicator_catalog`, `indicator_response_version` (com o índice único parcial de T016), `report_submission`, `audit.access_log`, `export_seal` e `export_seal_revocation` — a lista é exaustiva de propósito: T035 revoga DML sobre três destas e falha se alguma não existir. Também carrega as colunas novas nullable de User/SystemSetting/EvidenceFile/FormIndicator (passo 2 da Ordem de migração)
- [x] T022 Criar migração `apps/api/prisma/migrations/20260808120200_backfill_legacy_versions/migration.sql`: para cada `IndicatorResponse` existente, exatamente **uma** versão com `originLegacy = true` e `validTo = NULL` — nenhuma versão intermediária é sintetizada, história não se inventa
- [x] T023 Criar migração `apps/api/prisma/migrations/20260808120300_backfill_report_submissions/migration.sql` derivando `ReportSubmission` dos campos únicos existentes de `ReportInstance`, preservando o que houver e marcando a origem como legada
- [x] T024 Criar migração `apps/api/prisma/migrations/20260808120400_backfill_catalog_entries/migration.sql` criando entradas de catálogo a partir dos indicadores existentes (code/measurementUnit provisórios, marcados para revisão via US4), para que `catalogEntryId` possa virar obrigatório sem perda; inclui também o backfill correlato de `EvidenceFile.bucket` (A5/T012), não listado à parte mas necessário para fechar a mesma transição nullable→obrigatório
- [x] T025 Criar migração `apps/api/prisma/migrations/20260808120500_migrate_audit_log_to_audit_schema/migration.sql` movendo `audit_log` e ajustando o trigger de `20260713195352_add_audit_trigger` ao schema novo — `origin` entra `NOT NULL DEFAULT 'LEGADO'` (depois `DROP DEFAULT`) para não disparar `trg_audit_logs_immutable` num backfill via `UPDATE`; o trigger reescrito também passa a **rejeitar** (`RAISE EXCEPTION`) qualquer escrita sem `app.origin` de sessão — a garantia de T166 fica no banco, não só na aplicação. **Todas as 6 migrações desta tarefa foram aplicadas e verificadas contra o Postgres real do ambiente de dev** (`docker exec` + `psql`): tabelas/colunas criadas, 378 versões de backfill, 72 submissões de backfill, `catalog_entry_id` e `bucket` `NOT NULL` sem linha órfã, rejeição do gatilho confirmada sem `app.origin` e gravação completa confirmada com contexto definido; `_prisma_migrations` atualizada com os checksums reais para que `prisma migrate deploy` não tente reaplicar

### Trilha e contexto de auditoria

- [x] T026 [TEST] Criar `apps/api/src/common/services/audit-context.service.spec.ts` cobrindo: escrita sem contexto é **rejeitada**, nunca gravada em silêncio — 5 casos (rejeição sem `run()` ativo, `set_config` das 9 variáveis, propagação através de fronteiras assíncronas dentro do mesmo `run()`, isolamento entre `run()`s concorrentes, rejeição após o `run()` externo encerrar)
- [x] T027 Criar `apps/api/src/common/services/audit-context.service.ts` com `runWithAuditContext(tx)` sobre `AsyncLocalStorage` — desenho final difere do literal do enunciado (`runWithAuditContext({...}, tx)`): o contexto é semeado por `run(context, callback)` (chamado pelo interceptor/`SystemActor`) e lido do `AsyncLocalStorage` dentro de `runWithAuditContext`, para que os 5 pontos de escrita não precisem repassar `sourceIp`/`userAgent`/`origin` a cada chamada — o mecanismo (ALS) é o mesmo, só a ergonomia de chamada muda
- [x] T028 Criar `apps/api/src/common/interceptors/audit-context.interceptor.ts` que popula o contexto a partir da requisição (userId/nome/perfil/unidade de `req.user`, IP, User-Agent, `x-request-id` ou UUID gerado, `origin = 'WEB'`), e registrado globalmente em `apps/api/src/app.module.ts` via `APP_INTERCEPTOR`; usa `new Observable` + `subscribe` manual (não apenas `next.handle()`) porque a assinatura do Observable do NestJS é lazy — sem isso o `AsyncLocalStorage.run()` não cobriria a execução real do handler
- [x] T028a [TEST] Criar `apps/api/src/common/services/system-actor.spec.ts`: `AuditLog` não tem coluna `actorKind` (só `AccessLog` tem, por schema) — a garantia de "jamais autoria nula" para ator de sistema é implementada via `actorNameSnapshot` sempre preenchido (`"Sistema — <rótulo>"`) com `userId` nulo e `origin` identificável (`CRON`/`SEED`), não por um campo `actorKind` em `AuditLog`
- [x] T028b Criar `apps/api/src/common/services/system-actor.ts` e envolver `apps/api/src/lifecycle/lifecycle-cron.service.ts` e `apps/api/prisma/seed.ts`/`seed-demo.ts`/`seed-proprietary/seed-n1.ts`/`seed-n3.ts` em `runWithAuditContext` com ator de sistema. Achado adicional: `ReportLifecycleService.openPeriodForUnit` cria `IndicatorResponse` (tabela auditada) numa transação que **não usava nenhum mecanismo de contexto** — corrigido para usar `AuditContextService.runWithAuditContext` também nos dois caminhos humanos (`startCurrentPeriodForElaborador`, `ensureCurrentPeriodOpenForAllActiveUnits`), não só no cron. `seed-demo.ts` (788 linhas) tinha 2 `indicatorResponse.upsert` sem `updatedAt` (bug latente desde T010, nunca compilado por `prisma/` estar fora do tsconfig) — corrigido e verificado via `ts-node` real (compila e para exatamente na falta de rede do Postgres, não em erro de tipo)
- [x] T029 [TEST] Criar `apps/api/src/audit/access-log.service.spec.ts` verificando gravação de leitura com filtros na íntegra, escopo e volume (FR-073), incluindo o caso `ANONIMO_DECLARADO` explícito (FR-072) e os defaults de campos opcionais
- [x] T030 Criar `apps/api/src/audit/access-log.service.ts` (grava direto, sem `AuditContextService` — `AccessLog` não tem gatilho de banco, é escrita de aplicação) e `apps/api/src/audit/audit.module.ts`, registrado em `app.module.ts`
- [x] T030a Criar `apps/api/src/reports/absence.util.ts` com `classifyIndicatorCell`/`isAbsentState` e as cinco representações físicas de `data-model.md` (`VALOR_APURADO`, `ZERO_MEDIDO`, `NAO_APLICAVEL_FORA_DO_NIVEL`, `NAO_APLICAVEL_INDICADOR_INATIVO`, `NAO_PREENCHIDO`) e o `.spec.ts` correspondente provando que as 5 são pairwise distintas — é fundação, não código de US1: T110 (auditoria) e T149 (views analíticas) dependem dela

### Sessão: fechar a violação do Princípio V

- [x] T031 [TEST] Alterar `apps/api/src/auth/auth.controller.spec.ts` para exigir emissão de cookie `HttpOnly`/CSRF e recusa de escrita sem token anti-CSRF válido — **desvio de `SameSite`**: o texto original pedia `SameSite=Strict`, mas `docs/Master_Technical_&_Product_Specification.md` (F16.2, escrito depois deste texto, no mesmo commit `4fd941d` que aposentou `apps/web/SECURITY-NOTES.md`) especifica `Lax` com justificativa explícita — `Strict` quebraria a navegação a partir de link de e-mail (F14), o usuário chegaria à tela de login apesar de sessão válida. Implementado `Lax`, seguindo a especificação mais recente e mais detalhada; o teste de recusa sem CSRF válido vive em `apps/api/src/common/guards/csrf.guard.spec.ts` (o guard é global, não injetado no controller)
- [x] T032 `apps/api/src/auth/auth.controller.ts`/`jwt.strategy.ts` lêem o token de `formops_access_token` (cookie `HttpOnly`); login emite esse cookie + `formops_csrf_token` (legível por JS, esquema de submissão dupla); `CsrfGuard` novo em `common/guards/` registrado global; `AccessLogService` grava `LOGIN_SUCESSO`/`LOGIN_FALHA` em toda tentativa (FR-073). **Extensão além do texto literal**: adicionado `POST /auth/refresh` — o Master Spec (F16.2) declara `logout`/`refresh` como rotas *obrigatórias* dado o cookie `HttpOnly` ("o cliente não consegue apagar nem inspecionar o token"); implementar a sessão em cookie sem `refresh` deixaria exatamente o buraco funcional que o próprio spec aponta. **T171 puxada para cá** (achado próprio, não pedido pelo texto): CORS aberto (`enableCors()` sem opções) é incompatível com `credentials: 'include'` — o navegador recusa cookie em resposta com `Access-Control-Allow-Origin: *`. `CORS_ORIGIN` virou obrigatória em `env.validation.ts`, `main.ts` usa `credentials: true`, `.env.example`/`scripts/manage.js` documentam/derivam a variável. Sem essa mudança acoplada, T032 não funcionaria em nenhum ambiente de desenvolvimento real (frontend e backend em origens distintas)
- [x] T033 `apps/web/src/lib/api-client.ts` usa `credentials: 'include'` em vez de header `Authorization`; novo `apps/web/src/lib/csrf.ts` lê `formops_csrf_token` de `document.cookie` e ecoa em `x-csrf-token` nas escritas; `token-storage.ts` removido (sem sucessor — não há mais nada para o cliente guardar); `AuthContext.tsx` sempre pergunta `GET /auth/me` no mount (cookie `HttpOnly` é ilegível pelo JS) em vez de checar token local; `logout` limpa o estado local e chama `POST /auth/logout` (fire-and-forget) sem reusar o mesmo handler do evento `UNAUTHORIZED_EVENT` — evita loop caso a própria chamada de logout devolva 401. `LoginPage.test.tsx` não precisou de mudança (mocka `useAuth()`, não fala com a API diretamente); `AuthContext.test.tsx`/`api-client.test.ts`/`api/auth.test.ts`/`App.test.tsx` atualizados
- [x] T034 `apps/web/SECURITY-NOTES.md` **já não existe** — foi removido em `4fd941d` ("docs: remove outdated SECURITY-NOTES and PROMPT docs"), antes desta sessão, e seu conteúdo foi consolidado em `docs/Master_Technical_&_Product_Specification.md`. Não há mais nenhum documento descrevendo `sessionStorage` como risco aceito para atualizar ou remover — verificado por busca textual em todo o repositório. A tarefa está satisfeita pela ausência do documento, não por uma edição nele

### Revogação de DML (o passo final)

- [x] T035 Criar migração `apps/api/prisma/migrations/20260809090000_revoke_dml_on_append_only/migration.sql`: `REVOKE UPDATE, DELETE` da role da aplicação sobre `indicator_response_version`, `validation_records`, `audit.audit_logs`, `audit.access_log`, `export_seal` e `export_seal_revocation`. **Achado que mudou a abordagem, confirmado com o usuário antes de prosseguir**: `formops` (`POSTGRES_USER`) é dona de toda tabela (rodou todas as migrações) e, na imagem oficial do Postgres, também é superusuário de bootstrap — `REVOKE` contra dono/superusuário é *no-op*, o dono sempre ignora ACL. `docs/Master_Technical_&_Product_Specification.md` (linha 1893) já previa isso ("a role da aplicação, `tableau_ro` e a role administrativa são distintas, com privilégio mínimo cada uma"). A migração agora cria `formops_app` (NOLOGIN, não superusuário, não dona de nada) com `GRANT` amplo em `public`/`audit` (+`ALTER DEFAULT PRIVILEGES` para tabela futura) e só então revoga `UPDATE`/`DELETE` nas seis tabelas — o `REVOKE` passa a ter efeito real. `LOGIN`/senha ficam fora da migração versionada (mesmo padrão de `tableau_ro`, T020): `apps/api/scripts/provision-app-role.ts` (novo, `ALTER ROLE ... PASSWORD` via `APP_DB_PASSWORD`) roda depois de `prisma migrate deploy`, chamado por `scripts/manage.js` (`provisionAppRole()`) e por `apps/api/docker-entrypoint.sh`. `apps/api/src/prisma/prisma.service.ts` — o único client Prisma da aplicação em runtime — passou a conectar via `APP_DATABASE_URL` (nova, obrigatória em `env.validation.ts`) em vez de `DATABASE_URL` (que continua servindo só migração/seed, rodados pela role dona). `docker-compose.yml`/`.env.example`/`scripts/manage.js` derivam `APP_DATABASE_URL` a partir de `APP_DB_PASSWORD`. `apps/api/Dockerfile` ganhou `COPY` de `apps/api/scripts` e `apps/api/tsconfig.json` no estágio `runtime` — ausentes antes, o que impediria `ts-node` de rodar o script de provisionamento dentro do container
- [x] T036 [TEST] Criar `apps/api/src/prisma/append-only.spec.ts` provando que `UPDATE` e `DELETE` diretos nessas **seis** tabelas, **com a credencial da aplicação**, falham por privilégio (FR-047, FR-070, quickstart V5). `PrismaService` já conecta via `APP_DATABASE_URL` (a role restrita), então o teste é literalmente "com a credencial da aplicação" por construção. "A tentativa fica registrada" é garantia do próprio Postgres (todo erro de permissão negada entra no log do servidor por padrão) — não há caminho de aplicação para logar uma tentativa que a contornou por completo. Teste de integração contra Postgres real, mesma categoria das 3 suítes já documentadas como não executáveis neste sandbox (`docker port` não publica porta alguma); verificado apenas até onde o sandbox permite — compila limpo (`tsc`), falha exatamente em "Can't reach database server", não em erro de tipo ou sintaxe
- [x] T037 [TEST] Criar `apps/api/src/prisma/no-physical-delete.spec.ts` provando que nenhuma rota da aplicação consegue excluir fisicamente usuário, unidade ou evidência (FR-067). Ao contrário de T036, **não** depende de Postgres real: usa `Reflect.getMetadata(METHOD_METADATA, ...)` para provar que `UsersAdminController`/`UnitsAdminController`/`EvidenceController` não têm método HTTP `DELETE` algum, mais leitura textual dos três services confirmando ausência de `prisma.<model>.delete/deleteMany` contra a entidade de negócio (join table como `userUnitAccess` fica de fora — revogar acesso não é excluir entidade). 6/6 testes passando, sem dependência de banco

### Transversais

- [x] T038 Alterar `apps/api/src/main.ts` garantindo `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform` — **já satisfeito** (`main.ts:29-35`)
- [ ] T039 Criar `apps/api/src/common/filters/http-exception.filter.ts` com envelope `{ statusCode, message, error }` em português do Brasil, sem vazar identificador interno nem estrutura de banco (FR-124), e o `.spec.ts` correspondente
- [ ] T040 Atualizar `apps/api/prisma/seed-demo.ts` para provisionar catálogo canônico, `jobTitle` de usuário e os sete parâmetros novos de `SystemSetting`

**Checkpoint**: a não-destrutividade passou a ser garantia do banco. Sessão em cookie. Histórias
liberadas.

---

## Phase 3: User Story 1 — Elaborar e submeter o relatório mensal (P1) 🎯 MVP

**Goal**: o elaborador percorre login → herança → cálculo → evidência → submissão, sem que nenhuma
ausência vire zero.

**Independent Test**: com uma unidade, um formulário e um elaborador provisionados, percorrer o ciclo
até a submissão para revisão, verificando abertura automática do período, herança sinalizada, cálculo
a partir das variáveis e mudança de estado (quickstart V1).

**Estado atual**: o ciclo básico existe em `apps/api/src/reports/` e `apps/api/src/lifecycle/`. As
tarefas abaixo fecham as lacunas de herança parcial, semântica de ausência e quarentena de evidência.

### Testes

- [ ] T041 [P] [US1] [TEST] Criar `apps/api/src/reports/inheritance.service.spec.ts`: chave nova na definição fica `NAO_PREENCHIDO` e a resposta é marcada `HERDADO_PARCIAL` — jamais recebe zero nem valor de outra chave (cenário US1-3, quickstart V3)
- [ ] T042 [P] [US1] [TEST] Estender `apps/api/src/reports/indicator-responses.service.spec.ts`: cálculo impossível (variável ausente, denominador zero) não produz resultado, apresenta o motivo exato e deixa a conformidade indefinida (cenário US1-5); e **resultado de fronteira** (97,995 contra meta 98) é decidido em precisão decimal, com arredondamento aplicado uma única vez ao final — nunca pelo arredondamento de exibição (FR-031, Edge Case "Valor de fronteira")
- [ ] T043 [P] [US1] [TEST] Estender `apps/api/src/reports/indicator-responses.service.spec.ts`: `0` informado é medição legítima, indistinguível de qualquer outro número apurado (cenário US1-6, Princípio III)
- [ ] T044 [P] [US1] [TEST] Estender `apps/api/src/evidence/evidence.service.spec.ts`: divergência entre extensão, mimetype e assinatura binária → 400 e **nada gravado** (cenário US1-7, FR-035)
- [ ] T045 [P] [US1] [TEST] Estender `apps/api/src/reports/report-instances.service.spec.ts`: submissão bloqueada com anexo `PENDENTE` (cenário US1-8, FR-038)
- [ ] T045a [P] [US1] [TEST] A idempotência de `openPeriodForUnit` já está coberta em `report-lifecycle.service.spec.ts:98-99` (primeira e segunda chamada). Falta cobrir o caminho **pelo controller**: criar `apps/api/src/lifecycle/on-demand-open.spec.ts` exercitando `POST /api/reports/start-current` — unidade inativa, unidade sem formulário e segunda chamada, cada uma com o desfecho correto (FR-011, FR-012)

### Implementação

- [ ] T046 [US1] Criar `apps/api/src/reports/inheritance.service.ts` com herança por chave, marcação `HERDADO_PARCIAL` e sinalização de não conferido
- [ ] T047 [US1] Alterar `apps/api/src/reports/indicator-responses.service.ts` para gravar via `IndicatorResponseVersion` (nunca `UPDATE` em `IndicatorResponse`), fechando a versão anterior com `validTo` na mesma transação
- [ ] T049 [US1] Alterar `apps/api/src/evidence/evidence.service.ts` para aterrissar o upload no **bucket de quarentena**, com nome gerado pelo servidor (FR-036)
- [ ] T049a [US1] Criar `GET /api/evidence/:id/download` em `apps/api/src/evidence/evidence.controller.ts`: vínculo de vida curta gerado sob demanda, servido de **origem distinta da aplicação**, com `scanStatus = BLOQUEADO` → 403 sem exceção, e registro em `AccessLog` (FR-040, FR-073)
- [ ] T049b [US1] Criar `POST /api/evidence/:id/deactivate` em `apps/api/src/evidence/evidence.controller.ts` e o `.spec.ts`: desativação lógica com autor e data, permanecendo visível em auditoria, exportação e camada analítica — soft delete some da superfície de trabalho, nunca da auditoria (FR-041, Princípio I)
- [ ] T050 [US1] Criar `apps/api/src/evidence/antivirus.service.ts` e o `.spec.ts`, com veredito `PENDENTE` → `LIBERADO` | `BLOQUEADO` e promoção ao bucket imutável apenas em caso de liberação. **Nota de terminologia**: a constituição §VI escreve "somente o veredito `LIMPO` o promove"; o vocabulário normativo do produto é o de FR-037 — `LIBERADO` —, e a constituição merece um PATCH de redação para uniformizar
- [ ] T051 [US1] Alterar `apps/api/src/evidence/evidence.service.ts` para carimbar `retainUntil` a partir de `SystemSetting.evidenceRetentionYears` no `PutObject`, em modo Compliance (FR-042)
- [ ] T052 [US1] Alterar `apps/api/src/reports/report-instances.service.ts` para bloquear a submissão enquanto houver anexo `PENDENTE`
- [x] T052a [US1] Criar `POST /api/reports/open-current` em `apps/api/src/reports/report-instances.controller.ts`, restrito à unidade do solicitante, reutilizando `openPeriodForUnit` — mesma origem do cron, mesmo resultado, ator humano registrado (FR-011) — **já satisfeito sob outro nome**: `POST /api/reports/start-current` (`report-instances.controller.ts:26` → `startCurrentPeriodForElaborador`, `report-instances.service.ts:21-43`), restrito a `user.primaryUnitId` e reutilizando `openPeriodForUnit`. Manter o nome existente; renomear a rota quebraria o frontend sem ganho. O "ator humano registrado" depende de T166
- [ ] T053 [P] [US1] Alterar `apps/web/src/pages/ReportDetailPage.tsx` para exibir a sinalização de herdado/não conferido, o motivo de falha de cálculo **na própria linha do indicador** e a distinção visual entre `0` medido e ausência; garantir que alterar uma variável reavalia **apenas** o indicador afetado e os totais que dependem dele, nunca a tela inteira nem os demais indicadores (FR-127); estender `ReportDetailPage.test.tsx` cobrindo as duas coisas
- [ ] T054 [P] [US1] Alterar o componente de upload de evidência em `apps/web/src/components/` para apresentar o estado de verificação de segurança pendente e a recusa por tipo, com teste

**Checkpoint**: US1 funciona ponta a ponta e nenhuma ausência vira zero. Roda quickstart V1, V2, V3.

---

## Phase 4: User Story 2 — Revisar e submeter à contraprova (P2)

**Goal**: veredito por indicador com justificativa obrigatória, sem sobrescrita silenciosa em edição
concorrente.

**Independent Test**: sobre um relatório submetido, emitir vereditos em todos os indicadores e
executar a finalização, verificando os dois desfechos e a persistência de cada justificativa.

**Estado atual**: `apps/api/src/validation/` já cobre veredito e justificativa. Falta a concorrência
otimista (FR-129) e a pontualidade por submissão (FR-058).

### Testes

- [ ] T055 [P] [US2] [TEST] Criar `apps/api/src/reports/optimistic-concurrency.spec.ts`: gravação com `expectedVersionId` obsoleto → **409** com valor vencedor, autor e instante (cenário US2-10, quickstart V4)
- [ ] T056 [P] [US2] [TEST] Estender `apps/api/src/reports/optimistic-concurrency.spec.ts`: a sobrescrita é **segunda requisição deliberada** e fica distinguível na trilha por `overwroteVersionId`
- [ ] T057 [P] [US2] [TEST] Criar `apps/api/src/reports/report-submission.service.spec.ts`: uma linha por envio, nenhuma sobrescrita; atraso pretérito permanece após extensão de prazo (cenários US2-6, US3-6, quickstart V7)
- [ ] T058 [P] [US2] [TEST] Estender `apps/api/src/validation/validation.service.spec.ts`: indicador aprovado que seja alterado volta imediatamente a exigir nova contraprova (cenário US2-7)
- [ ] T059 [P] [US2] [TEST] Estender `apps/api/src/notifications/notifications.service.spec.ts`: falha de notificação não desfaz a transição — ela persiste e a falha fica registrada com serviço, operação e causa (FR-123) e com o destinatário e a transição afetados (FR-112) — (cenário US2-9, SC-016)

### Implementação

- [ ] T060 [US2] Alterar `apps/api/src/reports/dto/` acrescentando `expectedVersionId` obrigatório e `overwriteVersionId` opcional ao DTO de gravação de indicador
- [ ] T061 [US2] Alterar `apps/api/src/reports/indicator-responses.controller.ts` implementando o `PUT` com 409 conforme [contracts/api-rest.md](./contracts/api-rest.md)
- [ ] T062 [US2] Criar `GET /api/reports/:reportId/indicators/:indicatorId/versions` em `apps/api/src/reports/indicator-responses.controller.ts`, com histórico em ordem cronológica estável
- [ ] T063 [US2] Criar `apps/api/src/reports/report-submission.service.ts` gravando uma linha por submissão com etapa, autor, data, prazo vigente aferido e resultado
- [ ] T064 [US2] Alterar `apps/api/src/lifecycle/report-lifecycle.service.ts` para consultar `ReportSubmission` em vez dos campos únicos removidos
- [ ] T065 [US2] Alterar `apps/api/src/validation/validation.service.ts` para reverter o veredito de indicador aprovado que sofra alteração posterior
- [ ] T066 [P] [US2] Alterar `apps/web/src/pages/ValidationDetailPage.tsx` e `apps/web/src/pages/ReportDetailPage.tsx` para apresentar o diálogo de conflito com o valor vencedor, quem o informou e quando, exigindo escolha explícita; estender os testes correspondentes
- [ ] T067 [P] [US2] Alterar `apps/web/src/pages/ReportsPage.tsx` para exibir o histórico de submissões sem colapsar reenvios

**Checkpoint**: US1 e US2 independentes. Roda quickstart V4 e V7.

---

## Phase 5: User Story 3 — Desempenho e prazo em um olhar (P3)

**Goal**: nota de 0 a 10 comparável, congelada na emissão, com lacuna exibida como lacuna.

**Independent Test**: com relatórios concluídos em períodos distintos, verificar composição da nota,
desconto por atraso, congelamento após finalização e leitura de prazo e tendência na tela inicial.

### Testes

- [x] T068 [P] [US3] [TEST] Estender `apps/api/src/reports/report-instances.service.spec.ts`: indicador sem resultado apurado não entra na soma e a escala **não** é reescalonada — a nota máxima continua 10 (cenário US3-3) — **já satisfeito**, em `validation.service.spec.ts:204,240`: a soma percorre apenas indicadores conformes **e** aprovados, e os pesos são absolutos (`snapshotScoreWeight`), de modo que excluir um indicador não reescalona os demais
- [x] T069 [P] [US3] [TEST] Estender `apps/api/src/lifecycle/report-lifecycle.service.spec.ts`: desconto por atraso aplicado uma vez por etapa, nota nunca abaixo de zero (cenário US3-4) — **já satisfeito**, em `validation.service.spec.ts:262,294`; a implementação está em `validation.service.ts:124-125` (`Math.max(0, …)`)
- [ ] T070 [P] [US3] [TEST] Criar `apps/api/src/reports/score-freeze.spec.ts`: alterar peso, meta e fórmula após a emissão não altera a nota emitida (cenário US3-7, quickstart V6)
- [ ] T071 [P] [US3] [TEST] Estender `apps/api/src/lifecycle/business-days.util.spec.ts` cobrindo feriados móveis e o parâmetro `includeOptionalHolidays` (research.md D10)

### Implementação

- [x] T072 [US3] Alterar `apps/api/src/reports/report-instances.service.ts` para compor a nota a partir dos campos `snapshot*` congelados, jamais da definição corrente — **já satisfeito, em outro arquivo**: a composição vive em `validation.service.ts:109-125` (`finalizeReport`) e já lê `response.snapshotScoreWeight`, nunca `FormIndicator.scoreWeight`. O teste de congelamento (T070) permanece pendente — a implementação está certa, a prova de que continua certa ainda não existe
- [ ] T073 [US3] Alterar `apps/api/src/lifecycle/report-lifecycle.service.ts` para aferir pontualidade contra o prazo **vigente na submissão**, lido de `ReportSubmission`
- [ ] T074 [US3] Alterar `apps/api/src/lifecycle/business-days.util.ts` para respeitar `SystemSetting.includeOptionalHolidays`
- [x] T075 [P] [US3] Alterar `apps/web/src/pages/DashboardPage.tsx` para exibir períodos sem nota como **lacuna**, nunca como zero, na série de tendência (cenário US3-9); estender `DashboardPage.test.tsx` — **já satisfeito**: `apps/web/src/lib/score-trend.ts:24` emite `null` para mês sem relatório concluído ou sem `totalScore`, com `score-trend.test.ts` cobrindo
- [ ] T076 [P] [US3] **Somente frontend**: o backend já aceita `unitId`, `status`, `referenceMonthFrom/To`, `search` (sigla ou nome) e `sortBy/sortOrder` em `report-instances.service.ts:71-98`, e já barra alargamento de escopo via `unitId`. `apps/web/src/pages/ReportsPage.tsx` fixa `sortBy: 'referenceMonth'` e não expõe nenhum controle. Acrescentar os controles e ligá-los aos parâmetros existentes; estender `ReportsPage.test.tsx`
- [ ] T077 [P] [US3] Alterar `apps/web/src/components/` para exibir proximidade e estouro de prazo da fase corrente, com teste

**Checkpoint**: acervo vira instrumento de gestão. Roda quickstart V6.

---

## Phase 6: User Story 4 — Evoluir a governança sem desenvolvimento (P4)

**Goal**: catálogo canônico, pesos que sempre somam 10,00, e parâmetros operacionais configuráveis.

**Independent Test**: criar formulário completo com seções e indicadores, balancear pesos, vincular a
uma unidade, alterar um parâmetro de prazo e verificar que relatórios futuros refletem a mudança
enquanto os já emitidos permanecem inalterados.

### Testes

- [ ] T078 [P] [US4] [TEST] Criar `apps/api/src/catalog/catalog.service.spec.ts`: `measurementUnit` imutável após o primeiro vínculo → 409 (cenário US4-8, FR-064)
- [ ] T079 [P] [US4] [TEST] Estender `apps/api/src/catalog/catalog.service.spec.ts`: desativar entrada com indicador ativo vinculado → 409 (cenário US4-7)
- [x] T080 [P] [US4] [TEST] Estender os specs de indicador em `apps/api/src/forms/`: expressão referenciando variável não declarada, ou com caractere fora do conjunto permitido, é recusada (cenários US4-1, US4-2) — **já satisfeito**: `formula-validator.util.ts` recusa ambos e `formula-validator.util.spec.ts` cobre os dois casos
- [ ] T081 [P] [US4] [TEST] A primeira metade já existe em `apps/api/src/forms/score-distribution.util.spec.ts` (soma exatamente 10,00 com divisão inexata, cenário US4-5). Falta a segunda: cobrir em `apps/api/src/forms/form-templates.service.spec.ts` que vínculo a unidade e instanciação de relatório são **recusados** quando a soma dos pesos ativos difere de 10,00 (cenário US4-3)
- [ ] T082 [P] [US4] [TEST] Estender `apps/api/src/export/platform-settings.service.spec.ts`: redução da janela de retenção vale só para gravações futuras (cenário US4-11, FR-042)

### Implementação

- [ ] T083 [US4] Criar `apps/api/src/catalog/catalog.service.ts`, `catalog.controller.ts` e `catalog.module.ts` conforme [contracts/api-rest.md](./contracts/api-rest.md), e registrar em `apps/api/src/app.module.ts`
- [ ] T084 [US4] Alterar `apps/api/src/forms/` para exigir `catalogEntryId` no cadastro de indicador, recusando o salvamento sem código canônico (cenário US4-6)
- [ ] T085 [US4] **Não criar arquivo novo**: `apps/api/src/forms/score-distribution.util.ts` já implementa a distribuição de 10 pontos pelo método dos maiores restos, fechando em 10,00 exatos, com spec cobrindo divisão exata, resto, total customizado e contagem zero. O que falta é o **gatilho**: acionar `distributeScoreWeights` ao ativar, inativar ou criar indicador em `apps/api/src/forms/form-indicators.service.ts`, e devolver a redistribuição proposta para confirmação. Criar `weight-balance.util.ts` duplicaria lógica correta e em uso
- [ ] T086 [US4] Alterar `apps/api/src/forms/` para recusar vínculo a unidade e instanciação de relatório quando a soma dos pesos ativos não for 10,00, **sem** impedir que o formulário seja salvo e corrigido
- [ ] T087 [US4] Alterar `apps/api/src/export/platform-settings.service.ts` expondo os sete parâmetros novos de `SystemSetting`
- [ ] T088 [P] [US4] Criar `apps/web/src/pages/AdminCatalogPage.tsx` e `AdminCatalogPage.test.tsx`, com criação de entrada de catálogo **sem sair** do cadastro de indicador (FR-063)
- [ ] T089 [P] [US4] Alterar `apps/web/src/pages/AdminFormsPage.tsx` para apresentar a redistribuição de pesos e exigir confirmação; estender `AdminFormsPage.test.tsx`
- [ ] T090 [P] [US4] Alterar `apps/web/src/pages/AdminSettingsPage.tsx` para exigir **diálogo dedicado e distinto do salvamento comum** ao selecionar retenção ilimitada, explicitando antes da confirmação que nada gravado sob ela poderá ser removido por ninguém (cenário US4-10); estender `AdminSettingsPage.test.tsx`
- [ ] T091 [P] [US4] Alterar `apps/web/src/pages/AdminSettingsPage.tsx` para deixar claro, ao reduzir a janela de retenção, que o acervo já gravado não é liberado

**Checkpoint**: governança evolui sem deploy.

---

## Phase 7: User Story 5 — Administrar pessoas e unidades sem excluir (P5)

**Goal**: desativação lógica que preserva autoria legível em todo o acervo.

**Independent Test**: criar usuário e unidade, conceder e revogar acesso adicional, desativar e
reativar ambos, verificando que relatórios históricos permanecem íntegros e legíveis.

**Estado atual**: `apps/api/src/admin/` e `apps/api/src/users/` já cobrem a maior parte. Falta
`jobTitle`, revogação de efeito imediato e registro de valor anterior/novo.

- [ ] T092 [P] [US5] [TEST] Estender `apps/api/src/common/services/unit-access.service.spec.ts`: revogação de acesso adicional produz perda de visibilidade **imediata**, sem intervalo de tolerância (cenário US5-3, quickstart V15)
- [ ] T093 [P] [US5] [TEST] Estender `apps/api/src/admin/users-admin.service.spec.ts`: usuário desativado perde acesso mas mantém autoria legível em todo o acervo (cenário US5-1)
- [ ] T094 [P] [US5] [TEST] Estender `apps/api/src/admin/units-admin.service.spec.ts`: alteração administrativa registra autor, data, valor anterior e valor novo (cenário US5-5)
- [ ] T095 [US5] Alterar `apps/api/src/admin/users-admin.service.ts` e `apps/api/src/admin/dto/` para incluir `jobTitle`, obrigatório para quem pode aprovar — o cargo é estampado no documento selado
- [ ] T096 [US5] Alterar `apps/api/src/common/services/unit-access.service.ts` para revalidar escopo a cada requisição, sem cache que sobreviva à revogação
- [ ] T097 [US5] Alterar `apps/api/src/admin/` para gravar valor anterior e novo em `AuditLog` via `runWithAuditContext`
- [ ] T098 [P] [US5] Alterar `apps/web/src/pages/AdminAccessPage.tsx` para incluir cargo e explicitar que desativação não é exclusão; estender `AdminAccessPage.test.tsx`

**Checkpoint**: operação em escala real, sem jamais excluir.

---

## Phase 8: User Story 6 — Consultar o acervo como base de auditoria (P6)

**Goal**: superfície de auditoria multi-eixo, determinística, com matriz esparsa honesta.

**Independent Test**: executar a consulta canônica de referência — *"período de X a Y, todas as
unidades, indicador de quantitativo de servidores"* — e verificar a série retornada, unidade a
unidade, mês a mês, com a semântica de ausência correta em cada célula (quickstart V12).

**Estado atual**: **não existe**. Módulo inteiro novo.

### Testes

- [ ] T099 [P] [US6] [TEST] Criar `apps/api/src/audit/audit-query.service.spec.ts`: consulta multi-nível produz matriz esparsa com código de ausência **exato** em toda célula vazia — nunca `0`, nunca vazio silencioso (cenário US6-2, quickstart V2)
- [ ] T100 [P] [US6] [TEST] Estender `apps/api/src/audit/audit-query.service.spec.ts`: unidade que mudou de nível no meio do intervalo reporta `NA_FORA_DO_NIVEL` antes da transição e valores depois (cenário US6-3)
- [ ] T101 [P] [US6] [TEST] Estender `apps/api/src/audit/audit-query.service.spec.ts`: conjunto vazio retorna `isEmptyResult` **sem** ampliar período, remover unidade, afrouxar recorte nem sugerir alternativa (cenário US6-4, FR-083)
- [ ] T102 [P] [US6] [TEST] Estender `apps/api/src/audit/audit-query.service.spec.ts`: toda agregação declara `n` e `totalCells`, e células ausentes ficam fora do denominador, sem interpolação nem repetição de valor anterior (cenários US6-6, US6-7); e indicadores de `measurementUnit` distintas **não** são agregados entre si (FR-065)
- [ ] T103 [P] [US6] [TEST] Criar `apps/api/src/audit/determinism.spec.ts`: duas execuções idênticas retornam linhas na mesma ordem, byte a byte (cenário US6-9, quickstart V12)
- [ ] T104 [P] [US6] [TEST] Criar `apps/api/src/audit/audit-scope.spec.ts`: usuário de escopo restrito enxerga exatamente as unidades que já enxergava — nenhum acesso novo (cenário US6-10)
- [ ] T105 [P] [US6] [TEST] Estender `apps/api/src/audit/audit-query.service.spec.ts`: amplitude acima de `auditMaxRangeMonths` → 400 com orientação, jamais truncamento silencioso (FR-091)

### Implementação

- [ ] T106 [US6] Criar `apps/api/src/audit/audit-query.service.ts` e `apps/api/src/audit/audit-query.controller.ts` conforme [contracts/api-rest.md](./contracts/api-rest.md), declarando-os no `audit.module.ts` já criado em T030
- [ ] T107 [US6] Criar `apps/api/src/audit/dto/audit-query.dto.ts` com todos os parâmetros do contrato, validando amplitude antes de executar
- [ ] T108 [US6] Implementar paginação **keyset** sobre `(referencePeriod DESC, unitId ASC, indicatorCode ASC, responseId ASC)` em `apps/api/src/audit/audit-query.service.ts`; `OFFSET` profundo é proibido (research.md D5)
- [ ] T109 [US6] Criar migração `apps/api/prisma/migrations/<nova>_add_audit_query_indexes/migration.sql` com os índices GIN `jsonb_path_ops` e `pg_trgm` de `research.md` D6
- [ ] T110 [US6] Implementar a montagem da matriz esparsa em `apps/api/src/audit/audit-query.service.ts`, reutilizando `apps/api/src/reports/absence.util.ts` de T030a — a semântica de ausência tem uma origem só —, e recusar agregação que misture `measurementUnit` distintas: somar grandezas diferentes produz número sem significado (FR-065)
- [ ] T111 [US6] Implementar `countMode` (`EXATA` | `APROXIMADA` | `TETO`) governado por `SystemSetting.auditExactCountThreshold` em `apps/api/src/audit/audit-query.service.ts`
- [ ] T112 [US6] Criar `apps/api/src/audit/outlier.util.ts` e o `.spec.ts`: sinalização estatística é **apenas** indicação para inspeção humana, com a regra declarada, e não altera conformidade, nota nem estado (cenário US6-8)
- [ ] T113 [US6] Criar `GET /api/audit/filters` em `apps/api/src/audit/audit-query.controller.ts` com opções encadeadas e reativas; a busca do seletor **apenas localiza item na lista** (FR-077)
- [ ] T113a [US6] Implementar em `apps/api/src/audit/audit-query.service.ts` a busca dentro do resultado alcançando o **conjunto inteiro**, não o trecho renderizado — a busca é parâmetro da consulta ao banco, nunca filtro de cliente sobre a página corrente; concluir que um registro não existe porque não está renderizado é inaceitável (FR-092, Edge Case "Busca dentro de resultado extenso"), com teste dedicado
- [ ] T114 [US6] Instrumentar toda execução de consulta em `apps/api/src/audit/audit-query.service.ts` com `AccessLog` contendo filtros na íntegra, escopo e volume
- [ ] T115 [P] [US6] Criar `apps/web/src/pages/AuditPage.tsx` e `AuditPage.test.tsx` com os seletores encadeados e os modos `BASICO`/`DETALHADO`
- [ ] T116 [P] [US6] Criar `apps/web/src/components/AbsenceLegend.tsx` e teste: a legenda acompanha a tabela **sempre**, na tela e no arquivo, nunca só como dica de passagem do mouse (cenário US6-5)
- [ ] T117 [P] [US6] Criar `apps/web/src/components/SparseMatrix.tsx` e teste, exibindo `n` e a diferença para o total de células em toda média ou taxa
- [ ] T118 [P] [US6] Implementar em `apps/web/src/pages/AuditPage.tsx` navegação contínua ou anterior/próxima, sem conjunto ilimitado (cenário US6-11)
- [ ] T119 [P] [US6] Garantir em `apps/web/src/components/SparseMatrix.tsx` que ordenação e visibilidade de coluna são apresentação, nunca filtro: mudá-las não remove linha nem altera agregação (cenário US6-12), com teste dedicado
- [ ] T119a [US6] Criar o modelo `UserTablePreference` em `apps/api/prisma/schema.prisma` com a migração correspondente, e as rotas de leitura e gravação em `apps/api/src/audit/audit-query.controller.ts`, persistindo ordenação e visibilidade de coluna **por usuário** (FR-090); a preferência é apresentação e não entra em nenhum caminho de filtro

**Checkpoint**: acervo defensável perante auditor externo. Roda quickstart V2, V12, V15.

---

## Phase 9: User Story 7 — Emitir documento verificável por terceiro (P7)

**Goal**: selo de integridade que um auditor sem credencial confere, inclusive offline.

**Independent Test**: exportar um relatório concluído nos três formatos, verificar o selo pelo
verificador público, alterar um único byte do arquivo e confirmar que a verificação passa a acusar
adulteração (quickstart V8).

**Estado atual**: **não existe**. `apps/api/src/export/` produz arquivos, mas sem selo.

### Testes

- [ ] T120 [P] [US7] [TEST] Criar `apps/api/src/sealing/canonical-serialization.spec.ts` cobrindo as nove regras de [contracts/canonical-serialization.md](./contracts/canonical-serialization.md), com **regressão de byte único**: qualquer alteração no conteúdo canônico muda o `contentDigest`
- [ ] T121 [P] [US7] [TEST] Criar `apps/api/src/sealing/seal.service.spec.ts`: os três formatos do mesmo recorte compartilham o **mesmo** `contentDigest` e têm `artifactDigest` distintos (cenário US7-1, FR-098)
- [ ] T122 [P] [US7] [TEST] Criar `apps/api/src/verification/public-verification.spec.ts`: um byte alterado → `CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO`, nunca `INTEGRO` (cenário US7-2)
- [ ] T123 [P] [US7] [TEST] Estender `apps/api/src/verification/public-verification.spec.ts`: código inexistente e código malformado produzem respostas idênticas em corpo **e** em distribuição de latência (cenário US7-6, FR-105)
- [ ] T124 [P] [US7] [TEST] Estender `apps/api/src/verification/public-verification.spec.ts`: nenhum valor de indicador, análise, plano de ação ou evidência aparece em qualquer resposta desta superfície (cenário US7-5, FR-102)
- [ ] T125 [P] [US7] [TEST] Estender `apps/api/src/verification/public-verification.spec.ts`: selo revogado retorna motivo e data, e o registro original permanece consultável e intacto (cenário US7-7)
- [ ] T126 [P] [US7] [TEST] Estender `apps/api/src/verification/public-verification.spec.ts`: selo emitido sob chave aposentada continua verificável (FR-104)
- [x] T127 [P] [US7] [TEST] Estender `apps/api/src/export/csv.util.spec.ts`: célula iniciada por `=`, `+`, `-` ou `@` recebe prefixação defensiva **na saída**, e o dado gravado permanece intacto (cenário US7-9, FR-110) — **já satisfeito**: `csv.util.ts:8,16` prefixa com apóstrofo e o spec cobre os quatro gatilhos, o payload com aspas e o não-gatilho no meio da célula
- [ ] T128 [P] [US7] [TEST] Criar `apps/api/src/export/audit-export.service.spec.ts`: exportação de consulta carrega filtros na íntegra **inclusive os que não retornaram dados**, modo, colunas, ordenação, escopo, legenda de ausência, autoria e o `n` de cada agregação (cenário US7-10, FR-107)
- [ ] T128a [P] [US7] [TEST] Criar `apps/api/src/export/recomputability.spec.ts`: toda agregação exibida é reproduzida a partir das linhas brutas do mesmo arquivo exportado — mesmo número, mesmo `n`, mesma escala decimal (FR-088, SC-008)

### Implementação

- [ ] T129 [US7] Criar `apps/api/src/sealing/canonical-serialization.ts` implementando o contrato `seal-v1` — ordenação lexicográfica recursiva, escalas decimais declaradas, ISO-8601 UTC com `Z`, nulos presentes, objetos de ausência explícitos
- [ ] T130 [US7] Criar `apps/api/src/sealing/signature.service.ts` com Ed25519 via `node:crypto` nativo, assinando o `contentDigest` e expondo o `keyId` ativo
- [ ] T131 [US7] Criar `apps/api/src/sealing/verification-code.util.ts` e o `.spec.ts`: código não sequencial de fonte criptograficamente segura, alfabeto sem caracteres ambíguos (`0`/`O`, `1`/`I`) e dígito verificador
- [ ] T132 [US7] Criar `apps/api/src/sealing/seal.service.ts` e `apps/api/src/sealing/sealing.module.ts` gravando `ExportSeal` imutável; a revogação é registro **adicional** em `ExportSealRevocation`, nunca alteração do original (FR-101)
- [ ] T133 [US7] Alterar `apps/api/src/export/report-export.service.ts` para selar **todo** artefato — inclusive parcial e conjunto vazio (cenário US7-8, FR-097) — nos três formatos, incluindo o de integração (JSON) — e registrar a emissão em `AccessLog` com escopo, formato e autoria (FR-094, FR-073)
- [ ] T134 [US7] Criar `apps/api/src/export/pdf.service.ts` gerando o PDF **server-side a partir do acervo**, jamais do DOM renderizado (FR-108), com QR code, assinatura eletrônica do aprovador (nome, cargo, unidade) e digests estampados em texto legível no rodapé
- [ ] T135 [US7] Criar `apps/api/src/export/audit-export.service.ts` para exportar consulta de auditoria com todo o cabeçalho de proveniência de FR-107, resolvendo o nome do arquivo a partir do padrão configurado em `SystemSetting` (FR-096) e registrando a emissão em `AccessLog` (FR-073)
- [ ] T136 [US7] Criar `apps/api/src/verification/verification.controller.ts` e `apps/api/src/verification/verification.module.ts` com as rotas públicas de [contracts/public-verification.md](./contracts/public-verification.md), **sem** guard de autenticação
- [ ] T137 [US7] Implementar em `apps/api/src/verification/verification.controller.ts` a comparação em tempo constante e o atraso de normalização de latência, com rate limiting **próprio** desta rota, independente do limite global
- [ ] T138 [US7] Implementar `POST /api/public/seals/:codigo/verify-artifact` em `apps/api/src/verification/verification.controller.ts`, aceitando o `artifactDigest` calculado pelo auditor — **o arquivo não é enviado**
- [ ] T139 [US7] Implementar `GET /api/public/keys` e `GET /api/public/keys/:keyId` em `apps/api/src/verification/verification.controller.ts`; chave aposentada é marcada, nunca removida
- [ ] T140 [US7] Registrar `AccessLog` com `eventType = VERIFICACAO_SELO` e `actorKind = ANONIMO_DECLARADO` em toda verificação, em `apps/api/src/verification/verification.controller.ts` (FR-072, FR-073)
- [ ] T141 [P] [US7] Criar `apps/web/src/pages/VerifyPage.tsx` e `VerifyPage.test.tsx` — rota pública, fora do guard de sessão, apresentando os cinco vereditos em linguagem que um auditor externo entenda
- [ ] T142 [P] [US7] Alterar `apps/web/src/App.tsx` para expor `/verificar/:codigo` sem exigir autenticação; estender `apps/web/src/App.test.tsx`
- [ ] T143 [P] [US7] [TEST] Criar `apps/api/src/verification/offline-verification.spec.ts` provando que a assinatura confere usando **apenas** o documento e a chave pública publicada, sem contato com a plataforma (cenário US7-11, quickstart V9)

**Checkpoint**: o acervo sai para o mundo externo com prova. Roda quickstart V8, V9.

---

## Phase 10: User Story 8 — Consumir o acervo em ferramenta de BI (P8)

**Goal**: projeção read-only que nunca recalcula e nunca trata ausência como zero.

**Independent Test**: a partir de um valor apurado no BI, percorrer a cadeia até a evidência anexada,
verificando que cada elo é alcançável e que nenhum número diverge da Área de Auditoria (quickstart
V13, V14).

**Estado atual**: **não existe**.

### Testes

- [ ] T144 [P] [US8] [TEST] Criar `apps/api/src/analytics/analytics-views.spec.ts`: relatório não concluído não aparece em **nenhuma** view (cenário US8-1, FR-115)
- [ ] T145 [P] [US8] [TEST] Estender `apps/api/src/analytics/analytics-views.spec.ts`: média sobre recorte com células ausentes ignora as ausentes no denominador, e o `n` bate com o da Área de Auditoria (cenário US8-5, SC-019)
- [ ] T146 [P] [US8] [TEST] Estender `apps/api/src/analytics/analytics-views.spec.ts`: meta alterada após a emissão não altera o que o BI lê daquele relatório (cenário US8-3, FR-117)
- [ ] T147 [P] [US8] [TEST] Criar `apps/api/src/analytics/analytics-privileges.spec.ts`: `INSERT`/`UPDATE`/`DELETE` como `tableau_ro` falham por privilégio, e a role da aplicação **não** tem `SELECT` em `analytics` (cenário US8-4, FR-118)
- [ ] T148 [P] [US8] [TEST] Criar `apps/api/src/analytics/evidence-resolver.spec.ts`: segunda utilização do mesmo token apresenta tela de expiração, não erro cru; nenhuma resposta contém o endereço do armazenamento (cenários US8-6, US8-8)
- [ ] T148a [P] [US8] [TEST] Criar `apps/api/src/analytics/drill-down.spec.ts`: a partir de `v_report_fact.calculated_value` a cadeia é percorrível até a evidência — decomposição do cálculo (variáveis e expressão congeladas) → histórico de autoria e alteração → `v_evidence_link` → resolver → arquivo, cada elo alcançável em no máximo 3 passos (FR-119, SC-006)

### Implementação

- [ ] T149 [US8] Criar migração `apps/api/prisma/migrations/<nova>_create_analytics_views/migration.sql` com `v_report_fact`, `v_absence_semantics`, `v_indicator_dim`, `v_unit_dim` e `v_evidence_link` conforme [contracts/analytics-layer.md](./contracts/analytics-layer.md)
- [ ] T150 [US8] Incluir na migração `<nova>_create_analytics_views` a coluna `v_absence_semantics.counts_in_denominator` — `false` para toda forma de ausência, `true` apenas para `VALOR` e `ZERO_MEDIDO` (FR-116)
- [ ] T151 [US8] Criar migração `apps/api/prisma/migrations/<nova>_grant_tableau_ro/migration.sql`: `GRANT SELECT` a `tableau_ro` **apenas** em `analytics`, e revogar `SELECT` da role da aplicação sobre `analytics`
- [ ] T152 [US8] Criar `apps/api/src/analytics/evidence-resolver.service.ts` e `apps/api/src/analytics/analytics.module.ts` com token HMAC-SHA256 de uso único e vida curta
- [ ] T153 [US8] Criar `GET /api/analytics/evidence/:token` em `apps/api/src/analytics/analytics.controller.ts`, respondendo de forma indistinguível para token consumido, expirado e inválido
- [ ] T154 [US8] Registrar `AccessLog` em **todo** acesso originado do BI — bem-sucedido, expirado ou já consumido — em `apps/api/src/analytics/evidence-resolver.service.ts` (cenário US8-7)
- [ ] T155 [P] [US8] Criar `apps/web/src/pages/EvidenceExpiredPage.tsx` e `EvidenceExpiredPage.test.tsx`: tela amigável de expiração, nunca erro cru
- [ ] T156 [US8] Implementar o marcador de última carga e a capacidade de recarga completa da camada analítica (FR-121): view ou tabela `analytics.v_load_marker` exposta ao BI com o instante da carga corrente, e rotina de recarga em `apps/api/src/analytics/`, com `.spec.ts`. Enquanto as views forem não materializadas a "carga" é a própria leitura e o marcador reflete o instante da consulta — mas o contrato exposto ao painel é o mesmo que servirá depois da materialização, para que materializar não quebre painel
- [ ] T156a [P] [US8] Atualizar `specs/001-plataforma-formops-base/contracts/analytics-layer.md` com o marcador de T156, confirmando que as views permanecem não materializadas até haver medição real (research.md D11)

**Checkpoint**: todas as oito histórias funcionam. Roda quickstart V13, V14.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T157 [P] [TEST] Criar `apps/api/src/reports/invariants.spec.ts` com as cinco invariantes que a constituição exige explicitamente: `N/A` nunca é `0` nas cinco representações; resultado vazio sem relaxamento automático de filtro; matriz esparsa em consulta multi-nível; regressão de selagem por byte único; soma dos pesos ativos igual a 10,00 como condição de operabilidade
- [ ] T157a [P] [TEST] Criar `apps/web/src/test/state-labels.test.tsx` varrendo as superfícies novas — `AuditPage`, `AbsenceLegend`, `SparseMatrix`, `VerifyPage`, `EvidenceExpiredPage`, `AdminCatalogPage` — e provando que **nenhum** estado é comunicado apenas por cor: todo indicativo carrega rótulo textual acessível (FR-125, constituição §Identidade e idioma)
- [ ] T158 [P] Criar `apps/api/src/evidence/forensic-hold.spec.ts` [TEST] e implementar `POST /api/evidence/:id/forensic-release` em `apps/api/src/evidence/evidence.controller.ts`: guarda pericial de 1 ano, liberação antecipada exclusiva do administrador, registrada com autor, motivo e data (FR-039a, quickstart V10)
- [ ] T159 [P] Criar `apps/api/src/auth/account-lockout.spec.ts` [TEST] e ajustar `apps/api/src/auth/auth.service.ts`: o bloqueio por tentativas recai sobre a **conta**, e os demais usuários do mesmo endereço público continuam acessando; o bloqueio por endereço atua **apenas** como camada secundária, com limiar mais alto, janela curta e lista de exceção para os endereços de saída conhecidos das unidades, e todo bloqueio e desbloqueio fica registrado (quickstart V16, SC-017, FR-009)
- [ ] T159a [P] Criar `apps/api/src/notifications/subject.util.ts` e o `.spec.ts`, e alterar `apps/api/src/notifications/notifications.service.ts`: assunto padronizado com identificação do sistema, sigla da unidade e período, **higienizado** contra conteúdo de cadastro livre — nome de unidade é dado editável e não entra cru no cabeçalho de um e-mail (FR-113)
- [ ] T160 Documentar e executar em `scripts/` e `docs/` o procedimento de PITR/WAL archiving (RPO 15 min / RTO 4 h) **e** a política de retenção da trilha — piso igual à janela vigente de retenção das evidências, 10 anos por padrão, acompanhando-a se ampliada; o expurgo ocorre apenas por procedimento aprovado e registrado, e a aplicação não dispõe de meio de executá-lo. Registrar o exercício de restauração — backup nunca restaurado não é backup (FR-074a, FR-130, SC-021, quickstart V17)
- [ ] T161 [P] Medir a consulta canônica sobre 24 meses × todas as unidades e confirmar primeira página em < 3 s, repetindo com o acervo várias vezes maior para confirmar que o tempo não degrada (SC-011, SC-012); registrar o número medido em `specs/001-plataforma-formops-base/research.md` D11 antes de considerar materialização
- [ ] T161a [P] Executar teste de carga do **pico de fechamento mensal** no teto do envelope de 10 anos — 60 unidades e 400 usuários disputando a mesma janela de prazo — e confirmar ausência de degradação perceptível nas telas de preenchimento e validação; registrar o resultado em `research.md` (SC-012a)
- [ ] T162 [P] Atualizar `CLAUDE.md` com os módulos novos (`analytics`, `audit`, `catalog`, `sealing`, `verification`) e a nova forma de sessão
- [ ] T163 [P] Atualizar `apps/api/SECURITY-NOTES.md` reavaliando os riscos aceitos de `nodemailer` e `multer` à luz da quarentena e da verificação por assinatura binária
- [ ] T164 Executar `npm run build`, `npm test`, `npm run test:cov` em ambos os workspaces e `npm run lint` — portão: build verde, suíte verde, cobertura ≥ 80%, lint sem erro
- [ ] T165 Percorrer os 17 cenários de [quickstart.md](./quickstart.md) de ponta a ponta e registrar o resultado de cada um

---

## Phase 12: Convergência (reconciliação código ↔ artefatos, 2026-08-08)

Achados de auditoria do código existente contra `spec.md`, `plan.md` e a constituição. **Não** são
tarefas novas de produto: são desvios entre o que o código faz e o que os artefatos dizem que ele faz.

**Prioridade sobre as fases seguintes**: T166 e T167 consertam uma trilha de auditoria que hoje é
anônima e quase vazia. Construir US6–US8 sobre ela é construir prova sobre registro sem autor.
T166 deve fechar **junto com** T027/T028, não depois — são a mesma correção vista de dois ângulos.

- [x] T166 **CRÍTICO** Achado corrigido nesta sessão foi mais grave que o originalmente descrito: `runWithAuditActor` **tinha 5 chamadores reais** (`validation.service.ts` ×3, `indicator-responses.service.ts`, `report-instances.service.ts`, `evidence.service.ts`) — a varredura anterior estava desatualizada, não zero. Todos os 5 migrados para `AuditContextService.runWithAuditContext` (T027); `PrismaService.runWithAuditActor` removido (zero chamadores confirmados via grep antes da remoção). Criado `apps/api/src/prisma/audit-actor.spec.ts` (integração): prova que uma escrita direta sem `AuditContextService` é rejeitada pelo gatilho (`rejects.toThrow(/app\.origin/)`) e que a mesma escrita via `runAsSystemActor` grava com `origin`/`actorNameSnapshot` corretos e `userId` nulo. Não executável neste sandbox (rede Docker isolada, mesma limitação documentada em T020-T025), mas **validado manualmente contra o Postgres real via `docker exec psql`**: `UPDATE` sem `app.origin` → `RAISE EXCEPTION`; com os 9 `set_config` que `AuditContextService` define → sucesso e linha gravada em `audit.audit_logs` com `origin='SEED'`, `user_id` nulo, `actor_name_snapshot` preenchido
- [x] T167 **CRÍTICO** Migração `apps/api/prisma/migrations/20260808120600_extend_audit_trigger_coverage/migration.sql` estende `fn_write_audit_log` a `users`, `units`, `user_unit_access` (nome físico real, não `user_unit_accesses`), `form_templates`, `form_topics`, `form_indicators`, `system_settings` e `validation_records` — aplicada e verificada contra o Postgres real (`docker exec`), `_prisma_migrations` atualizada com checksum real. Teste de cobertura `apps/api/src/prisma/audit-trigger-coverage.spec.ts` consulta `information_schema.triggers` e falha se qualquer uma das 10 tabelas auditáveis (2 antigas + 8 novas) ficar sem o gatilho; verificado manualmente contra o banco real (20 linhas: 10 tabelas × INSERT/UPDATE). Efeito colateral necessário: `seed.ts`/`seed-demo.ts`/`seed-n1.ts`/`seed-n3.ts` escrevem em `users`/`units`/`form_templates`/`form_topics`/`form_indicators` — todos envolvidos em `runAsSystemActor` (T028b) para não quebrar com a nova cobertura
- [ ] T168 **ALTO** A validação de anexo em `apps/api/src/common/evidence-upload.constants.ts:23` confere **apenas** `file.mimetype` — cabeçalho enviado pelo cliente, trivialmente forjável. Não há leitura de assinatura binária em lugar nenhum do repositório. T044 escreve o teste da divergência entre extensão, mimetype e assinatura; **nenhuma tarefa implementava a verificação**. Implementar a checagem dos bytes iniciais contra o tipo declarado, recusando a divergência com 400 e sem gravar nada (FR-035, `missing`)
- [ ] T169 **ALTO** `apps/api/src/export/report-export.service.ts:113` estampa `cargo: mostRecent.aprovadorUser.role` — o **papel de acesso** (`APROVADOR`) apresentado como se fosse o cargo funcional da pessoa. O documento exportado hoje afirma algo que a plataforma não sabe. Trocar por `User.jobTitle` assim que T011 e T095 o criarem, e até lá **omitir o campo** em vez de preenchê-lo com o papel: um documento selado que declara cargo errado é pior que um que não declara cargo (`contradicts`, dependência de T095)
- [ ] T170 **MÉDIO** `apps/api/src/notifications/notifications.service.ts:70-76` captura a falha de envio e a escreve em `logger.error` — não fica consultável, não tem serviço/operação/causa em campo estruturado, não identifica destinatário nem transição. FR-123 e FR-112 exigem **registro**, não log de aplicação. Persistir a falha em entidade consultável; T059 é o teste correspondente e hoje passaria contra uma implementação que não cumpre o requisito (`partial`)
- [x] T171 **BAIXO** Concluída junto com T032 (mesmo commit), não em separado — a nota "acopla a T032" desta tarefa se mostrou literal: sem `CORS_ORIGIN` obrigatória e `credentials: true`, o cookie de sessão implementado em T032 simplesmente não chega ao navegador em nenhum ambiente onde web e API estão em origens distintas (o caso de desenvolvimento padrão deste repositório). `CORS_ORIGIN` adicionada a `REQUIRED_ENV_VARS` (`env.validation.ts`), ramo aberto de `enableCors()` removido de `main.ts` (agora incondicional, com `credentials: true`), variável documentada em `.env.example` e derivada de `WEB_PORT` em `scripts/manage.js` para `.env` pré-existentes

**Checkpoint**: a trilha de auditoria tem autor e alcance. Só então US6–US8 constroem prova sobre ela.

---

## Dependencies & Execution Order

### Fases

| Fase | Depende de | Bloqueia |
|---|---|---|
| 1 — Setup | — | Tudo |
| 2 — Foundational | Fase 1 | **Todas** as histórias |
| 3 — US1 (P1) | Fase 2 | — |
| 4 — US2 (P2) | Fase 2 | — |
| 5 — US3 (P3) | Fase 2 | — |
| 6 — US4 (P4) | Fase 2 | — |
| 7 — US5 (P5) | Fase 2 | — |
| 8 — US6 (P6) | Fase 2 | — |
| 9 — US7 (P7) | Fase 2 | — |
| 10 — US8 (P8) | Fase 2 | — |
| 11 — Polish | Histórias desejadas | — |
| 12 — Convergência | Fase 1 | T166/T167 bloqueiam US5, US6, US7 e US8 |

### Dependências reais entre histórias

Todas são **independentemente testáveis** com dados semeados. As dependências abaixo são de **dado**,
não de código — cada história pode ser desenvolvida em paralelo, desde que o seed forneça o insumo:

- US3 precisa de relatórios **concluídos** para a nota fazer sentido (`seed:demo` fornece).
- US6, US7 e US8 leem o acervo congelado; sem relatórios concluídos ainda há o que testar, mas o teste
  fica restrito ao conjunto vazio — que é, ele mesmo, um caso obrigatório.
- US8 lê o mesmo congelado que US6: a paridade entre as duas (T145) só é verificável com ambas de pé.

### Dependências internas críticas

- T002 antes de T010–T019 — se `multiSchema` não funcionar, o modelo inteiro muda.
- T010–T019 antes de T020–T025 — schema antes de migração.
- T022 depende de T016; T023 depende de T017; T024 depende de T015.
- **T035 é o último passo da Fase 2**: revogar DML antes dos backfills faz T022–T025 falharem.
- T027 antes de T028; T029/T030 antes de T114, T140 e T154.
- T030a (`absence.util.ts`) está na Fase 2 justamente para que US6 e US8 não dependam de US1 — a semântica de ausência tem **uma** origem, e ela é fundação.
- T129 antes de T130 antes de T132 antes de T133/T134 — serialização, assinatura, selo, artefato.
- T032 antes de T033 — o backend emite o cookie antes de o frontend deixar de gravar o token.
- **T166 e T167 antes de T094, T097, T114, T140 e T154** — todas gravam ou leem trilha; hoje gravariam
  em uma trilha anônima e de alcance parcial, e os testes passariam sem que o requisito fosse cumprido.
- T166 é a mesma correção de T027/T028 vista pelo lado do que já existe: fechar as duas em separado
  produz dois mecanismos de contexto de auditoria concorrentes. Fechar juntas.
- T169 depende de T095 (que depende de T011) — até lá, o campo `cargo` do documento é omitido.

### Oportunidades de paralelismo

- Fase 1: T003, T004, T005, T006, T009 juntas.
- Fase 2: T015, T017, T018, T018a juntas (modelos distintos); T026/T029 e T031 em paralelo.
- Dentro de cada história: todas as tarefas `[TEST]` marcadas `[P]` rodam juntas, antes da
  implementação.
- Entre histórias: fechada a Fase 2, as oito fases de história são independentes por equipe.
- Frontend e backend de uma mesma história raramente colidem — as tarefas em `apps/web/` estão
  marcadas `[P]` sempre que não dependem de contrato ainda não implementado.

---

## Parallel Example: User Story 6

```bash
# Todos os testes de US6 primeiro, em paralelo:
Task: "audit-query.service.spec.ts — matriz esparsa com código de ausência exato"
Task: "audit-query.service.spec.ts — mudança de nível no meio do intervalo"
Task: "audit-query.service.spec.ts — conjunto vazio sem relaxar filtro"
Task: "determinism.spec.ts — duas execuções, mesma ordem"
Task: "audit-scope.spec.ts — escopo restrito não ganha unidade nova"

# Depois, frontend e backend em paralelo:
Task: "audit-query.service.ts + paginação keyset"
Task: "AuditPage.tsx + AbsenceLegend.tsx + SparseMatrix.tsx"
```

---

## Implementation Strategy

### MVP (Fases 1–3)

Setup + Foundational + US1. Ao fim disso a plataforma já é **constitucionalmente conforme** — trilha
imutável, ausência preservada, sessão em cookie — e o elaborador percorre o ciclo mensal inteiro.

**PARE E VALIDE** aqui: quickstart V1, V2, V3, V5. A Fase 2 é a mais arriscada de todo o plano;
descobrir um problema nela depois de seis histórias construídas em cima custa muito mais.

### Entrega incremental

1. Fases 1–2 → fundação conforme
2. + US1 → MVP, ciclo mensal operante
3. + US2 → documento verificado, não mais declaração unilateral
4. + US3 → instrumento de gestão
5. + US4, US5 → autonomia administrativa
6. + US6 → acervo defensável em auditoria
7. + US7 → prova oponível a terceiro
8. + US8 → alcance corporativo

### Observação sobre esforço

US1–US5 somam 61 tarefas e US6–US8 somam 63 — e nem a contagem quase igual nem a pequena vantagem do
segundo bloco descrevem o esforço real. As 61 primeiras são quase todas ajuste sobre código
existente; as 63 seguintes constroem três superfícies que **não têm nenhuma linha escrita hoje**.
Tratar os dois blocos como equivalentes subestima o segundo pela metade.

---

## Notes

- `[P]` = arquivos distintos, sem dependência pendente
- Todo teste é escrito antes da implementação que o satisfaz, e deve falhar antes de passar
- Commit por tarefa ou por grupo lógico; T034 é exceção — vai **junto** com T032–T033
- Cobertura ≥ 80% em ambos os workspaces é portão, não meta
- Parar em qualquer checkpoint é válido; parar no meio da Fase 2 não é — a migração precisa fechar
