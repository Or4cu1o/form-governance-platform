# Contrato: Serialização Canônica do Selo

**Versão do contrato**: `seal-v1` · **Requisitos**: FR-098, FR-099, FR-103, FR-104 · **Princípio VI**

Este contrato define a **única** forma admitida de reduzir um recorte de dados a bytes antes de
calcular o `contentDigest`. Ele é **independente de qualquer DTO de apresentação** — mudança
cosmética em uma tela não pode invalidar selo já emitido.

## Por que existe

Se dois processos serializarem o mesmo dado de formas diferentes, produzirão digests diferentes e a
verificação acusará adulteração onde não houve. O contrato elimina toda liberdade de representação.

## Regras de serialização

1. **Formato**: JSON, UTF-8, **sem BOM**, sem espaço supérfluo — nem indentação, nem espaço após
   `:` ou `,`.
2. **Ordem de chaves**: lexicográfica por code point, recursivamente, em todos os níveis. Nunca a
   ordem de inserção do objeto.
3. **Decimais**: notação posicional sem expoente, ponto como separador, escala **fixa e declarada**
   por campo no dicionário abaixo. `2` serializa como `"2.0000"` quando a escala é 4. Nunca `2e0`,
   nunca `2`.
4. **Datas e instantes**: ISO-8601 em UTC com sufixo `Z` e precisão de milissegundos —
   `"2026-08-07T13:45:12.000Z"`. Datas puras (período de referência) em `"YYYY-MM-DD"`.
5. **Nulos**: chave **presente** com valor `null`. Omitir a chave é proibido — a distinção entre
   "não preenchido" e "campo ausente do contrato" é exatamente o que o Princípio III protege.
6. **Ausência**: representada por objeto explícito
   `{"kind":"NAO_PREENCHIDO"|"NA_FORA_DO_NIVEL"|"NA_INATIVO_NO_PERIODO","value":null}`. Um `0`
   medido é o número `"0.0000"`, jamais um destes objetos.
7. **Texto livre**: exatamente como digitado, sem normalização Unicode, sem trim, sem escape além
   do exigido pelo JSON. Transformar o texto na serialização destruiria a prova.
8. **Arrays**: ordem estável declarada pelo produtor do recorte e reproduzida no envelope — nunca a
   ordem de retorno do banco sem `ORDER BY` explícito.
9. **Booleanos**: `true`/`false` literais. Nunca `1`/`0`.

## Envelope canônico

```json
{
  "contract": "seal-v1",
  "issuedAt": "<ISO-8601 UTC>",
  "kind": "RELATORIO | CONSULTA_AUDITORIA",
  "payload": {},
  "scope": {
    "filters": {},
    "requesterScopeUnitIds": [],
    "isEmptyResult": false,
    "isPartial": false
  }
}
```

O `artifactFormat` (PDF/CSV/JSON) **não** entra no envelope: é exatamente por isso que os três
formatos do mesmo recorte compartilham o mesmo `contentDigest`, como FR-098 exige.

## Escalas decimais declaradas

| Campo | Escala |
|---|---|
| `calculatedValue` | 4 |
| `snapshotGoalValue` | 4 |
| `snapshotScoreWeight` | 2 |
| `indicatorScore` | 2 |
| `slaDeflatorApplied` | 2 |
| `totalScore` | 2 |

Agregações derivadas declaram a própria escala no envelope, junto do `n` efetivo que as produziu.

## Pipeline

```
recorte → serialização canônica (este contrato)
        → contentDigest  = SHA-256(bytes canônicos)      [prova do dado]
        → renderização no formato pedido (PDF | CSV | JSON)
        → artifactDigest = SHA-256(bytes entregues)      [prova do arquivo]
        → signature      = Ed25519(contentDigest, chave privada)
        → ExportSeal (imutável) + QR code + código legível
```

A ordem é obrigatória. Assinar o `artifactDigest` em vez do `contentDigest` quebraria FR-098.

## Versionamento

`sealContractVersion` é gravado em cada `ExportSeal`. A verificação de um selo antigo usa **a versão
registrada nele**, nunca a corrente. Uma versão nova do contrato jamais invalida selos anteriores —
é acréscimo, não substituição.

## Testes obrigatórios (Princípio VI + portões de qualidade da constituição)

- Regressão de selagem que detecte alteração de **um único byte** no conteúdo canônico.
- Mesmo recorte em PDF, CSV e JSON produz `contentDigest` idêntico e `artifactDigest` distinto.
- Objeto com chaves em ordem de inserção invertida produz o mesmo digest.
- `0` medido e `NAO_PREENCHIDO` produzem digests diferentes — nunca colapsam.
- Recorte vazio produz envelope válido e selável (FR-097).
