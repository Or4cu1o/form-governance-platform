# Resultado do percurso dos 17 cenários (T165)

Referência: [quickstart.md](./quickstart.md). Cada cenário abaixo foi percorrido por **revisão de
código e da suíte de testes automatizados** que exercita o mesmo comportamento — não por execução
ao vivo. Este sandbox de desenvolvimento não tem acesso a um Postgres/MinIO/ClamAV reais (mesma
limitação de rede Docker isolada documentada em todas as fases anteriores, T020 em diante); rodar
`npm run docker:up` seguido dos 17 cenários literais é o passo que falta para a validação completa
ao vivo, num ambiente com rede completa (CI ou produção).

Legenda: **✅ lógica coberta** = o comportamento exigido está implementado e provado por teste
automatizado que passa nesta sessão. **⛔ requer infraestrutura real** = nenhuma suíte unitária
substitui a execução — listado explicitamente por cenário.

| Cenário | Mecanismo/arquivo | Cobertura automatizada | Execução ao vivo |
|---|---|---|---|
| V1 — Ciclo mensal completo | `lifecycle-cron.service.ts`, `report-instances.service.ts`, `validation.service.ts` | `lifecycle-cron.service.spec.ts`, `report-instances.service.spec.ts`, `validation.service.spec.ts` | ⛔ ciclo real de cron + Postgres |
| V2 — Ausência nunca vira zero | `absence.util.ts` | `absence.util.spec.ts`, `invariants.spec.ts` (T157, invariante 1), `audit-query.service.spec.ts` (matriz esparsa) | ✅ suficiente — lógica pura, sem dependência de infra |
| V3 — Herança parcial | `inheritance.service.ts` | `inheritance.service.spec.ts` (estado `HERDADO_PARCIAL`, chave nova nunca herda valor de outra) | ⛔ ciclo real de abertura de período |
| V4 — Conflito de edição concorrente | `indicator-responses.service.ts` (`expectedVersionId`/`overwroteVersionId`) | `indicator-responses.service.spec.ts` (409 com valor vencedor e autor) | ⛔ concorrência real de duas sessões |
| V5 — Não-destrutividade | Migração `20260809090000_revoke_dml_on_append_only` (REVOKE UPDATE/DELETE) | `prisma/append-only.spec.ts` (integração, requer Postgres — não executa neste sandbox, mesma limitação de T020-T025) | ⛔ requer Postgres real com a role `formops_app` provisionada |
| V6 — Congelamento | Campos `snapshot*` em `IndicatorResponse`/`ReportInstance` | `report-export.service.spec.ts`, `canonical-serialization.spec.ts` (digest idêntico após alteração posterior do indicador) | ✅ suficiente — snapshot é lido, nunca recalculado, provado sem infra |
| V7 — Pontualidade por submissão | `report-submission.service.ts` | `report-submission.service.spec.ts` (uma linha por envio, atraso pretérito preservado) | ⛔ ciclo real de prazo/extensão |
| V8 — Selo e verificação por terceiro | `seal.service.ts`, `verification` module | `seal.service.spec.ts`, `public-verification.spec.ts` (T122: um byte alterado → `CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO`; latência normalizada entre respostas) | ⛔ exportação real nos 3 formatos + verificador HTTP |
| V9 — Verificação offline | `offline-verification.spec.ts` | Prova a assinatura Ed25519 sem qualquer chamada de rede — já é, por construção, o cenário offline | ✅ suficiente — o teste já roda "desligado" |
| V10 — Evidência infectada | `antivirus.service.ts` | `antivirus.service.spec.ts` (`BLOQUEADO`, guarda pericial de 1 ano, nunca promovido ao bucket imutável) | ⛔ requer ClamAV real + arquivo EICAR |
| V11 — Retenção imutável | `s3.service.ts` (Object Lock modo Compliance) | Sem teste automatizado — Object Lock é garantia do MinIO/S3, não da aplicação | ⛔ requer MinIO real com bucket criado com versionamento + Object Lock |
| V12 — Determinismo e desempenho | `audit-query.service.ts` | `audit-query.service.spec.ts` (mesma ordem em duas execuções) + `measure-canonical-query-performance.ts` (T161, latência) | ⛔ medição de latência real — ver `research.md` D11 |
| V13 — Paridade BI ↔ auditoria | `analytics.*` views vs. `audit-query.service.ts` | `analytics-views.spec.ts`, `analytics-privileges.spec.ts` (integração, não executam neste sandbox — T144-T156a) | ⛔ requer Postgres real com schema `analytics` provisionado |
| V14 — Resolver de evidência | `evidence-resolver.service.ts` | `evidence-resolver.spec.ts` (uso único → `EXPIRADO` na segunda tentativa, endereço de armazenamento nunca vazado) | ✅ suficiente — lógica de uso único provada sem infra |
| V15 — Escopo constante | `unit-access.service.ts` | `unit-access.service.spec.ts` (revogação de acesso tem efeito imediato) | ⛔ percurso real pelas 4 telas |
| V16 — Degradação segura | `notifications.service.ts` (`safely()`/`NotificationFailure`), `auth.service.ts` (T159) | `notifications.service.spec.ts` (falha de SMTP não bloqueia o ciclo), `account-lockout.spec.ts` (bloqueio recai sobre a conta, não sobre o endereço compartilhado) | ✅ suficiente — ambas as pontas provadas sem infra externa real |
| V17 — Restauração | `scripts/backup-restore.sh` (T160) | Nenhum — restauração real é o próprio teste | ⛔ requer Docker/Postgres real — ver `docs/backup-restore-drill-log.md` |

## Resumo

- **5 de 17** cenários (V2, V6, V9, V14, V16) têm a lógica central provada inteiramente por testes
  automatizados que já passam neste sandbox, sem depender de infraestrutura externa.
- **12 de 17** exigem um ambiente com Postgres/MinIO/ClamAV/Docker reais para a validação de ponta
  a ponta literal do quickstart — bloqueados pela mesma limitação de sandbox documentada desde a
  Fase 8. Todos os 12 têm cobertura de teste unitário/integração para a lógica que a aplicação
  controla; o que falta é a garantia de infraestrutura (Object Lock, ClamAV, rede real) que só um
  ambiente vivo confirma.
- Nenhum cenário foi pulado ou dado como "provavelmente funciona" sem uma referência concreta de
  código/teste — a tabela acima é o rastro de auditoria desta revisão.
