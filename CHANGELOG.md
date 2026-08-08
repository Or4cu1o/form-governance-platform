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

### Changed

- `AuditLog` movido do schema `public` para `audit`, com contexto de requisição
  (`sourceIp`, `userAgent`, `origin`, `requestId`) e snapshots de autoria (`nome`, `cargo`, `perfil`,
  `unidade` à época do evento) — FR-069.
- O gatilho de auditoria (`fn_write_audit_log`) passa a **rejeitar** qualquer escrita sem
  `app.origin` de sessão definida, em vez de gravar silenciosamente com autor nulo.

### Fixed

- `EvidenceFile.bucket` e `FormIndicator.catalogEntryId`, antes ausentes, agora obrigatórios e
  preenchidos em todos os pontos de escrita (`EvidenceService`, `ValidationService`,
  `FormIndicatorsService`, seeds) — sem esse ajuste o build e os seeds quebravam silenciosamente em
  runtime, já que `prisma/` está fora do escopo de type-check do Nest.

## Fases do Spec Kit (`specs/001-plataforma-formops-base/`)

Referência cruzada para quem navega por commit em vez de por `tasks.md`:

- **Fase 1 — Setup** (T001-T009): concluída. `multiSchema`, dependências de selagem/antivírus,
  custódia de chave, provisionamento de buckets.
- **Fase 2 — Foundational** (T010-T040): em andamento. Correções de modelo e entidades novas
  aplicadas (T010-T019); migrações SQL aplicadas e verificadas contra Postgres real (T020-T025);
  contexto/trilha de auditoria, sessão em cookie e revogação de DML pendentes.
