# Contribuindo com o FormOps

Obrigado por contribuir com o **FormOps**! Este guia resume o fluxo de trabalho, os padrões de código e os requisitos de qualidade esperados antes de abrir um Pull Request.

## Índice

- [Antes de Começar](#antes-de-começar)
- [Fluxo de Branches](#fluxo-de-branches)
- [Padrão de Commits](#padrão-de-commits)
- [Ambiente de Desenvolvimento](#ambiente-de-desenvolvimento)
- [Padrões de Código](#padrões-de-código)
- [Testes](#testes)
- [Migrações do Banco de Dados (Prisma)](#migrações-do-banco-de-dados-prisma)
- [Segurança](#segurança)
- [Checklist do Pull Request](#checklist-do-pull-request)

---

## Antes de Começar

1. Leia [`README.md`](./README.md) para entender a stack e como subir o ambiente local.
2. Para mudanças estruturais ou de requisitos de produto, consulte [`docs/PROMPT.md`](./docs/PROMPT.md) — é a especificação que orienta as decisões de arquitetura do FormOps.
3. Se a dúvida for sobre como um módulo se conecta a outro, o grafo de conhecimento em [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md) costuma responder mais rápido do que navegar pelo código.

## Fluxo de Branches

- `main` é a branch protegida e sempre deployável.
- Crie uma branch a partir de `main` com um nome descritivo do escopo da mudança, por exemplo:
  - `feat/relatorio-exportacao-pdf`
  - `fix/sla-calculo-dias-uteis`
  - `chore/atualizar-dependencias`
- Mantenha a branch focada em uma única mudança lógica — PRs pequenos e coesos são revisados mais rápido.
- Rebase/atualize sua branch com `main` antes de abrir o PR para evitar conflitos de última hora.

## Padrão de Commits

O histórico do projeto segue [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<escopo opcional>): <descrição no imperativo>

<corpo opcional explicando o porquê>
```

**Tipos usados no projeto:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

**Escopos comuns:** `api`, `web`, `seed`, `platform`, `scripts`, ou omitido quando a mudança afeta o repositório como um todo.

Exemplos reais do histórico:

```
feat(platform): garantir abertura automatica do periodo vigente e exibir status de prazo SLA
fix(web): uniformizar visual dos botoes de exportacao para variant secondary
test(web): atualizar suite de testes unitarios para a nova rotina de prazos e acoes
docs: adiciona plano de implementacao da integracao LDAP por unidade
```

- Escreva a descrição focada no **porquê** da mudança, não apenas no que foi alterado — o diff já mostra o "o quê".
- Um commit deve representar uma unidade de trabalho completa e testável.

## Ambiente de Desenvolvimento

```bash
# 1. Instale as dependências do monorepo (raiz + workspaces)
npm install

# 2. Copie e ajuste as variáveis de ambiente
cp .env.example .env

# 3. Suba tudo (Postgres + MinIO via Docker, migrações, seeds, API e Web)
npm start

# 4. Acompanhe status, portas e credenciais geradas
npm run status
```

Para desenvolvimento com hot-reload isolado por workspace:

```bash
npm run dev:api   # NestJS em modo watch
npm run dev:web   # Vite dev server
```

## Padrões de Código

- **TypeScript em modo estrito** em ambos os workspaces — não introduza `any` sem justificativa.
- **Lint obrigatório antes do commit:**
  ```bash
  npm run lint --workspace=apps/api
  npm run lint --workspace=apps/web
  ```
- **Imutabilidade:** prefira criar novos objetos/DTOs a mutar dados existentes.
- **Nomenclatura:** `camelCase` para variáveis/funções, `PascalCase` para classes/DTOs/componentes React, `UPPER_SNAKE_CASE` para constantes.
- **Sem código morto:** remova imports, variáveis e branches não utilizados antes de abrir o PR.
- Siga os padrões já estabelecidos no módulo que você está alterando (estrutura de pastas por feature em `apps/api/src/*` e `apps/web/src/*`) em vez de introduzir uma convenção nova isolada.

## Testes

Toda mudança de comportamento deve vir acompanhada de teste correspondente.

```bash
# Suíte completa (api + web)
npm test

# Apenas a API (Jest — integração contra Postgres real)
npm run test --workspace=apps/api

# Apenas o frontend (Vitest + Testing Library)
npm run test --workspace=apps/web -- run

# Cobertura
npm run test:cov --workspace=apps/api
npm run test:cov --workspace=apps/web
```

- Testes de API que dependem do Postgres precisam do `docker compose` de desenvolvimento ativo (`npm start` ou `npm run docker:up`).
- Escreva testes que verifiquem comportamento observável (entrada → saída esperada), não detalhes de implementação.
- Nomeie os testes descrevendo o comportamento, ex.: `retorna status "Atrasado" quando o prazo SLA já venceu`.

## Migrações do Banco de Dados (Prisma)

- Toda mudança de schema em `apps/api/prisma/schema.prisma` deve gerar uma migração versionada:
  ```bash
  npm run prisma:migrate:dev --workspace=apps/api
  ```
- Nunca edite manualmente um arquivo `migration.sql` já commitado — crie uma nova migração.
- Migrações que alteram triggers, funções (`fn_*`) ou tabelas de auditoria (`audit_logs`) merecem descrição clara no corpo do commit, já que esse comportamento não é óbvio a partir do `schema.prisma` sozinho.

## Segurança

Antes de alterar código relacionado a autenticação, upload de arquivos, envio de e-mail ou armazenamento de tokens, leia os riscos já aceitos e documentados:

- [`apps/api/SECURITY-NOTES.md`](./apps/api/SECURITY-NOTES.md) — CVEs aceitos em `nodemailer`/`multer`, mitigações de injeção.
- [`apps/web/SECURITY-NOTES.md`](./apps/web/SECURITY-NOTES.md) — armazenamento de token em `sessionStorage`, RBAC de frontend vs. backend, headers de segurança HTTP.

Se sua mudança introduzir um novo risco aceito (dependência com CVE conhecido, por exemplo), documente-o no `SECURITY-NOTES.md` correspondente em vez de deixá-lo implícito no código.

Nunca commite segredos reais (`.env`, credenciais, chaves) — use `.env.example` como referência de quais variáveis existem, sempre com valores placeholder.

## Checklist do Pull Request

Antes de abrir o PR, confirme:

- [ ] `npm run lint` passa em `apps/api` e `apps/web` (conforme o workspace alterado)
- [ ] `npm test` passa localmente
- [ ] Migrações Prisma novas foram geradas via `prisma:migrate:dev` (quando aplicável)
- [ ] Nenhum segredo ou credencial real foi commitado
- [ ] `SECURITY-NOTES.md` foi atualizado se a mudança tocou em autenticação, upload, e-mail ou tokens
- [ ] A descrição do PR explica o **porquê** da mudança, não apenas o que foi alterado
- [ ] Se a mudança afeta arquitetura ou relações entre módulos, considere rodar `graphify update .` para manter `graphify-out/` atualizado
