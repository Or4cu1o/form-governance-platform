# Phase 1 — Data Model: FormOps Etapa 1

**Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Date**: 2026-08-07

Modelo derivado da seção *Key Entities* da [spec](./spec.md), confrontado com
`apps/api/prisma/schema.prisma` no estado atual. Toda mudança proposta é **aditiva**: nenhum modelo
é removido, nenhuma coluna existente é excluída.

## Mapa de estado

| Entidade da spec | Modelo Prisma | Estado |
|---|---|---|
| Unidade | `Unit` | Existe |
| Usuário | `User` | Existe — falta `jobTitle` distinto do perfil (FR-074) |
| Concessão de acesso | `UserUnitAccess` | Existe |
| Formulário | `FormTemplate` | Existe |
| Seção temática | `FormTopic` | Existe |
| Definição de indicador | `FormIndicator` | Existe — falta vínculo ao catálogo canônico |
| **Catálogo canônico** | — | **Ausente** |
| Relatório | `ReportInstance` | Existe — pontualidade sobrescrita a cada reenvio |
| Resposta de indicador | `IndicatorResponse` | Existe — **sofre `UPDATE` in place** |
| **Versão de resposta** | — | **Ausente** |
| **Submissão** | — | **Ausente** |
| Evidência | `EvidenceFile` | Existe — sem varredura, quarentena nem retenção |
| Veredito de validação | `ValidationRecord` | Existe |
| Registro de alteração | `AuditLog` | Existe — contexto de auditoria incompleto |
| **Registro de acesso** | — | **Ausente** |
| **Selo de integridade** | — | **Ausente** |
| Configuração da plataforma | `SystemSetting` | Existe — faltam parâmetros novos |

---

## Parte A — Correções em modelos existentes

### A1. `IndicatorResponse` — remover a mutabilidade

**Problema constatado**: o modelo declara `updatedAt DateTime @updatedAt` e carrega os valores
correntes (`variableValues`, `calculatedValue`, `isCompliant`, `criticalAnalysis`, `actionPlan`)
diretamente na linha. Isso significa `UPDATE` in place a cada edição — o valor anterior é perdido.
**Contradiz o Princípio I e FR-068.**

**Mudança**: `IndicatorResponse` passa a ser a **identidade estável** da resposta — a que carrega
os campos `snapshot*`, que por definição nunca mudam — e delega todo conteúdo mutável a
`IndicatorResponseVersion`. Os campos de conteúdo permanecem fisicamente na tabela por
compatibilidade, mas passam a ser **projeção da versão corrente**, mantida pela mesma transação que
insere a versão nova, nunca escrita isoladamente.

**Campo adicionado**:

| Campo | Tipo | Regra |
|---|---|---|
| `currentVersionId` | `String?` | Aponta a versão com `validTo IS NULL` |

### A2. `ReportInstance` — pontualidade por submissão

**Problema constatado**: `submittedForReviewAt`, `submittedForApprovalAt`, `isElaborationOnTime` e
`isReviewOnTime` são campos únicos. Num relatório reprovado e reenviado, o segundo envio sobrescreve
o primeiro. **Contradiz FR-058**, que exige registro próprio por submissão sem sobrescrever nenhuma
anterior.

**Mudança**: os campos existentes permanecem como *conveniência da última submissão*; a verdade
histórica passa a ser `ReportSubmission` (B3). O cálculo de nota e deflator lê `ReportSubmission`,
não os campos de conveniência.

### A3. `AuditLog` — completar o contexto exigido por FR-069

**Problema constatado**: o modelo registra `tableName`, `recordId`, `action`, `userId`,
`previousValue`, `newValue`, `changedAt`. FR-069 exige adicionalmente endereço de origem, cliente,
canal, correlação de requisição **e** o cargo/perfil/lotação do autor preservados como eram no
momento do evento.

**Campos adicionados**:

| Campo | Tipo | Regra |
|---|---|---|
| `sourceIp` | `String?` | `inet`; nulo apenas para ator de sistema |
| `userAgent` | `String?` | Cliente declarado |
| `origin` | `String` | Canal: `WEB`, `CRON`, `SEED`, `PUBLIC` |
| `requestId` | `String?` | Correlação da requisição |
| `actorNameSnapshot` | `String?` | Nome do autor à época |
| `actorJobTitleSnapshot` | `String?` | Cargo à época |
| `actorRoleSnapshot` | `String?` | Perfil à época |
| `actorUnitSnapshot` | `String?` | Lotação à época |

