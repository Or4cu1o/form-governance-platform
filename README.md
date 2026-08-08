# FormOps — Plataforma de Governança e Automação de Formulários

**FormOps** é uma plataforma web corporativa para digitalizar, centralizar, automatizar e auditar o preenchimento de formulários e a geração de relatórios operacionais. Ela substitui o modelo legado baseado em planilhas/documentos manuais por um fluxo governado por prazos em dias úteis, trilhas de auditoria, integrações (API, Webhooks, n8n) e um motor de formulários dinâmicos administrável sem código.

Consulte [`docs/PROMPT.md`](./docs/PROMPT.md) para a especificação de requisitos completa que orientou o desenho do produto.

## Índice

- [Requisitos](#requisitos)
- [Configuração Inicial](#configuração-inicial)
- [Gerenciamento Rápido via NPM](#-gerenciamento-rápido-via-npm)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Roles e Governança (RBAC)](#roles-e-governança-rbac)
- [Credenciais Padrão (Desenvolvimento)](#credenciais-padrão-desenvolvimento)
- [Testes](#testes)
- [Build de Produção](#build-de-produção)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## Requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | 22.x |
| npm | 10.x (incluso no Node 22) |
| Docker + Docker Compose | necessário para Postgres e MinIO (via `npm start`) |

O projeto é um monorepo gerenciado via [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) (`apps/api`, `apps/web`) — não é necessário instalar dependências em cada workspace separadamente, `npm install` na raiz resolve tudo.

---

## ⚡ Gerenciamento Rápido via NPM

A aplicação conta com um orquestrador integrado em Node.js (`scripts/manage.js`) mapeado diretamente nos comandos nativos do `npm`:

```bash
# Iniciar a aplicação e containers em background (com validação e healthcheck)
npm start

# Verificar status da aplicação, ocupação de portas, containers Docker e credenciais
npm run status

# Reiniciar aplicação e containers Docker
npm run restart

# Parar apenas a aplicação local (mantém banco de dados rodando)
npm run stop

# Parar aplicação e derrubar containers Docker
npm run down

# Executar um deploy limpo do zero (limpa cache/volumes/node_modules e reinstala)
npm run deploy

# Executar deploy limpo do zero + semeadura dos formulários proprietários (N1/N3)
npm run deploy:seed

# Semeia formulários proprietários no banco de dados (N1/N3)
npm run seed:proprietary

# Validar pré-requisitos da stack e listar comandos
npm run formops
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 10 + Prisma ORM + PostgreSQL |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Autenticação | JWT (Bearer), RBAC por role e unidade |
| Armazenamento de evidências | S3-compatível (MinIO em dev) |
| E-mail | SMTP via Nodemailer (modo log quando não configurado) |
| Orquestrador CLI | Node.js nativo (`scripts/manage.js`) |
| Testes backend | Jest (unit + integração contra Postgres real) |
| Testes frontend | Vitest + Testing Library |
| Monorepo | npm workspaces (`apps/api`, `apps/web`) |

---

## Arquitetura

```
apps/
  api/    NestJS — API REST, regras de negócio, Prisma, cron de abertura de período
  web/    React (Vite) — SPA consumindo a API via Bearer JWT
scripts/
  manage.js  Orquestrador em Node.js para gerenciamento dos serviços
```

- **Estado Residente**: dados estruturais estáveis (inventário, licenças, links) são clonados automaticamente na virada do mês pelo motor de cron do backend, reduzindo retrabalho do Elaborador.
- **Engine No-Code de Formulários**: Administradores criam/editam templates, tópicos e indicadores (com fórmula, operador e meta) sem alterar código — mudanças refletem nos relatórios futuros mantendo o histórico intacto.
- **Soft Delete Obrigatório**: nenhuma entidade (usuário, unidade, indicador) é fisicamente excluída — desativação via `is_active = false`, preservando a integridade referencial histórica.

---

### Roles e Governança (RBAC)

| Role | Escopo |
|---|---|
| Observador | Leitura de relatórios da própria unidade e unidades permitidas |
| Elaborador | Preenche variáveis e evidências da própria unidade |
| Revisor | Valida/edita dados da unidade antes de enviar à Matriz |
| Aprovador | Audita e aprova/reprova indicadores de todas as unidades |
| Administrador | Acesso irrestrito — usuários, unidades e Engine No-Code |

O RBAC do frontend é focado em UX (oculta ações que o usuário não pode fazer); a autorização real é sempre revalidada pelo backend em cada requisição — ver [`apps/web/SECURITY-NOTES.md`](./apps/web/SECURITY-NOTES.md#2-rbac-no-frontend-é-apenas-ux--a-autorização-real-é-sempre-no-backend).

---

## Configuração Inicial

1. Copie o `.env` de exemplo e ajuste os valores (segredos, credenciais do admin inicial, portas):

   ```bash
   cp .env.example .env
   ```

2. Inicie a aplicação com um único comando:

   ```bash
   npm start
   ```

   *O comando subirá o Postgres + MinIO + ClamAV via Docker, aplicará migrações Prisma, provisionará os buckets de evidência (imutável e quarentena), executará os seeds iniciais, iniciará API e Web em background e validará o Healthcheck.*

---

## Custódia da chave de selagem (Ed25519)

O selo de integridade dos documentos exportados (Fase 9) é assinado com uma chave Ed25519. A
chave privada **nunca** entra no repositório nem em variável de ambiente — `SEALING_PRIVATE_KEY_PATH`
guarda apenas a **referência** ao arquivo (montado com permissão restrita em desenvolvimento; em
produção, o caminho aponta para o material entregue por um serviço de gestão de chaves).

Gerando o par em desenvolvimento (Ed25519 via `node:crypto`, sem dependência externa):

```bash
node -e "const {generateKeyPairSync}=require('crypto');const {privateKey}=generateKeyPairSync('ed25519');console.log(privateKey.export({type:'pkcs8',format:'pem'}))" > /caminho/seguro/sealing-active.pem
chmod 600 /caminho/seguro/sealing-active.pem
```

Aponte `SEALING_PRIVATE_KEY_PATH` para esse arquivo e `SEALING_KEY_ID` para um identificador
estável do par (ex.: `seal-2026-01`). Ao rotacionar: gere um novo par sob um novo `keyId`, mova a
chave **pública** do par anterior para `retired/<keyId-anterior>.pub.pem` no mesmo diretório (nunca
a privada — depois da rotação ela não assina mais nada) e só então atualize `SEALING_KEY_ID` para o
novo par. Selos emitidos sob um `keyId` aposentado continuam verificáveis indefinidamente
(`key-custody.service.ts`, FR-104).

---

## Credenciais Padrão (Desenvolvimento)

Ao executar `npm start` ou `npm run status` em modo `NODE_ENV=development`, o console exibirá:

- **Administrador Inicial**: Matrícula `00001` | `admin@agirsaude.org.br` | Senha: `Agir@2026`
- **Usuários de Teste (Senha padrão: `FormOpsTeste@2026`)**:
  - Observador: `observador@matriz.dev` (Matrícula `10001`)
  - Elaborador: `elaborador@matriz.dev` (Matrícula `10002`)
  - Revisor: `revisor@matriz.dev` (Matrícula `10003`)
  - Aprovador: `aprovador@matriz.dev` (Matrícula `10004`)
  - Administrador: `administrador@matriz.dev` (Matrícula `10005`)

---

## Testes

```bash
# Suíte completa (api + web)
npm test

# Apenas a API (Jest — integração com Postgres)
npm run test --workspace=apps/api

# Apenas o frontend (Vitest + Testing Library)
npm run test --workspace=apps/web -- run

# Cobertura do frontend
npm run test --workspace=apps/web -- run --coverage
```

---

## Build de Produção

```bash
npm run build
```

Compila `apps/api` (NestJS → `dist/`) e `apps/web` (Vite → `dist/`, SPA estática). Cabeçalhos de segurança HTTP (CSP, HSTS, etc.) devem ser configurados na camada de hospedagem/reverse proxy — ver [`apps/web/SECURITY-NOTES.md`](./apps/web/SECURITY-NOTES.md#7-cabeçalhos-de-segurança-http-csp-hsts-etc).

---

## Explorando o Código

O repositório mantém um grafo de conhecimento gerado a partir do código-fonte em [`graphify-out/`](./graphify-out/), com mapa de comunidades, nós centrais ("god nodes") e conexões entre módulos. Para uma visão rápida da arquitetura sem navegar arquivo por arquivo, abra [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md) ou o grafo interativo [`graphify-out/graph.html`](./graphify-out/graph.html) em um navegador.

---

## Contribuindo

Veja [`CONTRIBUTING.md`](./CONTRIBUTING.md) para o fluxo de branches, padrão de commits, requisitos de testes/lint e checklist de revisão antes de abrir um Pull Request.

---

## Licença

Distribuído sob a licença MIT — ver [`LICENSE`](./LICENSE).
