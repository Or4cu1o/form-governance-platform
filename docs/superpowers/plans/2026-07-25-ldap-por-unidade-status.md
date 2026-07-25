# Integração LDAP por Unidade — Status da Implementação

> **Branch:** `feature/ldap-por-unidade` (worktree: `.worktrees/feature-ldap-por-unidade`)
> **Plano original:** `docs/superpowers/plans/2026-07-23-ldap-por-unidade.md`
> **Última atualização:** 2026-07-25
> **Status geral:** 13/13 tarefas implementadas e commitadas localmente. **Push ao remoto pendente** (bloqueado por falta de autenticação Git no ambiente).

## 1. Objetivo da feature

Permitir que cada `Unit` associe uma ou mais configurações LDAP (Active Directory), autenticando usuários daquela unidade com suas credenciais de domínio, mapeando grupos do AD para os cargos Observador/Elaborador/Revisor automaticamente, e para Aprovador/Administrador **somente** via fila de aprovação manual por um Administrador.

Restrições de negócio inegociáveis (definidas pelo usuário e mantidas em todas as tarefas):

1. Backend apenas (`apps/api`) — nenhuma mudança em `apps/web`.
2. Grupo do AD **sugere** cargo; **admin aprova**. Aprovador/Administrador nunca são concedidos automaticamente.
3. Aprovador/Administrador **nunca são rebaixados automaticamente** — só mudam por ação de um admin, ou se o usuário for bloqueado no AD.
4. Mensagens de erro de autenticação são **sempre genéricas** ("Credenciais inválidas") — nunca revelam se o usuário existe ou se a senha está errada.
5. Senha de bind (service account) é criptografada em repouso (AES-256-GCM), nunca retornada por nenhum endpoint.
6. Todo filtro LDAP construído com input externo passa por escaping RFC 4515.
7. Commit ao final de cada tarefa; push somente ao final da última tarefa.

## 2. O que foi implementado (13/13 tarefas)

### Task 1 — Schema Prisma (commit `22d5731`)
- Enums `AuthSource` (`LOCAL`, `LDAP`) e `ElevationStatus` (`PENDING`, `APPROVED`, `REJECTED`, `REVOKED`).
- `Unit.ldapEnabled` (boolean) e relação `Unit.ldapConfigs`.
- `User.passwordHash` tornado opcional; novos campos `authSource`, `ldapConfigId`, `ldapUsername`; unique composto `[ldapConfigId, ldapUsername]`.
- Modelos novos: `LdapConfig`, `LdapGroupMapping`, `RoleElevationRequest`.
- Migration `add_ldap_integration` + migration separada `add_ldap_audit_triggers` (estende `fn_write_audit_log()` para as 3 tabelas novas).

### Task 2 — Exigência de chave de criptografia (commit `189d887`)
- `LDAP_CONFIG_ENCRYPTION_KEY` validada no boot (`env.validation.ts`) — a aplicação falha ao iniciar sem ela.

### Task 3 — Criptografia AES-256-GCM (commit `603b348`)
- `ldap-crypto.util.ts`: `encrypt()`/`decrypt()` da senha de bind, formato `iv:authTag:ciphertext`.

### Task 4 — Parsing de identifier com domínio (commit `cb19392`)
- `ldap-identifier.util.ts`: reconhece `DOMINIO\usuario` e `usuario@dominio`.

### Task 5 — Escaping RFC 4515 (commit `b6c78c0`)
- `ldap-filter.util.ts`: escapa caracteres especiais em filtros LDAP construídos com input do usuário (previne LDAP injection).

### Task 6 — Resolução de cargo a partir dos grupos do AD (commit `9e23908`)
- `role-sync.util.ts`: aplica automaticamente Observador/Elaborador/Revisor a partir de `LdapGroupMapping`; nunca aplica Aprovador/Administrador diretamente — nesses casos, gera uma `RoleElevationRequest` pendente.

