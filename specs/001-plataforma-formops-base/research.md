# Phase 0 — Research: FormOps Etapa 1

**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Date**: 2026-08-07

## Método e limites

O Technical Context do plano não contém nenhum `NEEDS CLARIFICATION`: a stack está fixada pela
constituição, a escala foi decidida em `/speckit-clarify` e o documento master
(`docs/Master_Technical_&_Product_Specification.md`) já prescreve a maior parte das escolhas de
engenharia. As decisões abaixo consolidam o que o documento master mandata, o que a constituição
exige e o que o estado atual do repositório impõe.

**Declaração de honestidade metodológica**: as decisões marcadas `[verificar na implementação]`
dependem de detalhe de versão de biblioteca ou de comportamento de serviço externo que deve ser
confirmado contra a documentação primária antes de codificar. Estão marcadas para que
`/speckit-tasks` gere a tarefa de verificação — não para serem assumidas como resolvidas.

---

## D1 — Versionamento append-only de respostas de indicador

**Decision**: tabela `indicator_response_version` no schema `public`, com `validFrom` e `validTo`
(`timestamptz`), gravada exclusivamente por `INSERT`. Alterar uma resposta abre versão nova e
fecha a anterior com `validTo` **na mesma transação**. `UPDATE` e `DELETE` permanecem revogados no
banco para a role da aplicação. A versão corrente é a que tem `validTo IS NULL`, garantida por
índice único parcial: `UNIQUE (indicator_response_id) WHERE valid_to IS NULL`.

**Rationale**: o Princípio I exige que a garantia seja do banco, não da disciplina de quem escreve
código. O índice único parcial torna fisicamente impossível haver duas versões correntes — a
condição de corrida vira erro de constraint, não corrupção silenciosa. É também o alicerce de D2.

**Alternatives considered**:
- *`UPDATE` in place com histórico em tabela paralela por trigger* — rejeitado: a trilha viraria a
  única cópia do passado; uma falha de trigger perderia histórico sem sinal.
- *Extensão `temporal_tables`* — rejeitada: dependência externa não prevista na constituição, e o
  padrão manual é simples demais para justificá-la.
- *Versionamento em `jsonb` dentro da própria linha* — rejeitado: impede índice sobre versão
  histórica e torna a consulta de auditoria dependente de varredura.

---

## D2 — Concorrência otimista (FR-129)

**Decision**: toda gravação de resposta envia o identificador da versão sobre a qual o autor
editava. O servidor aceita apenas se essa versão ainda for a corrente. Se não for, responde
**409 Conflict** com o valor vencedor, quem o informou e quando, e o cliente apresenta a escolha
explícita ao usuário. A confirmação de sobrescrita é uma **segunda requisição deliberada**,
distinguível na trilha de uma correção comum pelo campo `overwroteVersionId`.

**Rationale**: a clarificação Q1 decidiu detecção na gravação — nem bloqueio, nem
*last-write-wins*. O índice único parcial de D1 já rejeita a segunda escrita concorrente no nível
do banco; o 409 traduz essa rejeição para linguagem de usuário. Registrar a sobrescrita como
evento próprio atende à parte de FR-129 que proíbe registrá-la como se fosse correção deliberada.

**Alternatives considered**:
- *Bloqueio pessimista com lock de edição* — rejeitado: revisor e elaborador editam
  colaborativamente durante a reabertura, e o lock transformaria colaboração em fila.
- *Merge automático campo a campo* — rejeitado: decidir por conta própria qual valor prevalece é
  imputação, proibida pelo Princípio III.

---

## D3 — Serialização canônica e selo de integridade

**Decision**: pipeline obrigatório, nesta ordem — serialização canônica (ordem lexicográfica fixa
de campos, decimais normalizados em notação sem expoente com escala declarada, datas ISO-8601 UTC
com `Z`, UTF-8 sem BOM) → `contentDigest` = SHA-256 do dado canônico → `artifactDigest` = SHA-256
dos bytes efetivamente entregues → assinatura **Ed25519** sobre o `contentDigest` → registro
imutável em `ExportSeal` → estampagem de QR code e código legível. O contrato de serialização é
próprio e versionado (`sealContractVersion`), definido em
[contracts/canonical-serialization.md](./contracts/canonical-serialization.md), **nunca** derivado
de DTO de apresentação.