**Migração de schema**: a tabela passa para o schema `audit`; `UPDATE` e `DELETE` são revogados
para a role da aplicação. Escrita que chegue sem `origin` **DEVE ser rejeitada**, nunca gravada em
silêncio (Princípio I).

### A4. `User` — cargo distinto do perfil

`jobTitle String?` — função na organização, dado próprio, distinto de `RoleName` (FR-074).

### A5. `EvidenceFile` — verificação, quarentena e retenção

| Campo | Tipo | Regra |
|---|---|---|
| `scanStatus` | enum `PENDENTE` \| `LIBERADO` \| `BLOQUEADO` | Três estados distinguíveis (FR-037) |
| `scannedAt` | `DateTime?` | Instante do veredito |
| `scanEngineVersion` | `String?` | Versão do motor, para reprodutibilidade do veredito |
| `bucket` | `String` | Quarentena ou imutável |
| `retainUntil` | `DateTime?` | Carimbo do `PutObject`; nulo apenas se `retentionMode = INDEFINIDA` |
| `retentionMode` | enum `JANELA` \| `INDEFINIDA` | `INDEFINIDA` = retenção ilimitada (FR-044) |
| `forensicHoldUntil` | `DateTime?` | `scannedAt + 1 ano` quando bloqueado (FR-039a) |
| `deactivatedByUserId` | `String?` | Autor da desativação lógica (FR-041) |
| `deactivatedAt` | `DateTime?` | Data da desativação |

Evidência desativada **permanece** visível em auditoria, exportação e camada analítica, marcada como
desativada — some da superfície de trabalho, nunca da de auditoria.

### A6. `FormIndicator` — vínculo ao catálogo

`catalogEntryId String` — **obrigatório** (FR-062). Cadastro sem código canônico é recusado.

### A7. `SystemSetting` — parâmetros novos

| Campo | Padrão | Requisito |
|---|---|---|
| `evidenceRetentionYears` | `10` | FR-043; `-1` = indeterminado |
| `includeOptionalHolidays` | `false` | FR-015 — Carnaval e Corpus Christi desligados |
| `auditMaxRangeMonths` | `24` | FR-091, amplitude máxima de consulta |
| `auditDetailedMaxRangeMonths` | `12` | Modo detalhado sob limite mais estrito |
| `auditExactCountThreshold` | `10000` | Contagem exata só abaixo deste teto |
| `outlierRule` | `IQR` | FR-087, regra declarada na interface |
| `forensicHoldYears` | `1` | FR-039a |

---

## Parte B — Entidades novas

### B1. `IndicatorCatalog` — catálogo canônico

Identidade estável de uma métrica entre formulários distintos. Sem ele, *"esta métrica em todas as
unidades"* é irrespondível quando as unidades usam formulários diferentes.

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `String` | uuid |
| `code` | `String` | Único, legível, estável |
| `name` | `String` | |
| `description` | `String?` | |
| `measurementUnit` | `String` | **Imutável após o primeiro vínculo** (FR-064) |
| `isActive` | `Boolean` | Não desativável com indicadores ativos vinculados (FR-064) |

**Invariantes**: indicadores com `measurementUnit` distinta **não podem** ser agregados entre si
(FR-065). Corrigir unidade de medida é criar código novo e realocar, deixando o rastro visível.

### B2. `IndicatorResponseVersion` — versionamento append-only

Coração do Princípio I. Gravada exclusivamente por `INSERT`.

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `String` | uuid |
| `indicatorResponseId` | `String` | FK |
| `validFrom` | `DateTime` | `timestamptz`, início da vigência |
| `validTo` | `DateTime?` | `NULL` = versão corrente |
| `variableValues` | `Json` | Valores das variáveis nesta versão |
| `calculatedValue` | `Decimal?` | `NULL` quando o cálculo é impossível |
| `calculationFailureReason` | `String?` | Motivo exato (FR-028) — nunca zero de conveniência |
| `isCompliant` | `Boolean?` | `NULL` sem resultado apurado (FR-029) |
| `criticalAnalysis` | `String?` | Texto exatamente como digitado (FR-109) |
| `actionPlan` | `String?` | Idem |
| `inheritanceState` | enum `NAO_HERDADO` \| `HERDADO` \| `HERDADO_PARCIAL` | FR-024, FR-025 |
| `unresolvedInheritedKeys` | `String[]` | Chaves que não puderam ser herdadas |
| `authoredByUserId` | `String?` | Nulo apenas para ator de sistema |
| `overwroteVersionId` | `String?` | Preenchido só em sobrescrita deliberada (FR-129) |
| `originLegacy` | `Boolean` | `true` na carga inicial, para não fingir histórico que não existe |

