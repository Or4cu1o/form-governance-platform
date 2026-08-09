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
- Pontos facultativos móveis (Carnaval, Corpus Christi) no motor de dias úteis
  (`getOptionalPontosFacultativos`/`getHolidaysForYear`), respeitando
  `SystemSetting.includeOptionalHolidays` (desligado por padrão) na abertura de período, na
  extensão de prazo pós-reprova e no cron diário do motor de SLA.
- Filtros de período de referência (`type="month"`) e busca por sigla/nome de unidade em
  `ReportsPage`, ligados aos parâmetros que o backend já aceitava sem UI correspondente.
- Indicador de proximidade e estouro de prazo da fase corrente (`DeadlineBadge`) em
  `ReportDetailPage`, além do binário atrasado/no prazo já existente.
- Módulo de catálogo canônico (`apps/api/src/catalog`): `GET/POST/PATCH /api/catalog` e
  `POST /api/catalog/:id/deactivate`, com `measurementUnit` imutável após o primeiro vínculo e
  desativação recusada com indicador ativo vinculado (409 em ambos os casos, FR-064).
- `AdminCatalogPage.tsx` e `CatalogEntryPicker.tsx`: catálogo administrável e criável a partir do
  próprio cadastro de indicador, sem sair do formulário (FR-063).
- `FormIndicatorsService.assertBalanced`: recusa vincular um formulário a uma unidade ou
  instanciar relatório enquanto a soma dos pesos ativos não for exatamente 10,00, sem impedir o
  salvamento do formulário para correção (FR-053). `LifecycleCronService` isola falhas por unidade
  na abertura mensal de período, para que um formulário desbalanceado não trave as demais.
- Redistribuição de pesos proposta (não aplicada) ao criar, ativar ou inativar um indicador,
  exigindo confirmação explícita via novo `WeightRebalanceModal.tsx` (FR-054, US4-4).
- `EvidenceRetentionPanel.tsx`: diálogo dedicado, distinto do salvamento comum, para confirmar
  retenção de evidência indeterminada; aviso explícito de que reduzir a janela não libera o
  acervo já gravado (FR-042, FR-043).

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
- `HttpExceptionFilter` (`apps/api/src/common/filters/`), global (T039): envelope de erro único
  `{ statusCode, message, error }` em português do Brasil (FR-124) para toda resposta de falha da
  API — traduz a frase-motivo default do Nest, preserva código de erro explícito não-default, e
  nunca repassa a mensagem de uma exceção não tratada (ex.: erro do Prisma) ao cliente.
- `assertEvidenceFileSignatureMatches` (T168, `apps/api/src/common/evidence-upload.constants.ts`):
  checagem manual dos bytes iniciais (magic numbers) de PDF/PNG/JPEG/WEBP contra o mimetype
  declarado, chamada em `EvidenceService`/`ValidationService` antes de qualquer upload ao S3 — 400
  e nada gravado na divergência (FR-035). O validador embutido do Nest (`file-type`, ESM-only) foi
  descartado por ser incompatível com o sandbox `vm` do Jest sem flag experimental.
- `NotificationFailure` (T170, `schema.prisma` + migração `20260809100000_add_notification_failure`):
  registro consultável de falha de notificação — serviço, operação, causa (FR-123), destinatários e
  a `ReportInstance` afetada (FR-112) — substituindo o `logger.error` isolado de
  `NotificationsService`.
- `InheritanceService` (T046, `apps/api/src/reports/inheritance.service.ts`): herança de dados
  estruturais estáveis por **chave declarada** — chave nova na definição fica `NAO_PREENCHIDO`
  (nunca zero, nunca valor de outra chave) e a resposta é marcada `HERDADO`/`HERDADO_PARCIAL`
  (FR-021 a FR-025). Injetado em `ReportLifecycleService.openPeriodForUnit`, substituindo o clone
  bruto de `variableValues` que existia até aqui.
- Gatilho de fechamento automático de `IndicatorResponseVersion` (T047, migração
  `20260810090000_add_indicator_response_version_close_trigger`): função `SECURITY DEFINER`
  (dona `formops`) que fecha a versão corrente anterior (`valid_to`) em todo `INSERT` de uma nova —
  necessário porque `UPDATE` está revogado em `indicator_response_version` para `formops_app`
  desde T035; a aplicação só tem privilégio de `INSERT`.
- Três colunas de projeção em `IndicatorResponse` (T047, migração
  `20260810091000_add_indicator_response_projection_fields`): `calculationFailureReason`,
  `inheritanceState`, `unresolvedInheritedKeys` — espelham os campos de mesmo nome em
  `IndicatorResponseVersion`, para a tela exibi-los na própria linha do indicador sem join extra.