### Task 7 — LdapClientService (commit `b08e2d1`)
- `ldap-client.service.ts` (via `ldapts`): bind autenticado, busca de usuário e grupos no AD. Recusa unauthenticated bind (RFC 4513 — rejeita senha vazia).

### Task 8 — CRUD administrativo de configurações LDAP (commit `7eaf32c`)
- `ldap-configs.controller.ts` / `ldap-configs.service.ts`
- Rotas: `admin/units/:unitId/ldap-configs` (`GET`, `POST`, `PATCH :id`, `PATCH :id/deactivate`, `PATCH :id/activate`).
- Senha de bind nunca é retornada nas respostas.

### Task 9 — CRUD de mapeamento grupo → cargo (commit `addae02`)
- `ldap-group-mappings.controller.ts` / `.service.ts`
- Rotas: `admin/units/:unitId/ldap-configs/:ldapConfigId/group-mappings` (`GET`, `POST`, `DELETE :id`).

### Task 10 — Fila de aprovação de elevação de cargo (commit `3d65cda`)
- `role-elevation-requests.controller.ts` / `.service.ts`
- Rotas: `admin/elevation-requests` (`GET`, `POST :id/approve`, `POST :id/reject`).
- É o único caminho pelo qual um usuário recebe Aprovador/Administrador.

### Task 11 — LdapAuthService (commit `b80bd7e`)
- `ldap-auth.service.ts`: orquestra bootstrap (lista de unidades com LDAP habilitado para o popup de seleção), provisionamento de novo usuário no primeiro login, autenticação de usuário já existente vinculado ao LDAP, autenticação por domínio (`DOMINIO\usuario`), e sync de grupos a cada login.

### Task 12 — Integração no AuthService/AuthController (commit `f83312b`)
- `auth.service.ts::authenticate()` roteia por prioridade:
  1. Usuário existente com `authSource=LOCAL` → valida senha local (bcrypt).
  2. Usuário existente com `authSource=LDAP` → delega para `ldapAuthService.authenticateExistingLdapUser`.
  3. Identifier com domínio (`DOMINIO\usuario`/`usuario@dominio`) → `ldapAuthService.authenticateByDomain`.
  4. Usuário desconhecido sem `unitId` → lança `UnitSelectionRequiredException` (HTTP 428) com a lista de unidades LDAP.
  5. Usuário desconhecido com `unitId` → `ldapAuthService.authenticateByUnit` (provisiona no primeiro login).
- `auth.controller.ts`: novo endpoint público `GET /auth/ldap-units` (metadados não sensíveis de unidades com LDAP, para o popup de seleção). Rate limit dedicado em `POST /auth/login` (5 req/min) — achado HIGH da revisão de segurança da Fase 12 (força bruta sem throttling).

### Task 13 — Registro do módulo raiz (commit `f4ed0d3`)
- `LdapModule` registrado diretamente em `app.module.ts` (antes só era alcançado transitivamente via `AuthModule`), garantindo que `LdapConfigsController`, `LdapGroupMappingsController` e `RoleElevationRequestsController` sejam expostos na aplicação.

## 3. Verificações executadas

| Verificação | Resultado |
|---|---|
| Suíte `src/(auth\|ldap\|users)` | **16 suítes / 87 testes — 100% passando** |
| Suíte restante do backend | 40/41 suítes, 258/261 testes passando |
| `tsc --noEmit` (projeto inteiro) | **Zero erros de tipo** |
| Coverage `src/ldap/**` (Task 13, Step 3) | **Não executado** |
| Lint (Task 13, Step 4) | **Não executado** |

A única falha de teste (`lifecycle/report-lifecycle.service.spec.ts`, 3 testes, timeout de hook do Prisma) é **pré-existente e fora de escopo** — o próprio plano documenta que essa suíte já falhava antes da Task 1 desta feature e não é uma regressão introduzida pela integração LDAP.