**Constraints de banco**:
- `UNIQUE (indicator_response_id) WHERE valid_to IS NULL` — impossibilita duas versões correntes.
- `CHECK (valid_to IS NULL OR valid_to > valid_from)`.
- `UPDATE` e `DELETE` revogados para a role da aplicação.

**Nota sobre a carga inicial**: as respostas já existentes recebem **uma** versão com
`originLegacy = true` e `validFrom` igual ao `updatedAt` corrente. Nenhuma versão intermediária é
inventada — o histórico anterior ao versionamento não existe, e o modelo diz isso explicitamente em
vez de simulá-lo.

### B3. `ReportSubmission` — uma linha por envio

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `String` | uuid |
| `reportInstanceId` | `String` | FK |
| `stage` | enum `ELABORACAO` \| `REVISAO` \| `APROVACAO` | Etapa |
| `submittedByUserId` | `String` | Autor |
| `submittedAt` | `DateTime` | Instante |
| `effectiveDueDate` | `DateTime` | **Prazo vigente aferido** — o estendido quando houver (FR-056) |
| `wasOnTime` | `Boolean` | Resultado da aferição |
| `reprovalCountAtSubmission` | `Int` | Ciclo a que pertence |

**Invariante**: nenhuma linha é atualizada. Atraso pretérito permanece registrado — a extensão
perdoa o ciclo novo, nunca o anterior (FR-057).

### B4. `AccessLog` — trilha de leitura (schema `audit`)

FR-073 exige registrar acessos de leitura sensíveis, hoje inexistentes.

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `String` | uuid |
| `eventType` | enum `CONSULTA_AUDITORIA` \| `EXPORTACAO` \| `DOWNLOAD_EVIDENCIA` \| `VERIFICACAO_SELO` \| `LOGIN_SUCESSO` \| `LOGIN_FALHA` | |
| `userId` | `String?` | `NULL` **apenas** com `actorKind = ANONIMO_DECLARADO` |
| `actorKind` | enum `USUARIO` \| `SISTEMA` \| `ANONIMO_DECLARADO` | FR-072 — "ninguém autenticado, e sabemos disso" ≠ "não sabemos quem foi" |
| `filtersApplied` | `Json?` | Filtros na íntegra, inclusive os sem retorno |
| `scopeUnitIds` | `String[]` | Escopo efetivo do solicitante |
| `resultVolume` | `Int?` | Volume retornado |
| `sourceIp`, `userAgent`, `requestId` | | Contexto |
| `occurredAt` | `DateTime` | ISO-8601 UTC |

Append-only, DML revogado.

### B5. `ExportSeal` — selo de integridade

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `String` | uuid |
| `verificationCode` | `String` | Único, legível, **não sequencial e não enumerável** (FR-100) |
| `sealContractVersion` | `String` | Versão do contrato de serialização canônica (FR-099) |
| `contentDigest` | `String` | SHA-256 do dado canônico — igual nos três formatos do mesmo recorte |
| `artifactDigest` | `String` | SHA-256 dos bytes entregues — difere por formato |
| `signature` | `String` | Ed25519 sobre `contentDigest` |
| `keyId` | `String` | Permite verificação offline e preserva selos de chaves anteriores (FR-104) |
| `artifactKind` | enum `RELATORIO` \| `CONSULTA_AUDITORIA` | |
| `artifactFormat` | enum `PDF` \| `CSV` \| `JSON` | |
| `scopeDescriptor` | `Json` | Unidade, período, filtros, escopo do solicitante |
| `issuedByUserId` | `String` | Autoria da emissão |
| `issuedAt` | `DateTime` | |
| `isEmptyResult` | `Boolean` | Conjunto vazio também recebe selo (FR-097) |
| `isPartial` | `Boolean` | Exportação parcial também recebe selo |