- `AntivirusService` (T050, `apps/api/src/evidence/antivirus.service.ts`): integra o daemon ClamAV
  (`clamscan`, já instalado em T004) via TCP — veredito `PENDENTE` → `LIBERADO` (promove ao bucket
  imutável com Object Lock) | `BLOQUEADO` (guarda pericial de `SystemSetting.forensicHoldYears`,
  nunca promove). `@Cron('*/2 * * * *')` interno varre evidência `PENDENTE`.
- `S3Service` reescrito para os dois buckets reais de evidência (T049/T050): `uploadToQuarantine`,
  `downloadObject`, `promoteToImmutable` (cópia com Object Lock + remoção da quarentena),
  substituindo o bucket único legado usado até aqui por `EvidenceService`/`ValidationService`.
- `EvidenceService.getDownloadUrl` (T049a) recusa com 403 quando `scanStatus = BLOQUEADO` e
  registra `AccessLog` (`DOWNLOAD_EVIDENCIA`) em toda leitura, sucesso ou não.
- `EvidenceService.deactivate` (T049b, rota `POST evidence-files/:id/deactivate`): desativação
  lógica de evidência com autor e data — some da superfície de trabalho, permanece íntegra em
  auditoria/exportação/analítica.
- `ReportInstancesService.assertNoEvidencePendingVerification` (T045/T052): `submitForReview`
  recusa com 400 enquanto houver `EvidenceFile` ativo com `scanStatus = PENDENTE` (FR-038).
- Badge "Herdado — confira"/"Herdado parcialmente — confira" e motivo de falha de cálculo na
  própria linha do indicador (T053, `IndicatorResponseCard.tsx`); estado "verificação pendente"/
  "bloqueado" na lista de evidências e mensagem específica de recusa por tipo no upload (T054).
- Concorrência otimista em `IndicatorResponsesService.updateValues` (T055/T056/T061, FR-129):
  `PUT /indicator-responses/:id` exige `expectedVersionId`; gravação sobre versão já não-corrente
  recusa com **409** `CONFLITO_DE_VERSAO` trazendo o valor vencedor, autor e instante
  (`IndicatorVersionConflictException`); sobrescrita deliberada via `overwriteVersionId` (segunda
  requisição explícita) fica marcada em `IndicatorResponseVersion.overwroteVersionId`.
  `HttpExceptionFilter` ajustado para preservar campos extras do corpo da exceção (antes descartava
  tudo além de `message`/`error`).
- `GET indicator-responses/:id/versions` (T062): histórico completo de versões em ordem
  cronológica estável, com autor, motivo de falha de cálculo e `overwroteVersionId` quando houver.
- `ReportSubmissionService.recordSubmission` (T063, B3/FR-058): uma linha por submissão
  (`ReportSubmission`), nunca sobrescrita; pontualidade aferida contra o prazo estendido apenas
  quando a submissão pertence a um ciclo pós-reprova (`reprovalCount > 0`) — o atraso pretérito de
  um envio anterior no mesmo ciclo nunca é perdoado retroativamente (FR-057). Gravada por
  `ReportInstancesService.submitForReview`/`submitForApproval` e por `ValidationService.finalizeReport`
  (etapas `ELABORACAO`/`REVISAO`/`APROVACAO`).
- `ValidationService.finalizeReport` (T064) passa a aferir `isElaborationOnTime`/`isReviewOnTime` a
  partir da submissão mais recente de cada etapa em `ReportSubmission`, não mais dos campos
  `submittedForReviewAt`/`submittedForApprovalAt` comparados diretamente contra o prazo original —
  os campos de conveniência em `ReportInstance` permanecem, mas deixam de alimentar o cálculo.
- `IndicatorResponsesService.updateValues` reverte `validationStatus` de `APROVADO` para
  `EM_REVISAO` no instante em que o indicador é editado (T065, US2-7) — não espera a devolução.
  `ValidationService.finalizeReport` deixa de resetar em bloco todos os indicadores na reprova:
  só o `REPROVADO` volta a `EM_REVISAO`, o `APROVADO` não-alterado permanece aprovado.
- Diálogo de conflito de versão em `IndicatorResponseCard.tsx` (T066): mostra quem alterou, quando
  e com quais valores, exigindo "Cancelar" ou "Sobrescrever mesmo assim" explícito — nunca
  sobrescrita automática. `ApiError` estendido com `body` para carregar o payload do 409.
- Coluna "Histórico de submissões" em `ReportsPage.tsx` (T067): lista cada `ReportSubmission` do
  relatório (etapa, autor, data, resultado) sem colapsar reenvios pós-reprova.

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
- `apps/api/prisma/seed-demo.ts` (T040): corrige o placeholder `measurementUnit: 'A_DEFINIR'` do
  catálogo canônico com a unidade real de cada indicador ("%" ou "pontos"), preenche `jobTitle` do
  usuário `APROVADOR` (FR-074) e provisiona explicitamente a linha única de `SystemSetting` com os
  sete parâmetros novos.