Ed25519 vem do `node:crypto` nativo (`generateKeyPairSync('ed25519')`, `crypto.sign(null, data,
key)`), sem dependência externa — a API do Node aceita `null` como algoritmo de hash para Ed25519,
que assina a mensagem diretamente.

**Rationale**: Princípio VI. Dois digests separados são o que permite a distinção exigida por
FR-103 entre "conteúdo íntegro, arquivo adulterado" e "conteúdo divergente" — sem eles a
verificação só saberia dizer "algo mudou". O versionamento do contrato existe para que mudança
cosmética de DTO não invalide selos já emitidos.

**Alternatives considered**:
- *RSA-2048/PSS* — rejeitado: assinatura e chave maiores sem ganho; Ed25519 produz 64 bytes, que
  cabem confortavelmente no QR code junto do código de verificação.
- *`JSON.stringify` direto como forma canônica* — rejeitado: a ordem de chaves segue a ordem de
  inserção do objeto, o que tornaria o digest dependente do código que o construiu.
- *Assinar o `artifactDigest` em vez do `contentDigest`* — rejeitado: quebraria FR-098, que exige
  que os três formatos do mesmo recorte compartilhem a mesma prova de conteúdo.

**Bibliotecas escolhidas (2026-08-08)**: `qrcode` (^1.5.4) para o QR code — puro JS, sem
dependência nativa de compilação, MIT. `pdfkit` (^0.15.1) para o PDF server-side — API de fluxo de
documento em puro JS (usa `fontkit`, sem binário nativo), MIT, adequada a um documento com layout
de texto corrido, QR code embutido e rodapé com digests em texto legível (FR-108). `pdf-lib` foi
considerada e preterida: seu modelo de edição de página é mais indicado a formulários PDF
existentes do que à composição de um relatório com fluxo de texto do zero.

---

## D4 — Três schemas PostgreSQL com Prisma

**Decision**: `public` (OLTP), `audit` (append-only) e `analytics` (derivado, somente leitura).
Habilitar o preview feature `multiSchema` do Prisma e declarar `schemas = ["public", "audit",
"analytics"]` no bloco `datasource`, com `@@schema("...")` por modelo. Três roles distintas com
privilégio mínimo: a da aplicação (`INSERT`/`SELECT` em `audit`, sem `UPDATE` nem `DELETE`),
`tableau_ro` (`SELECT` apenas em `analytics`) e a administrativa de migração.

**Rationale**: constituição, seção "Topologia de persistência". A revogação de DML precisa ser do
banco. `GRANT`/`REVOKE` são emitidos por migração SQL explícita, já que o Prisma não os gera.

**Alternatives considered**:
- *Schema único com disciplina de aplicação* — rejeitado pela constituição.
- *Banco separado para auditoria* — rejeitado: perderia a transacionalidade entre o fato de
  negócio e seu registro na trilha, que é justamente o que torna a trilha confiável.

**Verificado na implementação (2026-08-08, T002)**: `multiSchema` está disponível como preview
feature no Prisma `5.22.0` (versão pinada em `apps/api/package.json`) e `prisma validate` aceita
`schemas = ["public", "audit", "analytics"]` no `datasource` com `@@schema("public")` declarado em
todos os 13 modelos e 7 enums existentes — confirmado com `npx prisma validate`. Achado colateral:
o ambiente não tinha `node_modules` instalado; `npx prisma` sem instalação local baixa a versão
mais recente da registry (testado: `7.9.1`), que já não aceita `url` no bloco `datasource` nem
trata `multiSchema` como preview feature — são incompatíveis com este schema. `prisma migrate` com
`GRANT`/`REVOKE` em migração manual (T035, T151) ainda não foi exercitado — permanece
`[verificar na implementação]` até a Fase 2 rodar a migração real contra Postgres.

---

## D5 — Paginação por cursor na Área de Auditoria

**Decision**: paginação *keyset* sobre chave composta estável e totalmente ordenada —
`(referencePeriod DESC, unitId ASC, indicatorCode ASC, responseId ASC)`. O cursor é a codificação
opaca dessa tupla. `OFFSET` profundo é proibido. Contagem exata fica reservada a recortes abaixo
do limite configurável (padrão 10.000 registros); acima dele a interface informa teto ou contagem
aproximada.