**Revogação**: registro **adicional** em `ExportSealRevocation` (`sealId`, `reason`,
`revokedByUserId`, `revokedAt`). O selo original nunca é alterado nem removido (FR-101).

### B6. Views do schema `analytics`

Somente leitura, acessíveis apenas por `tableau_ro`. Expõem exclusivamente relatórios concluídos
(FR-115), com metas, pesos e nota lidos dos campos `snapshot*` congelados (FR-117).

| View | Conteúdo |
|---|---|
| `analytics.v_report_fact` | Um fato por resposta de relatório concluído, com nota reproduzida, não recalculada |
| `analytics.v_indicator_dim` | Dimensão de indicador pelo catálogo canônico |
| `analytics.v_unit_dim` | Dimensão de unidade, com nível vigente à época |
| `analytics.v_absence_semantics` | Marcação de aplicabilidade que impede o BI de tratar ausência como zero (FR-116) |
| `analytics.v_evidence_link` | Vínculo resolvido pela plataforma, **nunca** o endereço real do armazenamento (FR-120) |

---

## Semântica de ausência — representação física

As cinco representações do Princípio III **não podem** ser colapsadas. Distinção no modelo:

| Representação | Como se materializa |
|---|---|
| Valor apurado | `calculatedValue` não nulo |
| `0` medido | `calculatedValue = 0` — indistinguível de qualquer outro número apurado |
| `N/A — fora do nível` | Não existe `IndicatorResponse` para o par (relatório, indicador), porque a unidade não tinha o que preencher naquele período |
| `N/A — indicador inativo no período` | Existe resposta, mas o `FormIndicator` estava inativo à época — decidido pelo snapshot, nunca pelo formulário de hoje (FR-081) |
| `Não preenchido` | Resposta existe, `variableValues` sem a chave, `calculatedValue` nulo |

A célula ausente nunca vira `0` e nunca entra em denominador de agregação (FR-086).

---

## Transições de estado

**`ReportInstance.status`** (FR-013, FR-018):

```
PENDENTE ──(elaborador submete)──▶ EM_REVISAO ──(revisor submete)──▶ PENDENTE_APROVACAO
                                       ▲                                     │
                                       │                                     ├─ todos aprovados ─▶ CONCLUIDO (travado)
                                       └──── reprova: +1 reprovalCount ──────┘
                                             prazo estendido
```

Após a primeira submissão do período **não há retorno a `PENDENTE`** (FR-018). `CONCLUIDO` é
terminal e travado para escrita (FR-019).

**`IndicatorResponse.validationStatus`** (FR-050): indicador aprovado que seja alterado volta a
exigir contraprova **no instante da alteração**, não na devolução.

**`EvidenceFile.scanStatus`**: `PENDENTE → LIBERADO` (promove ao bucket imutável) ou
`PENDENTE → BLOQUEADO` (permanece na quarentena sob guarda pericial de 1 ano). Relatório não avança
de etapa com anexo `PENDENTE` (FR-038).

---

## Ordem de migração

Aditiva e reversível até o passo 6.

1. Schemas `audit` e `analytics`; roles e `GRANT`/`REVOKE`.
2. Colunas novas em `User`, `SystemSetting`, `EvidenceFile`, `FormIndicator` (nullable primeiro).
3. `IndicatorCatalog`; backfill a partir dos indicadores existentes; só então tornar
   `catalogEntryId` obrigatório.
4. `IndicatorResponseVersion`; carga inicial com `originLegacy = true`; índice único parcial.
5. `ReportSubmission`, `AccessLog`, `ExportSeal`, `ExportSealRevocation`.
6. **Revogar `UPDATE`/`DELETE`** sobre `indicator_response_version`, `audit.audit_log` e
   `audit.access_log`. A partir daqui a garantia é do banco.
7. Índices GIN (`jsonb_path_ops`, `pg_trgm`) e B-tree da chave de paginação.
8. Views do schema `analytics`.

Todas versionadas em `apps/api/prisma/migrations/` e aplicadas automaticamente na inicialização do
contêiner — dependência de comando manual no servidor é terminantemente proibida pela constituição.
