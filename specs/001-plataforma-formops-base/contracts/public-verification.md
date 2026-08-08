# Contrato: Verificador Público de Selo

**Requisitos**: FR-100 a FR-106, US7 · **Princípio VI**

Superfície **sem autenticação**, alcançável fora da rede corporativa. Sem ela, o caso de uso central
— o auditor externo com a via impressa e nenhuma credencial — não se sustenta.

## Rotas

### `GET /verificar/:codigo` (interface) e `GET /api/public/seals/:codigo` (dados)

Consulta um código de verificação.

**Resposta 200** — sempre 200, inclusive para código inexistente (ver *Não-enumerabilidade*):

```json
{
  "verdict": "INTEGRO | CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO | CONTEUDO_DIVERGENTE | REVOGADO | NAO_ENCONTRADO",
  "issuedAt": "<ISO-8601 UTC | null>",
  "unitAcronym": "<sigla | null>",
  "referencePeriod": "<YYYY-MM | null>",
  "reportStatus": "<estado | null>",
  "approver": { "name": "<nome | null>", "jobTitle": "<cargo | null>" },
  "artifactKind": "RELATORIO | CONSULTA_AUDITORIA | null",
  "artifactFormat": "PDF | CSV | JSON | null",
  "contentDigest": "<sha256 hex | null>",
  "artifactDigest": "<sha256 hex | null>",
  "signature": "<base64 | null>",
  "keyId": "<identificador | null>",
  "sealContractVersion": "<seal-v1 | null>",
  "revocation": { "reason": "<motivo>", "revokedAt": "<ISO-8601 UTC>" }
}
```

**O que NUNCA aparece** (FR-102): valor de indicador, análise crítica, plano de ação, evidência,
nome de usuário que não seja o do aprovador responsável, e qualquer identificador interno.

### `POST /api/public/seals/:codigo/verify-artifact`

Confronta o arquivo que o auditor tem em mãos com a prova registrada. Aceita o `artifactDigest`
calculado pelo próprio auditor — **o arquivo não é enviado**, o que evita que a plataforma receba
conteúdo não solicitado.

```json
{ "artifactDigest": "<sha256 hex>" }
```

Retorna o mesmo envelope acima, com o `verdict` resolvido pela comparação.

### `GET /api/public/keys` e `GET /api/public/keys/:keyId`

Chaves públicas em endereço **estável e versionado**, para verificação offline (FR-104). Selos
emitidos sob chaves anteriores permanecem verificáveis: a chave nunca é removida do endpoint, apenas
marcada como aposentada.

```json
{
  "keys": [
    {
      "keyId": "<id>",
      "algorithm": "Ed25519",
      "publicKey": "<base64>",
      "activeFrom": "<ISO-8601 UTC>",
      "retiredAt": "<ISO-8601 UTC | null>"
    }
  ]
}
```

## Distinção de vereditos (FR-103)

| Veredito | Condição |
|---|---|
| `INTEGRO` | `contentDigest` confere, assinatura válida, `artifactDigest` confere |
| `CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO` | `contentDigest` e assinatura conferem; `artifactDigest` diverge — o dado é o mesmo, o arquivo foi editado depois |
| `CONTEUDO_DIVERGENTE` | O artefato não corresponde a nada emitido |
| `REVOGADO` | Existe registro em `ExportSealRevocation`; o selo original permanece intacto |
| `NAO_ENCONTRADO` | Código sem correspondência |

## Não-enumerabilidade (FR-100, FR-105)

- O `verificationCode` é gerado por fonte criptograficamente segura, **não sequencial**, com
  alfabeto sem caracteres ambíguos (`0`/`O`, `1`/`I`) e dígito verificador — legível por humano a
  partir de via impressa.
- **Código inexistente e código malformado produzem resposta indistinguível**, inclusive no tempo de
  resposta: a rota executa comparação em tempo constante e aplica atraso de normalização antes de
  responder. Diferença de latência é vazamento de informação.
- Rate limiting **próprio** desta rota, independente do limite global.

## Registro (FR-072, FR-073)

Toda verificação gera `AccessLog` com `eventType = VERIFICACAO_SELO` e
`actorKind = ANONIMO_DECLARADO` — "ninguém autenticado, e sabemos disso". `userId` nulo aqui é
declaração deliberada, não desconhecimento.

## Verificação offline

Com o documento impresso, a chave pública publicada e o `keyId` estampado, o auditor confere a
assinatura sem contatar a plataforma (FR-104, cenário US7-11). O QR code carrega o código de
verificação e o `keyId`; assinatura e digests são estampados em texto legível no rodapé do documento.

## Testes obrigatórios

- Um byte alterado no arquivo → `CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO`, nunca `INTEGRO`.
- Código inexistente e código malformado: respostas idênticas em corpo e em distribuição de latência.
- Selo revogado retorna motivo e data, e o registro original permanece consultável.
- Nenhum valor de indicador aparece em qualquer resposta desta superfície.
- Selo emitido sob chave aposentada continua verificável.
