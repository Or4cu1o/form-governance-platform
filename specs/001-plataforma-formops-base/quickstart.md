# Phase 1 — Quickstart: validação da Etapa 1

**Plan**: [plan.md](./plan.md) · **Data model**: [data-model.md](./data-model.md) ·
**Contracts**: [contracts/](./contracts/) · **Date**: 2026-08-07

Guia de **validação executável**, não de implementação. Cada cenário abaixo prova, de ponta a ponta,
um comportamento que a spec exige. Detalhes de campo estão em `data-model.md`; formas de payload,
em `contracts/`.

## Pré-requisitos

- Node.js 26.x, Docker 29.x e Docker Compose v5.
- Bucket imutável do MinIO criado **com versionamento e object locking habilitados na criação** —
  não é ativável depois (`research.md`, D7).
- Par de chaves Ed25519 provisionado; a privada **fora** do repositório e fora do `.env` ordinário.

## Preparação

```bash
npm install
npm run docker:up                    # postgres, minio, api, web
npm run prisma:migrate:deploy --workspace=apps/api
npm run seed:demo                    # unidades, formulário, usuários dos cinco perfis
```

Estado esperado: três schemas (`public`, `audit`, `analytics`), roles distintas e `SELECT` como
`tableau_ro` funcionando apenas em `analytics`.

## Verificação contínua

```bash
npm run build                        # api + web
npm test                             # Jest + Vitest
npm run test:cov --workspace=apps/api
npm run test:cov --workspace=apps/web
npm run lint --workspace=apps/api
npm run lint --workspace=apps/web
```

Portões: build verde, suíte verde, cobertura ≥ 80% em ambos os workspaces, lint sem erro.

---

## Cenários de validação

### V1 — Ciclo mensal completo (US1, US2)

1. Avançar o relógio para o primeiro dia útil do mês, ou disparar o cron do ciclo de vida.
2. Confirmar que **toda** unidade ativa tem relatório instanciado, sem ação humana (SC-001).
3. Como elaborador, confirmar que os dados estruturais chegaram herdados e marcados como **não
   conferidos**; ao menos 60% dos campos pré-preenchidos (SC-013).
4. Informar variáveis, submeter para revisão; como revisor, submeter para aprovação.
5. Como aprovador, emitir veredito **com justificativa** em cada indicador e finalizar.

**Esperado**: relatório `CONCLUIDO`, travado para escrita, nota congelada. Cada indicador com
veredito, justificativa e autor (SC-003).

### V2 — Ausência nunca vira zero (Princípio III — invariante obrigatória)

1. Deixar uma variável em branco → resultado ausente, **motivo exibido na linha do indicador**,
   conformidade indefinida, peso fora da nota.
2. Informar `0` em outro indicador → aceito, exibido como qualquer número apurado.
3. Consultar unidades de níveis diferentes na Área de Auditoria.

**Esperado**: as cinco representações distintas na matriz esparsa; `absenceLegend` presente na tela
**e** no arquivo exportado; nenhuma célula com `0` ou vazio silencioso (SC-004).

### V3 — Herança parcial (US1-3)

Adicionar uma chave de variável nova à definição e abrir o período seguinte.

**Esperado**: a chave fica `NAO_PREENCHIDO`, a resposta é marcada `HERDADO_PARCIAL` e o elaborador é
alertado. Em nenhuma hipótese a chave recebe zero ou o valor de outra chave.

### V4 — Conflito de edição concorrente (US2-10, FR-129)

1. Abrir o mesmo indicador como revisor e como elaborador durante a reabertura por reprova.
2. Gravar pelo primeiro; gravar pelo segundo com o `expectedVersionId` antigo.

**Esperado**: **409** com o valor vencedor, quem o informou e quando. Nenhuma sobrescrita
silenciosa. A sobrescrita, se confirmada, é segunda requisição deliberada e fica distinguível na
trilha por `overwroteVersionId`.

### V5 — Não-destrutividade (Princípio I, SC-005)

1. Tentar `UPDATE` e `DELETE` diretos em `indicator_response_version`, `audit.audit_log` e
   `audit.access_log` **com a credencial da aplicação**.
2. Tentar exclusão física de usuário, unidade e evidência por qualquer rota.

**Esperado**: recusa em 100% dos casos, pelo **banco**, com a tentativa registrada. Desativar um
usuário preserva sua autoria legível em todo o acervo.

### V6 — Congelamento (US3-7, US4-9, SC-015)

1. Exportar um relatório concluído.
2. Alterar peso, meta e fórmula do indicador.
3. Exportar o mesmo relatório de novo e comparar.

