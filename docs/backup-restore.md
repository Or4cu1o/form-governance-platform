# Backup, PITR e retenção da trilha (T160)

Referências: FR-074a, FR-130, SC-021, `specs/001-plataforma-formops-base/research.md`.

## Objetivo

- **RPO (Recovery Point Objective): 15 minutos.** Nenhum trabalho registrado há mais de 15
  minutos antes de uma falha total do banco pode ser perdido.
- **RTO (Recovery Time Objective): 4 horas.** A plataforma deve voltar a operar em até 4 horas
  após uma perda total do banco.
- Backup nunca restaurado não é backup — a restauração é testada periodicamente e o resultado
  é registrado (`docs/backup-restore-drill-log.md`).

## Mecanismo: PITR via WAL archiving contínuo

O serviço `postgres` do `docker-compose.yml` roda com:

```
wal_level=replica
archive_mode=on
archive_command=test ! -f /wal-archive/%f && cp %p /wal-archive/%f
archive_timeout=300
```

- `archive_command` copia cada segmento de WAL fechado para o volume `formops_wal_archive`
  assim que o Postgres o fecha.
- `archive_timeout=300` (5 min) força o fechamento e a cópia de um segmento mesmo sob baixo
  volume de escrita — sem isso, um período de pouca atividade poderia deixar o WAL "aberto"
  por mais que os 15 minutos de RPO permitem.
- Um **base backup** periódico (`npm run backup:base`, ver abaixo) mais o WAL arquivado desde
  então formam juntos uma recuperação a qualquer ponto no tempo (PITR) entre o último base
  backup e o momento da falha.

## Rotina de base backup

```bash
npm run backup:base
```

Gera um base backup consistente (`pg_basebackup -Ft -z -Xs`) em `.backups/base-<timestamp>/`.
Frequência recomendada: diária. O base backup replica para um volume/host isolado ao qual a
credencial de origem da aplicação (`formops_app`) não tem qualquer permissão — a role de
aplicação nunca teve acesso de leitura ao volume de backup nem ao volume `formops_wal_archive`,
só o operador com acesso ao host Docker.

## Restauração (procedimento manual, produção)

1. Provisionar um novo host/container Postgres 16 vazio.
2. Copiar o base backup mais recente (`.backups/base-<timestamp>/base.tar.gz`) para o data
   directory do novo Postgres e extraí-lo.
3. Copiar os segmentos de WAL arquivados desde aquele base backup (volume
   `formops_wal_archive`) para onde `restore_command` os alcance (ou usar `restore_command`
   apontando direto para o volume/repositório de arquivamento).
4. Criar `recovery.signal` no data directory (Postgres 16: presença do arquivo, não mais
   `recovery.conf`) e, se a restauração for para um ponto específico no tempo (não o mais
   recente disponível), definir `recovery_target_time` em `postgresql.conf`.
5. Iniciar o Postgres — ele reproduz o WAL arquivado automaticamente até o alvo (ou até o fim
   do WAL disponível) e sai do modo de recuperação.
6. Repontar `DATABASE_URL`/`APP_DATABASE_URL`/`TABLEAU_RO_DATABASE_URL` para o host restaurado
   e reiniciar a API (`npm run restart`).

## Exercício de restauração (drill)

```bash
npm run backup:drill
```

`scripts/backup-restore.sh drill` automatiza uma restauração completa (passos 1–5 acima) num
container Postgres descartável, a partir do base backup mais recente, e confirma que o
container volta a aceitar conexões (`pg_isready`). O resultado — sucesso ou falha, com
timestamps — é sempre anexado a `docs/backup-restore-drill-log.md`, nunca sobrescrito.

Recomendação: rodar `npm run backup:drill` no mínimo trimestralmente, e sempre após qualquer
mudança de infraestrutura no serviço `postgres`.

## Política de retenção da trilha (FR-074a)

- **Piso**: a janela de retenção **vigente** das evidências — `SystemSetting.evidenceRetentionYears`,
  10 anos por padrão. A trilha (`audit.audit_logs`, `audit.access_logs`) acompanha essa janela
  se ela for ampliada; nunca fica abaixo dela.
- **Expurgo**: só por procedimento aprovado e registrado fora da aplicação. A aplicação **não**
  tem qualquer rota, comando ou credencial que apague `audit_logs`/`access_logs` — confirmado
  pela migração `20260809090000_revoke_dml_on_append_only`, que revoga `UPDATE`/`DELETE` da role
  `formops_app` sobre as tabelas append-only do schema `audit` (T035).
- Na prática, "expurgar" hoje significa: um operador com credencial de superusuário do banco
  (nunca a `formops_app`) executa um `DELETE` manual documentado — fora do escopo desta
  plataforma — após confirmar que o piso de retenção não seria violado.

## Limitação deste sandbox

`scripts/backup-restore.sh` e a configuração de WAL archiving acima foram escritas e
revisadas, mas **não executadas neste ambiente de desenvolvimento** — mesma limitação de rede
Docker isolada já documentada nas Fases 8–10 (sem Postgres real alcançável). A primeira entrada
de `docs/backup-restore-drill-log.md` registra esse estado; a execução real fica para o
ambiente de CI/produção, onde `docker compose` tem acesso à rede completa.