**Rationale**: o Princípio VII exige que o custo dependa do recorte, não do acervo, e que duas
execuções produzam a mesma ordem. O último componente da chave (`responseId`) é o critério de
desempate estável exigido por FR-089 — sem ele, linhas empatadas nos três primeiros campos
poderiam trocar de posição entre execuções.

**Alternatives considered**:
- *`LIMIT`/`OFFSET` clássico* — rejeitado: o custo cresce com a profundidade, e inserção
  concorrente desloca linhas entre páginas.
- *Ordenação apenas por `createdAt`* — rejeitada: colisões de timestamp quebram o determinismo.

---

## D6 — Índices para a consulta de auditoria

**Decision**: índice GIN com `jsonb_path_ops` sobre as colunas `jsonb` de valores de variáveis, e
`pg_trgm` com índice GIN sobre os campos textuais alcançados pela busca dentro do resultado (sigla
e nome de unidade, título de indicador, código canônico). Índice B-tree composto sobre a chave de
paginação de D5. Nenhuma view materializada na área de auditoria.

**Rationale**: §8-B do documento master e Princípio VII. `jsonb_path_ops` é menor e mais rápido que
o operador padrão para consultas de contenção, que é o padrão de acesso desta área. `pg_trgm`
atende FR-092, que exige que a busca alcance o conjunto inteiro e não o trecho renderizado. A
proibição de view materializada aqui vem do Princípio VII: defasagem invisível em superfície
selada é defeito, não otimização.

**Alternatives considered**:
- *Busca externa (Elasticsearch/Meilisearch)* — rejeitada: introduz segunda fonte de verdade,
  proibida por FR-079, além de dependência não prevista na constituição.

---

## D7 — Retenção imutável de evidências e quarentena

**Decision**: bucket de quarentena mutável e bucket imutável com *Object Lock* em modo
**Compliance**. O upload aterrissa na quarentena; a varredura antivírus (ClamAV via daemon) emite
veredito; somente `LIMPO` promove o objeto ao bucket imutável, com `ObjectLockRetainUntilDate`
carimbado no ato do `PutObject` a partir da janela vigente (`SystemSetting`, padrão 10 anos; `-1`
= indeterminado). Arquivo com detecção positiva permanece na quarentena sob guarda pericial de
**1 ano** (FR-039a), com expurgo automático ao término e liberação antecipada possível ao
administrador mediante registro.

**Rationale**: Princípio VI. O modo Compliance é o único em que nem a credencial raiz remove o
objeto durante a janela — exatamente o que FR-042 exige. Carimbar a retenção no `PutObject`, e não
como política de bucket, é o que faz a alteração do parâmetro valer apenas para gravações futuras
(FR-043).

**Alternatives considered**:
- *Modo Governance* — rejeitado: permite remoção por quem tenha permissão de bypass, o que
  falsifica a garantia declarada ao auditor.
- *Varredura após a promoção* — rejeitada: um arquivo infectado gravado sob Compliance seria
  irremovível por dez anos.

`[verificar na implementação]` o Object Lock no MinIO exige bucket criado com versionamento e
*object locking* habilitados **na criação** — não é ativável depois. `docker-compose.yml` e o
provisionamento de desenvolvimento precisam refletir isso.

---

## D8 — Sessão em cookie `HttpOnly` e anti-CSRF

**Decision**: migrar o JWT de `sessionStorage` para cookie `HttpOnly; Secure; SameSite=Strict`,
com token anti-CSRF em padrão *double-submit* validado no servidor em toda rota de escrita. CORS
com origem explícita obrigatória em todos os ambientes — curinga é incompatível com sessão em
cookie. `apps/web/SECURITY-NOTES.md` deve ser atualizado no mesmo commit que concluir a migração.

**Rationale**: Princípio V e FR-002. É a única **VIOLAÇÃO** ativa da constituição no código atual.

**Alternatives considered**:
- *Manter `sessionStorage` como risco aceito* — rejeitado: risco aceito documentado não revoga
  princípio inegociável; a nota de segurança registra a exposição, não a autoriza em definitivo.
- *`SameSite=Lax`* — rejeitado sem necessidade demonstrada; `Strict` é o padrão mais seguro e o
  fluxo não depende de navegação cross-site de terceiros.

---

## D9 — Recuperação de desastre (FR-130, SC-021)

