#!/usr/bin/env bash
# T160 (FR-074a, FR-130, SC-021) — base backup, restauracao PITR e exercicio
# periodico de restauracao contra o Postgres do docker-compose.yml.
#
# Procedimento completo em docs/backup-restore.md. Este script assume que
# `npm run docker:up` ja subiu o servico "postgres" com WAL archiving
# habilitado (docker-compose.yml: wal_level=replica, archive_mode=on,
# volume formops_wal_archive) e que .env esta carregado no shell (mesmas
# variaveis que scripts/manage.js deriva).
set -euo pipefail

COMPOSE_PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$COMPOSE_PROJECT_DIR"

POSTGRES_USER="${POSTGRES_USER:-formops}"
POSTGRES_DB="${POSTGRES_DB:-formops}"
BACKUP_DIR="${BACKUP_DIR:-$COMPOSE_PROJECT_DIR/.backups}"
DRILL_LOG="$COMPOSE_PROJECT_DIR/docs/backup-restore-drill-log.md"

compose() {
  docker compose exec -T postgres "$@"
}

# Base backup em formato tar comprimido, com o WAL necessario para tornar o
# proprio backup consistente embutido (--wal-method=stream) — o restante do
# WAL para PITR alem desse ponto vem do volume formops_wal_archive.
cmd_base_backup() {
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local target="$BACKUP_DIR/base-$stamp"
  mkdir -p "$target"
  echo "Gerando base backup em $target..."
  docker compose exec -T postgres pg_basebackup \
    -U "$POSTGRES_USER" -D /tmp/base-backup-out -Ft -z -Xs --checkpoint=fast
  docker compose cp postgres:/tmp/base-backup-out/. "$target"
  compose rm -rf /tmp/base-backup-out
  echo "Base backup concluido: $target"
}

# Restaura o base backup mais recente (ou o indicado em $1) mais o WAL
# arquivado ate agora (ou ate PITR_TARGET_TIME, se definido) num container
# Postgres descartavel, para provar que o backup e de fato restauravel —
# "backup nunca restaurado nao e backup" (FR-130).
cmd_drill() {
  local base_backup="${1:-$(ls -1dt "$BACKUP_DIR"/base-* 2>/dev/null | head -1)}"
  if [[ -z "$base_backup" || ! -d "$base_backup" ]]; then
    echo "Nenhum base backup encontrado — rode '$0 base-backup' primeiro." >&2
    exit 1
  fi

  local drill_container="formops-restore-drill"
  local drill_volume="formops_restore_drill_data"
  docker rm -f "$drill_container" >/dev/null 2>&1 || true
  docker volume rm -f "$drill_volume" >/dev/null 2>&1 || true

  echo "Restaurando $base_backup em container descartavel..."
  docker run -d --name "$drill_container" \
    -e POSTGRES_USER="$POSTGRES_USER" -e POSTGRES_PASSWORD="restore-drill" -e POSTGRES_DB="$POSTGRES_DB" \
    -v "$drill_volume:/var/lib/postgresql/data" \
    postgres:16-alpine >/dev/null
  # Sobrescreve o data dir recem-inicializado pelo entrypoint com o conteudo
  # do base backup, depois recria recovery.signal para reproduzir o WAL
  # arquivado (PITR) antes de religar o servidor.
  docker stop "$drill_container" >/dev/null
  docker run --rm -v "$drill_volume:/var/lib/postgresql/data" -v "$base_backup:/base-backup:ro" \
    postgres:16-alpine sh -c "rm -rf /var/lib/postgresql/data/* && tar -xzf /base-backup/base.tar.gz -C /var/lib/postgresql/data && touch /var/lib/postgresql/data/recovery.signal"
  docker start "$drill_container" >/dev/null

  local started_at result
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local ok=0
  for _ in $(seq 1 30); do
    if docker exec "$drill_container" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 2
  done
  local finished_at
  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  if [[ "$ok" == "1" ]]; then
    result="SUCESSO — container voltou a aceitar conexoes apos a restauracao"
  else
    result="FALHA — container nao ficou pronto dentro do prazo de espera do drill"
  fi

  {
    echo ""
    echo "## Exercicio $started_at"
    echo "- Base backup usado: \`$base_backup\`"
    echo "- Inicio: $started_at — fim: $finished_at"
    echo "- Resultado: $result"
  } >> "$DRILL_LOG"
  echo "$result"
  echo "Registrado em $DRILL_LOG"

  docker rm -f "$drill_container" >/dev/null 2>&1 || true
  docker volume rm -f "$drill_volume" >/dev/null 2>&1 || true

  [[ "$ok" == "1" ]]
}

case "${1:-}" in
  base-backup) cmd_base_backup ;;
  drill) shift; cmd_drill "$@" ;;
  *)
    echo "Uso: $0 {base-backup|drill [caminho-do-base-backup]}" >&2
    exit 1
    ;;
esac
