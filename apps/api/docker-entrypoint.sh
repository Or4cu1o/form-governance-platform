#!/bin/sh
set -e

echo "[entrypoint] aplicando migrations pendentes (prisma migrate deploy)..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] provisionando role de aplicacao (privilegio minimo, T035)..."
npm run provision:app-role

if [ "$SEED_ON_START" = "true" ]; then
  echo "[entrypoint] SEED_ON_START=true — rodando seed core..."
  node dist/prisma/seed.js
fi

if [ "$SEED_PROPRIETARY_FORMS" = "true" ]; then
  echo "[entrypoint] SEED_PROPRIETARY_FORMS=true — rodando seeds N1/N3..."
  node dist/prisma/seed-proprietary/seed-n1.js || echo "[entrypoint] seed N1 ainda nao implementado (Fase 11)"
  node dist/prisma/seed-proprietary/seed-n3.js || echo "[entrypoint] seed N3 ainda nao implementado (Fase 11)"
fi

echo "[entrypoint] iniciando aplicacao..."
exec "$@"
