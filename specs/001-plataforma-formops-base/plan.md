# Implementation Plan: FormOps — Plataforma BASE de Governança de Indicadores de TI (Etapa 1)

**Branch**: `001-plataforma-formops-base` (diretório da spec) — trabalho ocorre em `main` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-plataforma-formops-base/spec.md`

## Summary

A Etapa 1 do FormOps entrega o ciclo completo do Relatório Operacional de TI mensal das unidades
geridas pela AGIR: abertura automática do período, preenchimento assistido com herança de dados
estruturais, cálculo no-code com aferição de conformidade, revisão local, contraprova indicador a
indicador na Matriz, pontuação congelada, consulta de auditoria, exportação selada verificável por
terceiro e camada analítica para BI.

**Este não é um projeto greenfield.** O repositório já contém implementação substancial —
autenticação, administração de usuários e unidades, engine no-code de formulários, ciclo de vida
com cron e dias úteis, respostas de indicador com snapshot, contraprova, evidências em S3,
exportação CSV/PDF e notificações. O trabalho desta feature é, em ordem de peso:

1. **Fechar as lacunas estruturais que a constituição trata como inegociáveis** — versionamento
   append-only de respostas, trilha de acesso, catálogo canônico, retenção imutável de evidências
   e selo de integridade. Nenhuma delas existe hoje.
2. **Construir as três superfícies ausentes** — Área de Auditoria (US6), verificador público de
   selos (US7) e camada de consumo analítico (US8).
3. **Corrigir os desvios do que já existe** — notadamente sessão em `sessionStorage` (o código
   atual) contra sessão em cookie `HttpOnly` com anti-CSRF (o que o Princípio V exige).

A abordagem técnica é **aditiva e retrocompatível**: nenhuma migração destrutiva, nenhum backfill
que invente dado histórico. Onde o acervo existente não tiver a informação que o novo modelo
exige — por exemplo, versões anteriores de respostas gravadas antes do versionamento —, o
registro nasce com marcação de origem explícita, jamais com valor sintético.

## Technical Context

**Language/Version**: TypeScript 5.7 sobre Node.js 26.x (monorepo npm workspaces).

**Primary Dependencies**: Backend — NestJS 10.4, Prisma 5.22, `@nestjs/schedule` (cron do ciclo de
vida), `@nestjs/throttler` (rate limiting), `class-validator`/`class-transformer` (ValidationPipe
global), `helmet`, `bcryptjs`, `nodemailer`, `@aws-sdk/client-s3`. Frontend — React 18, Vite,
Tailwind CSS. **A introduzir**: assinatura Ed25519 (o `node:crypto` nativo atende —
`generateKeyPairSync('ed25519')`, `sign`/`verify` — sem dependência externa), geração de QR code,
geração de PDF server-side e cliente de varredura antivírus (ClamAV via daemon).

**Storage**: PostgreSQL 16 com três schemas de responsabilidade estrita — `public` (OLTP, escrita
exclusiva da aplicação), `audit` (append-only, DML revogado para a role da aplicação) e
`analytics` (somente leitura, derivado). Evidências em armazenamento S3-compatível (MinIO em
desenvolvimento) com *Object Lock* em modo **Compliance**.

**Testing**: Jest em `apps/api` (unitários + integração contra PostgreSQL real) e Vitest +
Testing Library em `apps/web`. Cobertura mínima de 80% nos dois workspaces. Já existem 45
arquivos de teste no backend e um `.test.tsx` por página no frontend.

**Target Platform**: Servidor Linux em contêiner (Docker Compose orquestrado por
`scripts/manage.js`); navegadores evergreen para a interface.

**Project Type**: Aplicação web — API de serviço + SPA, em monorepo npm workspaces.

**Performance Goals**: Primeira página de consulta de auditoria sobre 24 meses × todas as unidades
em menos de 3 s, sem degradação conforme o acervo cresce (SC-011, SC-012). Alteração de uma
variável reavalia apenas o indicador afetado e os totais dependentes, nunca a tela inteira
(FR-127).

**Constraints**: Custo de consulta proporcional ao recorte pedido, não ao tamanho do acervo
(FR-126) — paginação por cursor sobre coluna indexada, `OFFSET` profundo proibido, consulta em
laço proibida. Escopo de unidade, perfil e permissão nunca em cache (FR-128). RPO ≤ 15 min e RTO
≤ 4 h com recuperação a ponto no tempo (FR-130). Retenção da trilha ≥ janela de retenção das
evidências, 10 anos por padrão (FR-074a). Guarda pericial de 1 ano para arquivo com detecção
positiva (FR-039a).

**Scale/Scope**: Envelope de planejamento de 10 anos — 20 a 60 unidades e 100 a 400 usuários
(Clarifications, SC-012a). O pico de carga é o fechamento mensal, quando todas as unidades
disputam a mesma janela de prazo. O acervo cresce monotonicamente porque nada é apagado: réplica
de leitura e particionamento da trilha justificam-se pelo acúmulo do período, não pelo volume
inicial. Escopo funcional: 132 requisitos, 8 histórias priorizadas, 22 critérios de sucesso.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliação dos sete princípios contra o **estado atual do repositório**. `PASS` = já atendido;
`GAP` = exigido pela spec e ausente ou incompleto hoje, a fechar nesta feature; `VIOLAÇÃO` = o
código atual contradiz a constituição e precisa ser corrigido, não apenas complementado.

### I. Não-Destrutividade e Trilha Imutável (INEGOCIÁVEL)

| Regra | Estado | Ação |
|---|---|---|
| Proibição de `DELETE` físico; `is_active = false` | PASS | Manter; adicionar teste de invariante |
| `IndicatorResponse` versionada em `indicator_response_version` | **GAP** | Modelo inexistente. Criar tabela append-only com `validFrom`/`validTo`; revogar `UPDATE`/`DELETE` no banco |
| Trilha populada por trigger de banco | PASS parcial | Trigger existe (`20260713195352_add_audit_trigger`). Estender às tabelas novas |
| `runWithAuditContext` obrigatório em toda escrita | **GAP** | Auditar cobertura; escrita sem contexto DEVE ser rejeitada, nunca gravada em silêncio |
| `audit.audit_log` e `audit.access_log` append-only, DML revogado | **GAP** | `AuditLog` existe no schema `public`; `AccessLog` não existe. Mover para `audit` e revogar DML |
| Ator de sistema para cron/seed; ator anônimo declarado nas superfícies públicas | **GAP** | As superfícies públicas ainda não existem |
| Soft delete some do trabalho, nunca da auditoria | PASS parcial | Reforçar na Área de Auditoria quando ela existir |

### II. Histórico Congelado por Snapshot

| Regra | Estado | Ação |
|---|---|---|
| Campos `snapshot*` gravados na instanciação | PASS | Presentes em 16 arquivos; migração `add_indicator_response_score_snapshot` aplicada |
| Alteração de definição afeta só o futuro | PASS | Cobrir por teste de regressão explícito |
| `indicatorScore`, `totalScore` e deflator calculados uma vez | PASS parcial | Confirmar ausência de recálculo em caminho de leitura |
| Leitura histórica resolve pelo snapshot | **GAP** | A Área de Auditoria, inexistente, é a principal consumidora desta regra |
| Unidade de medida do catálogo imutável após o primeiro vínculo | **GAP** | `IndicatorCatalog` não existe |

### III. Ausência de Dado Nunca é Zero (INEGOCIÁVEL)

| Regra | Estado | Ação |
|---|---|---|
| Cinco representações distintas, nunca colapsadas | PASS parcial | Existe no cálculo; falta a matriz esparsa da consulta multi-nível |
| Avaliador sem `NaN`, infinito ou zero de conveniência | PASS | `formula-evaluator.util.ts` presente; cobrir por teste de invariante |
| `0` é entrada legítima | PASS | Validar tratamento visual no frontend |
| Proibição de imputação; `n` efetivo em métrica derivada | **GAP** | As agregações da Área de Auditoria ainda não existem |
| Clone do Estado Residente por chave declarada | PASS parcial | Herança presente; confirmar marcação de herança parcial |
| Conjunto vazio informado sem relaxar filtro | **GAP** | Superfície de consulta inexistente |
| Legenda de ausência em toda tabela e exportação | **GAP** | A implementar nas duas superfícies |

### IV. Configuração Antes de Código

| Regra | Estado | Ação |
|---|---|---|
| Prazos, deflator e nomenclatura em `SystemSetting` | PASS | `platform-settings.service.ts` presente |
| Engine No-Code para formulários e fórmulas | PASS | `forms/` completo |
| Janela de retenção WORM administrável | **GAP** | Nenhuma referência a retenção no código |
| Limites de amplitude e de contagem exata da auditoria | **GAP** | A criar junto da Área de Auditoria |
| Confirmação dedicada para retenção ilimitada (`-1`) | **GAP** | A criar |

### V. O Backend é a Autoridade

| Regra | Estado | Ação |
|---|---|---|
| Revalidação de autenticação, perfil e escopo por requisição | PASS | Guards presentes |
| Escopo constante em toda superfície de leitura | PASS parcial | Estender às superfícies novas |
| Escopo, papel e permissão fora de cache | PASS | Não há camada de cache hoje — manter assim |
| `ValidationPipe` global com `whitelist` e `forbidNonWhitelisted` | PASS | Confirmar `forbidNonWhitelisted` |
| Anexo aceito por assinatura binária | PASS parcial | Verificar conferência dos bytes reais, não só do mimetype |
| **Sessão em cookie `HttpOnly` + anti-CSRF** | **VIOLAÇÃO** | O código usa JWT Bearer em `sessionStorage`, risco aceito em `apps/web/SECURITY-NOTES.md`. A constituição e FR-002 exigem cookie `HttpOnly`. Ver Complexity Tracking |

### VI. Integridade Probatória Verificável

| Regra | Estado | Ação |
|---|---|---|
| Selo em todo artefato exportado | **GAP** | Nenhum código de assinatura ou digest existe |
| Pipeline canônico → digests → Ed25519 → `ExportSeal` → QR | **GAP** | A construir integralmente |
| Serialização canônica sobre contrato próprio versionado | **GAP** | Contrato definido em `contracts/canonical-serialization.md` |
| `ExportSeal` imutável; revogação aditiva | **GAP** | A construir |
| Verificação pública, sem autenticação, offline por `keyId` | **GAP** | A construir |
| Chave privada em KMS/HSM, fora do repositório | **GAP** | Fechado por T005a — custódia fora do processo de configuração, acesso registrado, rotação programada. O `.env` carrega apenas a referência à chave, nunca o material |
| *Object Lock* Compliance com retenção carimbada | **GAP** | Nenhuma referência no código |
| Quarentena antes da promoção ao bucket imutável | **GAP** parcial | Há vestígio de varredura; falta o fluxo de quarentena |
| Texto livre gravado como digitado, neutralizado só na saída | PASS parcial | `csv.util.ts` presente; confirmar prefixação defensiva |

### VII. Determinismo, Reprodutibilidade e Degradação Segura

| Regra | Estado | Ação |
|---|---|---|
| Mesma consulta → mesmo resultado, mesma ordem | **GAP** | Critério de desempate estável a declarar na Área de Auditoria |
| Todo número recomputável a partir do bruto exportado | **GAP** | A garantir nas agregações novas |
| Área de Auditoria consulta dado vivo | **GAP** | Regra a respeitar na construção |
| Exportação server-side, nunca a partir do DOM | PASS | `report-export.service.ts` é server-side |
| Falha de serviço acessório não reverte transação | PASS | Notificações já degradam com registro |
| Cursor, sem `OFFSET` profundo, sem consulta em laço | **GAP** | A aplicar nas superfícies novas; auditar as existentes |
| Camada analítica projeta, não decide | **GAP** | Camada inexistente |

**Veredito do gate**: aprovado para prosseguir. Um item de **VIOLAÇÃO** (sessão em
`sessionStorage`) e um conjunto de **GAP**s foram identificados. Nenhum GAP é pedido de exceção —
todos são trabalho previsto desta feature. A violação está registrada em Complexity Tracking com
correção dentro do escopo, não como desvio permanente.

## Project Structure

### Documentation (this feature)

```text
specs/001-plataforma-formops-base/
├── plan.md              # Este arquivo (/speckit-plan)
├── spec.md              # Especificação (/speckit-specify + /speckit-clarify)
├── research.md          # Fase 0 (/speckit-plan)
├── data-model.md        # Fase 1 (/speckit-plan)
├── quickstart.md        # Fase 1 (/speckit-plan)
├── contracts/           # Fase 1 (/speckit-plan)
│   ├── api-rest.md
│   ├── canonical-serialization.md
│   ├── public-verification.md
│   └── analytics-layer.md
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado por /speckit-plan)
```

### Source Code (repository root)

Estrutura existente, com os diretórios **novos** marcados. Nenhum diretório existente é removido
ou renomeado.

```text
apps/api/
├── prisma/
│   ├── schema.prisma            # + IndicatorResponseVersion, IndicatorCatalog, ExportSeal,
│   │                            #   ReportSubmission, AccessLog, UserTablePreference
│   │                            #   (quarentena resolvida por campos em EvidenceFile)
│   ├── migrations/              # + migrações aditivas: schemas audit/analytics, GRANT/REVOKE,
│   │                            #   índices GIN jsonb_path_ops + pg_trgm, views analíticas
│   └── seed*.ts
└── src/
    ├── admin/                   # existente — usuários e unidades
    ├── analytics/               # NOVO — camada de consumo (US8): views, resolver de evidência
    ├── audit/                   # NOVO — Área de Auditoria (US6): consulta multi-eixo,
    │                            #   modos básico/detalhado, agregações com n efetivo
    ├── auth/                    # existente — MIGRAR de Bearer/sessionStorage p/ cookie HttpOnly
    ├── catalog/                 # NOVO — catálogo canônico (FR-062..065)
    ├── common/                  # existente — guards, decorators, escopo de unidade
    ├── config/                  # existente — validação de ambiente
    ├── evidence/                # existente — + quarentena, Object Lock, retenção carimbada
    ├── export/                  # existente — + selagem de todo artefato
    ├── forms/                   # existente — engine no-code
    ├── health/                  # existente
    ├── lifecycle/               # existente — cron, dias úteis, prazos
    ├── notifications/           # existente
    ├── prisma/                  # existente — + runWithAuditContext obrigatório
    ├── reports/                 # existente — + versionamento append-only, concorrência otimista
    ├── sealing/                 # NOVO — serialização canônica, digests, Ed25519, ExportSeal, QR
    ├── storage/                 # existente — + Object Lock Compliance
    ├── users/                   # existente
    ├── validation/              # existente — contraprova
    └── verification/            # NOVO — verificador público de selo, sem autenticação

