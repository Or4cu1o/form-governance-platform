# Registro de exercícios de restauração (FR-130, SC-021)

Cada execução de `npm run backup:drill` anexa uma entrada abaixo — nunca sobrescrita, nunca
removida. "Backup nunca restaurado não é backup."

## Exercício 2026-08-10 (sandbox de desenvolvimento)

- Base backup usado: nenhum — não gerado neste ambiente.
- Resultado: **NÃO EXECUTADO** — sandbox sem acesso à rede Docker completa (mesma limitação
  documentada nas Fases 8–10 para todo teste de integração contra Postgres real; ver
  `docs/backup-restore.md#limitação-deste-sandbox`).
- Ação pendente: rodar `npm run backup:base` seguido de `npm run backup:drill` no primeiro
  ambiente com Docker Compose completo (CI ou produção) e registrar o resultado real aqui.