## 4. Segurança — controles aplicados

- Senha de bind: AES-256-GCM, nunca serializada em respostas de API.
- Filtros LDAP: escaping RFC 4515 em todo input externo.
- Unauthenticated bind (senha vazia): rejeitado explicitamente (RFC 4513).
- Rate limiting: `POST /auth/login` limitado a 5/min (proteção contra força bruta/credential stuffing).
- Elevação de cargo (Aprovador/Administrador): nunca automática, sempre via fila `RoleElevationRequest` revisada por um Administrador.
- Rebaixamento de cargo elevado: nunca automático — só por ação manual de admin ou bloqueio no AD (a sync de grupos do login só *adiciona* cargos baixos, nunca *remove* Aprovador/Administrador).
- Mensagens de erro de autenticação: sempre genéricas ("Credenciais inválidas"), independente de o usuário existir ou não.
- `LDAP_CONFIG_ENCRYPTION_KEY` obrigatória no boot — a aplicação recusa iniciar sem ela.

## 5. Pendências

### 5.1 Bloqueador único: push ao remoto (Task 13, Step 7)

Todos os 13 commits estão prontos localmente na branch `feature/ldap-por-unidade`, mas **não foram enviados ao GitHub**. Tentativas nesta sessão:

- `git push` via HTTPS: falhou — `fatal: could not read Username for 'https://github.com'` (sem credenciais configuradas/cacheadas no ambiente).
- `ssh -T git@github.com`: falhou — `Host key verification failed.`

**Como prosseguir:** o usuário precisa resolver a autenticação manualmente (não deve ser contornado automaticamente, por segurança):
```bash
# Opção A — Personal Access Token via HTTPS
git -C .worktrees/feature-ldap-por-unidade \
  push https://<SEU_TOKEN>@github.com/Or4cu1o/form-validation-platform.git \
  feature/ldap-por-unidade

# Opção B — gh CLI
gh auth login
git -C .worktrees/feature-ldap-por-unidade push -u origin feature/ldap-por-unidade

# Opção C — SSH (após configurar known_hosts corretamente)
ssh-keyscan github.com >> ~/.ssh/known_hosts   # só depois de verificar o fingerprint
git -C .worktrees/feature-ldap-por-unidade push -u origin feature/ldap-por-unidade
```

### 5.2 Verificações do plano ainda não executadas

- **Coverage** (`src/ldap/**` ≥ 80%):
  ```bash
  cd apps/api
  npm run test:cov -- --collectCoverageFrom="src/ldap/**/*.ts" --collectCoverageFrom="!src/ldap/**/*.spec.ts"
  ```
- **Lint**:
  ```bash
  cd apps/api
  npm run lint
  ```

Recomenda-se rodar ambos antes do merge, mesmo com o push já feito — não bloqueiam o push em si, mas fazem parte do checklist de conclusão da Task 13.

### 5.3 Fora de escopo (não é ação necessária)

- Falha pré-existente em `lifecycle/report-lifecycle.service.spec.ts` — documentada no plano original como já quebrada antes desta feature.

## 6. Próximos passos sugeridos (pós-merge)

1. Resolver autenticação Git e fazer o push (seção 5.1).
2. Rodar coverage + lint (seção 5.2) e corrigir eventuais achados.
3. Abrir PR de `feature/ldap-por-unidade` → `main` com o histórico completo dos 13 commits.
4. Popular `LdapConfig` de pelo menos uma unidade em ambiente de homologação e validar o fluxo de login real contra um AD de teste (os testes atuais usam mocks; nunca houve validação contra um DC real).
5. Nenhuma mudança em `apps/web` foi feita — se o frontend precisar do popup de seleção de unidade (`GET /auth/ldap-units`) ou de telas administrativas para `LdapConfig`/`LdapGroupMapping`/`RoleElevationRequest`, isso é trabalho futuro, fora do escopo deste plano.
