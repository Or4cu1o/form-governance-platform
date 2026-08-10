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
- Riscos de segurança aceitos e documentados: `apps/api/SECURITY-NOTES.md` — checar antes de mexer em envio de e-mail (`nodemailer`), upload (`multer`) ou sessão (ver "Autenticação" na tabela Stack abaixo).
- Orquestração de serviços via `scripts/manage.js` (`npm run start|status|restart|stop|down|deploy|deploy:seed`).
- Backup/PITR: `docs/backup-restore.md` (`npm run backup:base` / `npm run backup:drill`), registro de exercícios em `docs/backup-restore-drill-log.md`.

## Módulos do backend (`apps/api/src/`)

Além dos módulos centrais de formulário/relatório (`forms`, `reports`, `validation`, `evidence`,
`admin`, `users`, `auth`), a plataforma tem módulos dedicados às fases mais recentes do Spec Kit:

| Módulo | Responsabilidade |
|---|---|
| `catalog` | Catálogo canônico de indicadores e balanceamento de pesos (soma = 10,00) |
| `audit` | Consulta multi-eixo, matriz esparsa, paginação keyset, trilha de auditoria |
| `sealing` | Serialização canônica e selo de integridade (assinatura, `contentDigest`/`artifactDigest`) |
| `verification` | Verificação pública de selo (`GET /verificar/:codigo`), sem autenticação |
| `analytics` | Camada de BI somente-leitura (views em `analytics.*`) e resolver de evidência com token de uso único |

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 10 + Prisma ORM + PostgreSQL |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Autenticação | JWT em cookie `httpOnly` + CSRF de submissão dupla, RBAC por role e unidade, bloqueio automático por conta (camada secundária por IP) |
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
