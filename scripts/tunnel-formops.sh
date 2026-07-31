#!/usr/bin/env bash
# Sobe 2 tuneis cloudflared (quick tunnels) em paralelo para demonstracao
# externa do FormOps: API e Web. Cada URL publica (*.trycloudflare.com) e
# nova a cada vez que o processo sobe.
#
# O tunel do MinIO foi removido deliberadamente: alem de expor a API de
# armazenamento de evidencias publicamente sem bucket policy, as URLs
# pre-assinadas sao geradas com host "localhost" (ver S3_ENDPOINT), entao a
# assinatura SigV4 nao bate ao atravessar o tunel — o download quebraria de
# qualquer forma.
set -euo pipefail

ROOT_DIR="/home/admin/projects/form-governance-platform"

# So le as 3 variaveis de porta necessarias, em vez de `source` + `set -a`
# no .env inteiro — isso evitava exportar segredos (JWT_SECRET,
# POSTGRES_PASSWORD, S3_SECRET_KEY, SMTP_PASSWORD, etc.) para o ambiente dos
# processos cloudflared, um binario de terceiros.
API_PORT="$(grep -m1 '^API_PORT=' "$ROOT_DIR/.env" | cut -d= -f2-)"
WEB_PORT="$(grep -m1 '^WEB_PORT=' "$ROOT_DIR/.env" | cut -d= -f2-)"
API_PORT="${API_PORT:-7442}"
WEB_PORT="${WEB_PORT:-7443}"

# Se um tunel cair, derruba o grupo inteiro para o systemd (Restart=always)
# reiniciar todos juntos de forma consistente.
trap 'kill 0' EXIT INT TERM

cloudflared tunnel --url "http://localhost:${API_PORT}" 2>&1 | sed -u 's/^/[api] /' &
cloudflared tunnel --url "http://localhost:${WEB_PORT}" 2>&1 | sed -u 's/^/[web] /' &

wait -n