- `ReportExportService` (T169): `rodape.aprovadorResponsavel.cargo` passa a vir de `User.jobTitle`
  em vez de `User.role` — o papel de acesso (`APROVADOR`) não é o cargo funcional da pessoa. Omitido
  do payload (JSON e CSV) quando o aprovador ainda não tem `jobTitle` cadastrado (T095 pendente).

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
- **Fase 2 — Foundational** (T010-T040): concluída. Correções de modelo e entidades novas
  aplicadas (T010-T019); migrações SQL aplicadas e verificadas contra Postgres real (T020-T025);
  contexto e trilha de auditoria completos (T026-T030a); sessão em cookie concluída (T031-T034);
  revogação de DML concluída (T035-T037, com segregação de role `formops_app`); transversais
  concluídas (T038-T040: `ValidationPipe` já satisfeito, filtro de exceção pt-BR, seed de
  demonstração com catálogo/`jobTitle`/`SystemSetting`).
- **Fase 12 — Convergência** (T166-T171): concluída. T166 e T167 concluídas junto com a Fase 2 (mesma
  correção, dois ângulos, conforme recomendado); T171 concluída junto com T032 (pré-requisito
  funcional, não tarefa separada); T168 (assinatura binária de evidência), T169 (cargo funcional no
  documento selado) e T170 (registro consultável de falha de notificação) concluídas nesta sessão.
- **Fase 3 — US1 (P1), MVP** (T041-T054): concluída. Herança por chave (T046) e gravação
  append-only via `IndicatorResponseVersion` (T047, com gatilho de fechamento automático — achado
  de infraestrutura necessário, não previsto no texto literal da tarefa); cálculo impossível não
  aborta mais a gravação (T042); quarentena de evidência, antivírus via ClamAV, promoção ao bucket
  imutável, retenção carimbada no upload e desativação lógica (T049-T051); bloqueio de submissão
  com evidência pendente (T045/T052); sinalização de herança, motivo de cálculo e estado de
  verificação de segurança no frontend (T053-T054). T044 e T045a eram testes já cobertos por
  T168 e pela integração via controller, respectivamente — extensão em vez de recriação.
- **Fase 4 — US2 (P2)** (T055-T067): concluída. Concorrência otimista com 409 detalhado e
  sobrescrita deliberada (T055/T056/T060/T061); histórico de versões (T062); `ReportSubmission`
  como fonte de verdade de pontualidade por etapa, substituindo a leitura direta dos campos de
  conveniência (T057/T063/T064, implementado em `validation.service.ts` — `report-lifecycle.service.ts`
  nunca leu pontualidade, só computa prazos na abertura); reversão imediata de veredito aprovado ao
  editar e correção do reset em bloco na reprova (T058/T065); diálogo de conflito e histórico de
  submissões no frontend (T066/T067, com T066 implementado em `IndicatorResponseCard.tsx` em vez de
  `ValidationDetailPage.tsx`, que não edita valores de indicador). T059 já estava coberta pelo
  mecanismo de T170 — testado ponto a ponto para `notifySubmittedForReview`.
- **Fase 5 — US3 (P3)** (T070-T077): concluída. Congelamento de nota provado por teste dedicado
  (T070, `score-freeze.spec.ts`) — os mocks omitem a relação `formIndicator`, então uma regressão
  que voltasse a ler o catálogo vivo quebraria por acesso a `undefined`, não aprovaria um valor
  errado silenciosamente; T072 e T073 já estavam satisfeitas em `validation.service.ts` e
  `ReportSubmissionService` respectivamente (T073 mirava `report-lifecycle.service.ts`, que nunca
  aferiu pontualidade); pontos facultativos móveis e `includeOptionalHolidays` (T071/T074); filtros
  de período/busca e indicador de proximidade de prazo no frontend (T076/T077, com T077 implementado
  em `ReportDetailPage.tsx` via novo componente `DeadlineBadge`).
- **Fase 6 — US4 (P4)** (T078-T091): concluída. Novo módulo `catalog` (T078-T079, T083); T084 já
  estava satisfeita no DTO/schema, faltando apenas o consumo no frontend; T080/T081/T082 já estavam
  cobertas em outros arquivos (`formula-validator`, `evidence.service.spec.ts`), com o desvio
  documentado seguindo o mesmo precedente da Fase 5; `assertBalanced` recusa vínculo/instanciação
  com pesos fora de 10,00 (T086), com resiliência por unidade no cron (T085/T086); redistribuição
  proposta ao criar/ativar/inativar indicador, com confirmação explícita no frontend (T085/T089);
  sete parâmetros novos de `SystemSetting` expostos (T087); catálogo administrável com criação
  embutida no cadastro de indicador (T088); diálogo dedicado de retenção indeterminada e aviso de
  não liberação ao reduzir a janela (T090/T091).
