# form-governance-platform (formops)

Monorepo npm workspaces: `apps/api` (NestJS + Prisma) e `apps/web` (Vite + React + TypeScript).

## Comandos

- Build: `npm run build` (roda build de `apps/api` e depois `apps/web`)
- Test: `npm run test` (Jest em `apps/api`, Vitest em `apps/web`)
  - Coverage: `npm run test:cov --workspace=apps/api` / `npm run test:cov --workspace=apps/web`
- Lint: `npm run lint --workspace=apps/api` / `npm run lint --workspace=apps/web` (ESLint em ambos)
- Dev: `npm run dev:api` (Nest watch) / `npm run dev:web` (Vite)
- Docker: `npm run docker:up` / `npm run docker:down` (sobe `postgres`, `minio`, `api`, `web` via `docker-compose.yml`)

## Notas do repositório

- `apps/api`: Prisma como ORM (`prisma:generate`, `prisma:migrate:dev`, `prisma:migrate:deploy`), seeds em `prisma/seed*.ts` (`npm run seed:proprietary`, `npm run seed:demo`).
- Riscos de segurança aceitos e documentados: `apps/api/SECURITY-NOTES.md` e `apps/web/SECURITY-NOTES.md` — checar antes de mexer em envio de e-mail (`nodemailer`), upload (`multer`) ou armazenamento do token JWT (`sessionStorage`).
- Orquestração de serviços via `scripts/manage.js` (`npm run start|status|restart|stop|down|deploy|deploy:seed`).

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

## Ambiente

| Ferramenta | Versão |
|---|---|
| Node.js | 26.x |
| npm | 11.x (incluso no Node 26) |
| pnpm | 11.x (incluso no Node 26) |
| PostgreSQL | postgres:16-alpine |
| MinIO | minio/minio:latest |
| Docker | 29.x |
| Docker Compose | v5 |