**Decision**: WAL archiving contínuo com recuperação a ponto no tempo (PITR), base backup
periódico e réplica de leitura promovível. Envio para repositório isolado ao qual a credencial de
origem **não** tenha permissão de remoção. Exercício de restauração periódico, com resultado
registrado. Alvos: RPO ≤ 15 min, RTO ≤ 4 h.

**Rationale**: clarificação Q2 e FR-130. A cláusula do repositório sem permissão de remoção é o
que impede que o mesmo comprometimento que destrói o primário destrua também o backup.

**Alternatives considered**:
- *`pg_dump` diário* — rejeitado: RPO de até 24 h, incompatível com o alvo de 15 minutos.
- *Réplica síncrona como único mecanismo* — rejeitada: réplica propaga corrupção lógica e `DROP`
  acidental instantaneamente; não substitui backup com ponto no tempo.

---

## D10 — Feriados móveis e dias úteis

**Decision**: manter `business-days.util.ts`, que já implementa o cálculo. Páscoa pelo algoritmo de
Meeus/Jones/Butcher; Sexta-Feira Santa derivada dela entra no cálculo; Carnaval e Corpus Christi
ficam **desligados por padrão**, com inclusão configurável em `SystemSetting`.

**Rationale**: FR-014, FR-015 e a premissa de feriados da spec. São pontos facultativos que variam
por órgão e município — ligá-los por padrão criaria prazo diferente do praticado.

**Alternatives considered**:
- *Biblioteca externa de feriados brasileiros* — rejeitada: o conjunto necessário é pequeno e
  estável, e a dependência traria calendário municipal irrelevante ao caso.

---

## D11 — Camada analítica para BI

**Decision**: schema `analytics` composto por **views** (não materializadas na área selada),
expondo exclusivamente relatórios concluídos, com metas, pesos e nota lidos dos campos `snapshot*`
congelados. Acesso concedido apenas à role `tableau_ro`, restrita a `SELECT`. O vínculo de
evidência exposto ao BI é um resolver da própria plataforma, com token HMAC-SHA256 de uso único e
vida curta, que nunca revela o endereço real do armazenamento.

**Rationale**: FR-114 a FR-122 e Princípio VII — a camada projeta o que o OLTP decidiu e não
introduz lógica nova. Divergência entre BI e área de auditoria é defeito, não interpretação
(FR-122), o que exige que ambas leiam a mesma origem congelada.

**Alternatives considered**:
- *Acesso direto do Tableau às tabelas operacionais* — rejeitado por FR-114: evolução interna
  quebraria painéis.
- *ETL para banco analítico separado* — rejeitado nesta etapa: duplicaria o acervo e criaria
  janela de divergência, violando FR-122 sem ganho na escala prevista.

`[verificar na implementação]` view materializada é admitida em Painel Central e camada analítica
pelo Princípio VII; a decisão de materializar depende de medição real de desempenho e não deve ser
antecipada.

**Medição (T161, T161a — SC-011, SC-012, SC-012a)**: scripts prontos em
`apps/api/scripts/measure-canonical-query-performance.ts` (`npm run measure:canonical-query`,
primeira página da consulta canônica sobre 24 meses × todas as unidades, limiar 3s, repetido
contra escalas maiores) e `apps/api/scripts/measure-monthly-close-load.ts`
(`npm run measure:monthly-close-load`, 60 unidades × 400 usuários disputando a mesma janela de
prazo). **Não executados neste sandbox** — mesma limitação de rede Docker isolada já documentada
nas Fases 8–10 (sem Postgres real alcançável, `seed-demo.ts` hoje cobre 6 meses, abaixo da escala
de 24 meses exigida pela medição). A decisão de materializar segue **não antecipada**: nenhum
número real foi produzido ainda para justificá-la. Rodar os dois scripts contra um ambiente com
Postgres real na escala-alvo é pré-requisito para fechar este `[verificar na implementação]`.

---

## Resumo de resolução

| Item | Estado |
|---|---|
| `NEEDS CLARIFICATION` no Technical Context | Nenhum — todos resolvidos antes da Fase 0 |
| Decisões consolidadas | D1 a D11 |
| Pendências `[verificar na implementação]` | 4 — D3 (bibliotecas), D4 (`multiSchema`), D7 (MinIO Object Lock), D11 (materialização) |
| Bloqueios para a Fase 1 | Nenhum |

Nenhuma pendência impede o desenho da Fase 1: todas são de detalhe de execução, não de forma do
modelo de dados nem dos contratos.
