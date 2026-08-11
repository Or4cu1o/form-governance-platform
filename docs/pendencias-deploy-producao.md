# Pendências pós-demo

Itens levantados durante a preparação da demonstração via túnel (2026-08-10/11) que precisam de
atenção **antes** de um deploy real (EC2), listados por prioridade.

## 1. WAL archiving (PITR) desativado — `docker-compose.yml`

`archive_mode` do Postgres está `off`. O volume `formops_wal_archive` é criado `root:root` pelo
Docker; a imagem oficial `postgres:16-alpine` só ajusta a posse do diretório `PGDATA`
(`/var/lib/postgresql/data`), não de volumes extras — então `archive_command` falhava com
`Permission denied` a cada tentativa. Trocar a versão da imagem (mesmo para uma LTS mais recente)
não resolve: é um comportamento do entrypoint da imagem, não do motor do banco.

**Correção pendente:** adicionar um passo de inicialização (init container ou script) que ajusta a
posse (`chown`) do volume `formops_wal_archive` para o usuário `postgres` antes do serviço subir, e
reativar `archive_mode=on` + `archive_command` + `archive_timeout=300` (config original documentada
em `docs/backup-restore.md`).

**Risco enquanto pendente:** sem WAL archiving, a recuperação pontual (PITR) fica limitada ao último
backup base — não há como restaurar para um instante específico entre backups.

## 2. `TUNNEL_MODE` — cookie de sessão `SameSite=None`

Ativado (`TUNNEL_MODE=true` no `.env` local, não versionado) especificamente porque a demo usa dois
túneis Cloudflare separados (`web` e `api`), que o navegador trata como sites distintos. Essa flag
**não deve ser usada no deploy EC2** — lá, web e api estarão sob a mesma origem/domínio, e o padrão
`SameSite=Lax` (que protege a navegação a partir de link recebido por e-mail, cenário F14) volta a
se aplicar normalmente sem nenhuma ação extra.

**Ação pendente:** garantir que `TUNNEL_MODE` fique ausente (ou `false`) no `.env` do ambiente EC2.
Já documentado com esse aviso em `.env.example`.

## 3. Segredos e chave de selagem gerados só para esta demo

`JWT_SECRET`, `EVIDENCE_RESOLVER_HMAC_SECRET`, `APP_DB_PASSWORD`, `TABLEAU_RO_DB_PASSWORD` e o par
de chaves Ed25519 em `apps/api/keys/` (gitignored) foram gerados especificamente para este ambiente
de teste.

**Ação pendente:** gerar segredos e chave de selagem **novos** no deploy EC2 — nunca reaproveitar os
desta demo.

## 4. Exposição de portas de infraestrutura ao host

`docker-compose.yml` publica `postgres` (5432), `minio` (9000/9001) e `clamav` (3310) diretamente no
host, útil para depuração local. Vale revisar antes de produção se esses serviços devem continuar
expostos fora da rede interna dos containers, ou se só a `api` precisa ser alcançável de fora.

## 5. Suítes de teste `analytics-views.spec.ts` / `audit-actor.spec.ts`

Falham quando rodadas contra o banco local desta demo (que acumulou dados de uso manual durante os
testes de login/seed). Confirmado que **não é regressão de código** — as mesmas falhas ocorrem com
as alterações desta sessão revertidas, contra o mesmo banco. Rodar a suíte completa contra um banco
limpo (`docker compose down -v` seguido de `up`) antes de qualquer validação formal de cobertura.
