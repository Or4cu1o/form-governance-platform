# Contrato: Camada de Consumo Analítico (BI)

**Requisitos**: FR-114 a FR-122, US8 · **Princípios**: II, III, VII

O Tableau consome o schema `analytics` **diretamente**, sem serviço intermediário. A camada é
desacoplada do modelo operacional para que evolução interna não quebre painéis (FR-114).

## Regra fundamental

> A camada **projeta** o que o OLTP decidiu. Ela **não** recalcula, não reinterpreta e não introduz
> lógica de negócio nova.

Divergência entre um número do BI e o mesmo número na Área de Auditoria é **defeito**, não
interpretação alternativa (FR-122). Isso obriga ambas a lerem a mesma origem congelada.

## Acesso

| Role | Privilégio |
|---|---|
| `tableau_ro` | `SELECT` **apenas** em `analytics`. Sem acesso a `public` nem a `audit` |
| role da aplicação | Sem `SELECT` em `analytics` — a aplicação não lê a própria projeção |
| role administrativa | Migração e manutenção |

Qualquer escrita originada do BI é recusada pelo banco (FR-118, cenário US8-4). A garantia é do
`GRANT`, não da disciplina de quem escreve consulta.

## Views

### `analytics.v_report_fact`

Um fato por resposta de **relatório concluído**. Relatórios em qualquer outro estado **não
aparecem** — nenhum número provisório circula como consolidado (FR-115).

| Coluna | Origem | Regra |
|---|---|---|
| `unit_id`, `unit_acronym`, `unit_level_at_period` | `Unit` + histórico | Nível **vigente à época**, nunca o atual |
| `reference_period` | `ReportInstance` | `YYYY-MM-DD` |
| `indicator_code` | `IndicatorCatalog` | Identidade canônica entre formulários |
| `measurement_unit` | `IndicatorCatalog` | Impede agregar grandezas distintas (FR-065) |
| `calculated_value` | `IndicatorResponseVersion` corrente | `NULL` quando não há resultado apurado |
| `absence_kind` | derivado | `VALOR`, `ZERO_MEDIDO`, `NA_FORA_DO_NIVEL`, `NA_INATIVO_NO_PERIODO`, `NAO_PREENCHIDO` |
| `snapshot_goal_operator`, `snapshot_goal_value`, `snapshot_score_weight` | `IndicatorResponse` | **Congelados à época** (FR-117) |
| `is_compliant` | `IndicatorResponseVersion` | `NULL` sem resultado |
| `validation_verdict` | `ValidationRecord` | Veredito da contraprova |
| `report_total_score` | `ReportInstance` | **Reproduzido**, jamais recalculado (FR-117) |
| `response_id` | chave | Ponto de entrada do drill-down |

### `analytics.v_absence_semantics`

Existe para tornar impossível o erro que o Princípio III proíbe: **nenhuma agregação de BI pode
tratar ausência como zero** (FR-116).

| Coluna | Regra |
|---|---|
| `absence_kind` | Chave |
| `counts_in_denominator` | `false` para toda forma de ausência; `true` apenas para `VALOR` e `ZERO_MEDIDO` |
| `label_pt_br` | Legenda exibível, para que o painel sempre carregue a explicação |

Painéis **devem** filtrar por `counts_in_denominator` ao compor média ou taxa. Um `0` medido conta;
`NAO_PREENCHIDO` não conta.

### `analytics.v_indicator_dim` e `analytics.v_unit_dim`

Dimensões estáveis pelo catálogo canônico e pela unidade, com nível vigente à época.

### `analytics.v_evidence_link`

Expõe **apenas** o vínculo resolvido pela plataforma. O endereço real do armazenamento **nunca**
aparece — só o domínio da plataforma (FR-120, cenário US8-8).

## Drill-down (FR-119)

Do valor apurado até a prova, em poucos passos:

```
v_report_fact.calculated_value
  → decomposição do cálculo (variáveis + expressão congelada)
  → histórico de autoria e alteração (versões da resposta)
  → v_evidence_link → resolver → arquivo
```

## Resolver de evidência

### `GET /api/analytics/evidence/:token`

Token **HMAC-SHA256**, de uso único e vida curta, que dispensa conta na plataforma (FR-120).

| Situação | Resposta |
|---|---|
| Token válido, primeira utilização | Redireciona ao arquivo por vínculo de vida curta |
| Token já consumido | **Tela amigável de expiração** — nunca erro cru (cenário US8-6) |
| Token expirado | Idem |
| Token inválido | Mesma resposta, indistinguível |

**Todo** acesso é registrado em `AccessLog` — bem-sucedido, expirado ou já consumido (FR-073,
FR-120, cenário US8-7).

## Atualização (FR-121)

A camada suporta atualização incremental com marcação de última carga e capacidade de recarga
completa. Enquanto as views forem não materializadas, a "carga" é a própria leitura e o marcador
reflete o instante da consulta. Materializar é decisão posterior, condicionada a medição real de
desempenho — a antecipação está explicitamente barrada em `research.md` (D11).

## Testes obrigatórios

- Relatório não concluído não aparece em nenhuma view.
- Média sobre recorte com células ausentes ignora as ausentes no denominador, e o `n` bate com o da
  Área de Auditoria.
- Meta alterada após a emissão não altera o que o BI lê daquele relatório.
- `INSERT`/`UPDATE`/`DELETE` como `tableau_ro` falham por privilégio.
- Mesma pergunta à Área de Auditoria e ao BI retorna o mesmo número (SC-019).
- Segunda utilização do mesmo token de evidência apresenta tela de expiração, não erro cru.
- Nenhuma resposta do resolver contém o endereço do armazenamento.