**Esperado**: exportações idênticas. Nota, meta e peso do relatório emitido não mudam.

### V7 — Pontualidade por submissão (FR-057, FR-058)

Estourar o prazo, ser reprovado, receber extensão e reenviar dentro do prazo estendido.

**Esperado**: uma linha em `ReportSubmission` por envio, nenhuma sobrescrita. O atraso pretérito
permanece registrado — a extensão perdoa o ciclo novo, nunca o anterior.

### V8 — Selo e verificação por terceiro (US7, SC-009, SC-010)

1. Exportar o mesmo recorte em PDF, CSV e JSON.
2. Conferir que os três compartilham o **mesmo** `contentDigest` e têm `artifactDigest` distintos.
3. Verificar o código pelo verificador público, **sem credencial**.
4. Alterar **um único byte** de um dos arquivos e verificar de novo.
5. Consultar um código inexistente e um malformado.

**Esperado**: (2) confirma FR-098; (3) exibe veredito, unidade, período, aprovador e prova, e
**nenhum** valor de indicador; (4) retorna `CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO`; (5) respostas
indistinguíveis, inclusive em latência.

### V9 — Verificação offline (US7-11)

Com a plataforma **parada**, conferir a assinatura usando apenas o documento impresso e a chave
pública previamente publicada.

**Esperado**: verificação bem-sucedida sem contato com a plataforma.

### V10 — Evidência infectada (SC-018, FR-039a)

Enviar o arquivo de teste EICAR.

**Esperado**: aterrissa na quarentena, veredito `BLOQUEADO`, download **403**, guarda pericial de 1
ano registrada, e o arquivo **jamais** ingressa no bucket imutável. O relatório não avança de etapa
enquanto houver anexo `PENDENTE`.

### V11 — Retenção imutável (FR-042)

Tentar sobrescrever e remover um objeto do bucket imutável **com a credencial mais privilegiada**.

**Esperado**: recusa pelo Object Lock em modo Compliance. Reduzir a janela de retenção afeta apenas
gravações futuras; o acervo já gravado não é liberado.

### V12 — Determinismo e desempenho (SC-007, SC-011)

Executar a consulta canônica de referência — *"período de X a Y, todas as unidades, indicador de
quantitativo de servidores"* — duas vezes.

**Esperado**: resultados idênticos, **inclusive na ordem das linhas**; primeira página em < 3 s
sobre 24 meses × todas as unidades. Repetir com o acervo várias vezes maior e confirmar que o tempo
não degrada.

### V13 — Paridade BI ↔ auditoria (SC-019)

Fazer a mesma pergunta à Área de Auditoria e ao schema `analytics`.

**Esperado**: mesmo número, mesmo `n`. Divergência é defeito, não interpretação.

### V14 — Resolver de evidência (SC-020)

Abrir o vínculo de evidência a partir do BI, **sem conta na plataforma**; abrir de novo.

**Esperado**: primeira vez entrega o arquivo; segunda apresenta tela amigável de expiração, nunca
erro cru. Ambas registradas. O endereço real do armazenamento nunca aparece.

### V15 — Escopo constante (US6-10, FR-006)

Como usuário de escopo restrito, percorrer tela inicial, elaboração, auditoria e exportação.

**Esperado**: exatamente as mesmas unidades em todas. Revogar um acesso adicional produz efeito
**imediato**, sem intervalo de tolerância.

### V16 — Degradação segura (SC-016, SC-017)

1. Derrubar SMTP e object storage; submeter e aprovar um relatório.
2. Errar a senha de um usuário repetidamente a partir do endereço público compartilhado da unidade.

**Esperado**: (1) transições persistem, falhas registradas, ciclo prossegue; (2) o bloqueio recai
sobre a **conta**, e os demais usuários da mesma unidade continuam acessando.

### V17 — Restauração (SC-021, FR-130)

Executar o exercício de restauração a partir do backup.

**Esperado**: plataforma operante em ≤ 4 h; nenhum trabalho registrado há mais de 15 min antes da
falha é perdido. Resultado do exercício registrado — backup nunca restaurado não é backup.

---

## Invariantes com teste obrigatório

A constituição exige cobertura explícita para estas, independentemente dos cenários acima:

- `N/A` nunca é `0`, nas cinco representações.
- Resultado vazio sem relaxamento automático de filtro.
- Matriz esparsa em consulta multi-nível.
- Regressão de selagem que detecte alteração de **um único byte** no conteúdo canônico.
- Soma dos pesos ativos de um template igual a 10,00 como condição de operabilidade.