apps/web/src/
├── api/                         # existente — clientes; MIGRAR para credenciais por cookie
├── components/                  # existente
├── config/                      # existente — brand.ts (fonte única de identidade)
├── context/                     # existente
├── lib/                         # existente
├── pages/                       # existente — + AuditPage, VerifyPage, AdminCatalogPage
├── test/                        # existente
└── types/                       # existente
```

**Structure Decision**: mantida a estrutura de monorepo npm workspaces já em uso — `apps/api`
(NestJS, organizado por módulo de domínio) e `apps/web` (React/Vite, organizado por página e
componente). Os cinco módulos novos do backend (`analytics`, `audit`, `catalog`, `sealing`,
`verification`) seguem exatamente a convenção dos existentes: um módulo Nest por domínio, com
`*.controller.ts`, `*.service.ts`, `dto/` e `*.spec.ts` par. Nenhuma estrutura alternativa foi
considerada — a constituição fixa a stack e o layout, e divergir exigiria emenda.

## Constitution Re-Check (pós-Fase 1)

Reavaliação após o desenho de `data-model.md`, `contracts/` e `quickstart.md`. A pergunta aqui não
é "já está implementado?", e sim "**o desenho tem onde atender cada princípio?**".

| Princípio | Coberto pelo desenho? | Onde |
|---|---|---|
| I. Não-destrutividade | Sim | `IndicatorResponseVersion` com índice único parcial; `AccessLog`; migração passo 6 revoga DML — a garantia passa a ser do banco |
| II. Snapshot | Sim | Campos `snapshot*` preservados; `v_report_fact` lê o congelado; `IndicatorCatalog.measurementUnit` imutável após vínculo |
| III. Ausência ≠ zero | Sim | Tabela das cinco representações físicas; `absenceLegend` obrigatória no contrato REST; `v_absence_semantics.counts_in_denominator` |
| IV. Configuração antes de código | Sim | Sete parâmetros novos em `SystemSetting`, nenhum como constante |
| V. Backend é a autoridade | Sim, **condicionado** | Regras transversais do contrato REST cobrem tudo; a migração de sessão para cookie `HttpOnly` continua sendo a única violação aberta |
| VI. Integridade probatória | Sim | Contrato `seal-v1`; `ExportSeal` imutável com revogação aditiva; Object Lock Compliance; quarentena antes da promoção |
| VII. Determinismo | Sim | Chave de paginação com desempate declarado; `n` e `totalCells` em toda agregação; proibição de view materializada na área de auditoria |

**Nenhuma violação nova foi introduzida pelo desenho.** A única aberta é a herdada, já registrada
abaixo. Nenhum GAP virou exceção permanente — todos têm lugar definido no modelo, no contrato ou na
ordem de migração.

## Complexity Tracking

> Preenchido apenas para violações do Constitution Check que exigem justificativa.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Sessão JWT em `sessionStorage` (estado atual) em vez de cookie `HttpOnly`, exigido pelo Princípio V e por FR-002 | Situação herdada, não decisão nova: o risco está documentado e aceito em `apps/web/SECURITY-NOTES.md`. É mantida temporariamente porque a migração exige, no mesmo lote, emissão e validação de token anti-CSRF em toda rota de escrita, CORS com origem explícita e revisão de todos os clientes de API do frontend — trabalho que não pode ser entregue pela metade sem abrir janela de vulnerabilidade | Manter `sessionStorage` em definitivo foi rejeitado: expõe o token a qualquer XSS e contradiz princípio inegociável. A migração é **item de escopo desta feature**, não desvio aceito; esta linha existe para impedir que o gate seja declarado verde antes dela, e `apps/web/SECURITY-NOTES.md` deve ser atualizado no mesmo commit que a concluir |
| Três schemas PostgreSQL (`public` / `audit` / `analytics`) em vez de um | Separação de privilégio exigida pelo Princípio I (DML revogado sobre a trilha) e pela seção de topologia da constituição. A garantia precisa ser do banco, não da disciplina do código | Schema único com disciplina de aplicação foi rejeitado: qualquer defeito ou credencial vazada permitiria apagar prova — exatamente o cenário que a plataforma existe para tornar impossível |
| Modelo append-only com `validFrom`/`validTo` em vez de `UPDATE` in place | Princípio I. A correção de um valor precisa preservar o valor anterior consultável, com autoria e cronologia | `UPDATE` com trilha em tabela paralela foi rejeitado: a trilha passaria a ser a única cópia do passado, e uma falha de trigger perderia o histórico em silêncio |

---

**Fase 0** → [research.md](./research.md) · **Fase 1** → [data-model.md](./data-model.md),
[contracts/](./contracts/), [quickstart.md](./quickstart.md)
