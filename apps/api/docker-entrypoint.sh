#!/bin/sh
set -e

echo "[entrypoint] aplicando migrations pendentes (prisma migrate deploy)..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] provisionando role de aplicacao (privilegio minimo, T035)..."
npm run provision:app-role

echo "[entrypoint] provisionando role de BI (privilegio minimo, tableau_ro, T151)..."
npm run provision:tableau-ro

if [ "$SEED_ON_START" = "true" ]; then
  echo "[entrypoint] SEED_ON_START=true — rodando seed core..."
  npm run seed
fi

if [ "$SEED_PROPRIETARY_FORMS" = "true" ]; then
  echo "[entrypoint] SEED_PROPRIETARY_FORMS=true — rodando seeds N1/N3..."
  npm run seed:n1 || echo "[entrypoint] seed N1 ainda nao implementado (Fase 11)"
  npm run seed:n3 || echo "[entrypoint] seed N3 ainda nao implementado (Fase 11)"
fi

if [ "$SEED_DEMO_POP" = "true" ]; then
  echo "[entrypoint] SEED_DEMO_POP=true — rodando seed de populacao demo..."
  npm run seed:demo
fi

echo "[entrypoint] iniciando aplicacao..."
exec "$@"
