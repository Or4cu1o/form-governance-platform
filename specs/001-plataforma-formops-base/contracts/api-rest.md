# Contrato: API REST autenticada

**Requisitos**: US1–US7 · **Princípios**: I, III, V, VII

Cobre as rotas que a feature **cria ou altera**. As já existentes e não afetadas
(`admin/units`, `admin/users`, `forms/*`, `health`) permanecem como estão e não são redocumentadas
aqui.

## Regras transversais

Aplicam-se a **todas** as rotas abaixo, sem exceção:

- **Autorização**: revalidada por requisição — autenticação, perfil e escopo de unidade (FR-005).
  Nenhuma decisão de acesso é delegada ao cliente.
- **Escopo constante**: toda leitura respeita exatamente o mesmo conjunto de unidades do usuário
  (FR-006). A Área de Auditoria não introduz acesso novo.
- **Sessão**: cookie `HttpOnly; Secure; SameSite=Strict`; toda rota de escrita exige token
  anti-CSRF validado no servidor (FR-002, Princípio V).
- **Entrada**: `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`.
- **Saída**: DTO de saída declarado, que exclui por omissão qualquer campo não listado.
- **Contexto de auditoria**: toda escrita atravessa
  `runWithAuditContext({ userId, sourceIp, userAgent, origin, requestId }, tx)`. Requisição sem
  contexto é **rejeitada**, nunca gravada em silêncio.
- **Envelope de erro**: `{ "statusCode", "message", "error" }` em português do Brasil (FR-124), sem
  vazar identificador interno nem estrutura de banco.

## Respostas de indicador — concorrência otimista

### `PUT /api/reports/:reportId/indicators/:indicatorId`

```json
{
  "expectedVersionId": "<uuid da versão sobre a qual o autor editava>",
  "variableValues": {},
  "criticalAnalysis": "<texto exatamente como digitado>",
  "actionPlan": "<texto exatamente como digitado>"
}
```

**200** — versão nova criada, anterior fechada com `validTo` na mesma transação.

**409 Conflict** — `expectedVersionId` não é mais a versão corrente (FR-129):

```json
{
  "statusCode": 409,
  "error": "CONFLITO_DE_VERSAO",
  "message": "Este indicador foi alterado por outra pessoa enquanto você editava.",
  "current": {
    "versionId": "<uuid>",
    "variableValues": {},
    "authoredBy": { "name": "<nome>", "jobTitle": "<cargo>" },
    "authoredAt": "<ISO-8601 UTC>"
  }
}
```

O cliente **DEVE** apresentar a escolha ao usuário. A sobrescrita é uma **segunda requisição
deliberada**, com `overwriteVersionId` explícito — nunca automática. Nada é descartado em silêncio.

### `GET /api/reports/:reportId/indicators/:indicatorId/versions`

Histórico completo de versões, em ordem cronológica estável. Cada entrada traz autor, instante,
valores, motivo de falha de cálculo quando houver, e `overwroteVersionId` quando a versão resultou
de sobrescrita consciente.

## Área de Auditoria (nova)

### `GET /api/audit/query`

Consulta multi-eixo — unidade, relatório e indicador combináveis.

**Parâmetros**: `mode` (`BASICO` | `DETALHADO`), `periodFrom`, `periodTo`, `unitIds[]`, `levels[]`,
`indicatorCodes[]`, `statuses[]`, `compliance[]`, `verdicts[]`, `punctuality[]`, `scoreFrom`,
`scoreTo`, `authorIds[]` e `eventTypes[]` (apenas em `DETALHADO`), `cursor`, `pageSize`, `sort`.

**Regras**:
- Amplitude acima de `auditMaxRangeMonths` (24) → **400** com orientação, nunca truncamento
  silencioso. O modo `DETALHADO` opera sob limite mais estrito, **declarado antes da execução**
  (FR-091).
- Paginação **keyset** sobre `(referencePeriod DESC, unitId ASC, indicatorCode ASC, responseId ASC)`.
  `OFFSET` profundo é proibido. O último componente é o critério de desempate estável que garante
  ordem idêntica entre execuções (FR-089).
- Contagem exata apenas abaixo de `auditExactCountThreshold` (10.000); acima, teto ou contagem
  aproximada, sempre declarados (FR-091).
- Consulta sempre sobre **dado vivo** — nunca projeção defasada (FR-093).

**Resposta**:

```json
{
  "columns": [{ "indicatorCode": "<código>", "measurementUnit": "<unidade>" }],
  "rows": [
    {
      "unitId": "<uuid>",
      "referencePeriod": "YYYY-MM",
      "cells": {
        "<indicatorCode>": {
          "kind": "VALOR | ZERO_MEDIDO | NA_FORA_DO_NIVEL | NA_INATIVO_NO_PERIODO | NAO_PREENCHIDO",
          "value": "<decimal na escala declarada | null>"
        }
      }
    }
  ],
  "aggregations": [
    { "label": "<rótulo>", "value": "<decimal>", "n": 42, "totalCells": 60, "scale": 2 }
  ],
  "absenceLegend": {
    "NA_FORA_DO_NIVEL": "<texto>",
    "NA_INATIVO_NO_PERIODO": "<texto>",
    "NAO_PREENCHIDO": "<texto>"
  },
  "isEmptyResult": false,
  "nextCursor": "<opaco | null>",
  "countMode": "EXATA | APROXIMADA | TETO",
  "count": 1234
}
```

**Invariantes** — quebrar qualquer uma é defeito, não preferência:
- Toda célula sem correspondência recebe o código de ausência **exato**, nunca `0` nem vazio
  silencioso (FR-082, FR-084).
- `absenceLegend` acompanha a resposta **sempre**, inclusive quando não há ausência — na tela e no
  arquivo, nunca só como dica de passagem do mouse (FR-082).
- Toda agregação declara `n` e `totalCells`; células ausentes ficam fora do denominador (FR-085,
  FR-086).
- Conjunto vazio retorna `isEmptyResult: true` **sem** ampliar período, remover unidade, afrouxar
  recorte nem sugerir alternativa (FR-083).
- Ordenação e visibilidade de coluna são apresentação, nunca filtro: mudá-las não remove linha nem
  altera agregação (FR-090).

Cada execução grava `AccessLog` com filtros aplicados na íntegra, escopo e volume (FR-073).

### `GET /api/audit/filters`

Opções encadeadas e reativas: a seleção corrente restringe as subsequentes às efetivamente elegíveis
(FR-076). A busca interna do seletor **apenas localiza item na lista** — não altera, amplia nem
reinterpreta a consulta (FR-077).

## Catálogo canônico (novo)

| Rota | Regra |
|---|---|
| `GET /api/catalog` | Busca por código e nome |
| `POST /api/catalog` | Criável **sem sair do cadastro de indicador** (FR-063) |
| `PATCH /api/catalog/:id` | `measurementUnit` **imutável** após o primeiro vínculo → **409** (FR-064) |
| `POST /api/catalog/:id/deactivate` | **409** se houver indicador ativo vinculado (FR-064) |

## Exportação e selagem

### `POST /api/exports`

```json
{ "kind": "RELATORIO | CONSULTA_AUDITORIA", "format": "PDF | CSV | JSON", "scope": {} }
```

- Produzida **server-side a partir do acervo**, jamais do DOM renderizado (FR-108).
- **Todo** artefato recebe selo — inclusive parcial e conjunto vazio (FR-097).
- Exportação de consulta carrega filtros na íntegra (**inclusive os que não retornaram dados**),
  modo, colunas, ordenação, escopo do solicitante, legenda de ausência, autoria e o `n` de cada
  agregação (FR-107).
- CSV: célula iniciada por `=`, `+`, `-` ou `@` recebe prefixação defensiva (FR-110). O dado gravado
  permanece intacto — a neutralização é só na saída.
- Nome do arquivo resolvido do padrão configurado (FR-096).

### `POST /api/exports/:sealId/revoke`

Cria registro **adicional** de revogação. O selo original nunca é alterado nem removido (FR-101).

## Evidências

| Rota | Regra |
|---|---|
| `POST /api/evidence` | Aceitação por **assinatura binária** contra lista fechada, com coerência entre extensão, mimetype e bytes reais. Divergência → **400**, nada gravado (FR-035). Nome gerado pelo servidor (FR-036). Aterrissa na **quarentena** |
| `GET /api/evidence/:id/download` | Vínculo de vida curta, servido de origem distinta da aplicação (FR-040). `scanStatus = BLOQUEADO` → **403**, sem exceção |
| `POST /api/evidence/:id/deactivate` | Desativação lógica com autor e data; permanece visível em auditoria, exportação e camada analítica (FR-041) |
| `POST /api/evidence/:id/forensic-release` | Liberação antecipada da guarda pericial, exclusiva do administrador, registrada com autor, motivo e data (FR-039a) |

Relatório **não avança de etapa** com anexo `PENDENTE` (FR-038).

## Testes de contrato obrigatórios

- Gravação com `expectedVersionId` obsoleto → 409 com o valor vencedor, autor e instante.
- Consulta multi-nível produz matriz esparsa com código de ausência exato em toda célula vazia.
- Duas execuções idênticas retornam linhas na mesma ordem, byte a byte.
- Consulta sem resultado retorna `isEmptyResult` sem relaxar nenhum filtro.
- Usuário de escopo restrito não enxerga nenhuma unidade além das que já enxergava.
- Amplitude acima do limite → 400 com orientação, jamais resultado truncado.
- Download de arquivo `BLOQUEADO` → 403 em 100% das tentativas.
