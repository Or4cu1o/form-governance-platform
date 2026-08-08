<!--
SYNC IMPACT REPORT
==================
Versão: TEMPLATE (não versionado) → 1.0.0
Tipo de bump: MAJOR (ratificação inicial — primeira definição concreta de governança)

Princípios definidos (todos novos; o arquivo anterior era o template com placeholders):
  - [PRINCIPLE_1_NAME] → I. Não-Destrutividade e Trilha Imutável (INEGOCIÁVEL)
  - [PRINCIPLE_2_NAME] → II. Histórico Congelado por Snapshot
  - [PRINCIPLE_3_NAME] → III. Ausência de Dado Nunca é Zero (INEGOCIÁVEL)
  - [PRINCIPLE_4_NAME] → IV. Configuração Antes de Código
  - [PRINCIPLE_5_NAME] → V. O Backend é a Autoridade
  - (novo)             → VI. Integridade Probatória Verificável
  - (novo)             → VII. Determinismo, Reprodutibilidade e Degradação Segura

Seções adicionadas:
  - [SECTION_2_NAME] → Restrições Tecnológicas e de Segurança
  - [SECTION_3_NAME] → Fluxo de Desenvolvimento e Portões de Qualidade
  - [GOVERNANCE_RULES] → Governança (emenda, versionamento, conformidade)

Seções removidas: nenhuma.

Fonte de derivação: docs/Master_Technical_&_Product_Specification.md
  (§1.2 Princípios de produto; §2 Conceitos Centrais; F5, F8, F9, F11, F16, F17.4/F17.5/F17.9,
   F18; §8-A Persistência Imutável; §8-B Desempenho; §10 Qualidade; §11-A Requisitos não
   funcionais transversais)

Follow-up TODOs: nenhum. Todos os placeholders foram substituídos por valores concretos.
-->

# Constituição do FormOps

Plataforma de Governança e Automação de Indicadores de TI — AGIR / GCINFRA.

Esta constituição rege o desenvolvimento do FormOps. Ela é derivada do documento master
(`docs/Master_Technical_&_Product_Specification.md`) e destila dele apenas o que é
inegociável. O documento master permanece a fonte de verdade sobre *o que* o produto faz;
esta constituição declara *sob quais regras* qualquer implementação pode existir.

O acervo produzido pela plataforma é usado como insumo em auditoria externa. Toda regra
abaixo existe para que o acervo seja defensável perante um auditor — não por preferência
estética ou de estilo.

## Princípios Fundamentais

### I. Não-Destrutividade e Trilha Imutável (INEGOCIÁVEL)

Nada se perde e nada é sobrescrito sem registro.

- É PROIBIDO `DELETE` físico de entidade de negócio. Desligamento de pessoal, encerramento
  de unidade e aposentadoria de indicador operam exclusivamente via `is_active = false`.
- `IndicatorResponse` NÃO PODE sofrer `UPDATE` in place: cada alteração DEVE inserir uma nova
  versão em `indicator_response_version`, fechando a anterior com `valid_to` na mesma
  transação. `UPDATE` e `DELETE` DEVEM permanecer revogados no banco para as roles da
  aplicação — a garantia é do banco, não da disciplina de quem escreve o código.
- A trilha de auditoria DEVE ser populada por trigger de banco. Toda escrita transacional
  DEVE atravessar `runWithAuditContext({ userId, sourceIp, userAgent, origin, requestId }, tx)`.
  Escrita que chegue ao banco sem contexto de auditoria DEVE ser rejeitada, nunca gravada em
  silêncio.
- `audit.audit_log` e `audit.access_log` são append-only. A aplicação NÃO PODE expor operação
  de escrita, alteração ou exclusão sobre eles.
- Ações não humanas (cron, coleta automática, seed) DEVEM declarar ator de sistema
  identificável e `origin` correspondente. As duas superfícies públicas por especificação
  (verificador de selo, resolver de evidências para BI) DEVEM declarar ator anônimo
  explicitamente — "ninguém autenticado, e sabemos disso" é registro; "não sabemos quem foi"
  é falha.
- Soft delete remove o item da superfície de trabalho, NUNCA da superfície de auditoria:
  evidência desativada permanece visível e recuperável em auditoria, exportação e camada
  analítica, marcada como desativada com autor e data.

**Racional.** Uma plataforma capaz de apagar prova não sustenta auditoria. Se a garantia
depender de a aplicação lembrar de registrar, ela falha no dia em que alguém esquecer.

### II. Histórico Congelado por Snapshot

O passado é imutável; mudanças de definição valem apenas para o futuro.

- Na instanciação de um relatório, cada indicador DEVE ser congelado na resposta: título,
  objetivo, chaves de variáveis, expressão da fórmula, operador e valor da meta, peso e
  código canônico gravados como campos `snapshot*`.
- Alteração de fórmula, meta, peso ou estrutura na Engine No-Code afeta relatórios
  **futuros** apenas. Relatórios já instanciados NÃO PODEM ser reinterpretados
  retroativamente.
- `indicatorScore`, `slaDeflatorApplied`, `totalScore` e os marcadores de pontualidade são
  calculados **uma única vez**, na finalização, e NUNCA recalculados.
- Toda leitura histórica — aplicabilidade de indicador, área de auditoria, camada analítica —
  DEVE resolver pelo snapshot e pela instância vigente à época, NUNCA pela definição corrente.
- Uma entrada de `IndicatorCatalog` NÃO PODE ter sua unidade de medida alterada após o
  primeiro vínculo; a correção é criar código novo e realocar, deixando o rastro visível.

**Racional.** Sem congelamento, alterar uma meta hoje reescreveria o veredito de conformidade
de todo o histórico — e a plataforma passaria a afirmar sobre o passado algo que ninguém
apurou naquela época.

### III. Ausência de Dado Nunca é Zero (INEGOCIÁVEL)

A plataforma jamais preenche lacuna. Um número apresentado é sempre um número que o sistema
apurou.

- As cinco representações DEVEM permanecer distintas e nunca colapsadas: valor apurado; `0`
  (medido, resultado zero); `N/A — fora do nível`; `N/A — indicador inativo no período`;
  `Não preenchido`.
- O avaliador de fórmulas NÃO PODE produzir resultado silencioso, `NaN`, infinito ou zero de
  conveniência. Variável ausente, divisão por zero ou resultado não finito DEVEM produzir
  `calculatedValue` nulo com motivo registrado e apresentado ao usuário. Sem
  `calculatedValue`, `isCompliant` permanece nulo e o indicador não pontua.
- `0` é entrada legítima e DEVE ser aceito e exibido como qualquer outro número apurado —
  inclusive no tratamento visual.
- É PROIBIDA qualquer imputação: sem interpolação, sem repetição do último valor conhecido,
  sem inferência. `N/A` e `Não preenchido` ficam fora do denominador, e o `n` efetivo DEVE
  acompanhar toda métrica derivada.
- O clone do Estado Residente é por **chave declarada**, nunca por posição. Chave ausente no
  período anterior fica `Não preenchido`; clone incompleto DEVE ser marcado como parcial e
  sinalizado para conferência.
- Consulta sem resultado DEVE informar explicitamente o conjunto vazio. O sistema NÃO PODE
  ampliar período, remover unidade, afrouxar recorte nem sugerir combinações alternativas.
- Toda tabela e toda exportação DEVEM carregar legenda explícita dos códigos de ausência.

**Racional.** Em auditoria, `0` afirma que a métrica foi apurada e deu zero; `N/A` afirma que
não havia obrigação de coletá-la. São declarações diferentes com consequências diferentes —
confundi-las falsifica o histórico inteiro.

### IV. Configuração Antes de Código

Parâmetro de governança é dado administrável, não constante de código.

- DEVEM residir em `SystemSetting` e ser editáveis pela área administrativa sem deploy: dias
  úteis limite de elaboração, revisão e aprovação; extensão por reprova; deflator de SLA;
  padrão de nomenclatura de exportação; janela de retenção WORM; inclusão de pontos
  facultativos no cálculo de dias úteis; limites de amplitude e de contagem exata das
  consultas de auditoria.
- DEVEM residir na Engine No-Code: formulários, tópicos, indicadores, chaves de variáveis,
  expressões de fórmula, operadores, metas, pesos e o catálogo canônico.
- Introduzir constante de código para qualquer um dos itens acima é violação desta
  constituição, ainda que funcionalmente equivalente.
- Toda alteração de configuração DEVE ser registrada na trilha de auditoria com autor, data e
  valores anterior e novo.
- Configuração cujo efeito é irreversível — notadamente a retenção ilimitada (`-1`) — DEVE
  exigir confirmação em diálogo dedicado, distinto do salvamento comum, com o alcance da
  irreversibilidade declarado sem eufemismo antes do clique.

**Racional.** A GCINFRA precisa evoluir a estrutura de governança sem ciclo de
desenvolvimento. Um parâmetro em código transforma decisão de negócio em pedido de deploy.

### V. O Backend é a Autoridade

A autorização real é do servidor; o cliente é conveniência de experiência.

- Toda requisição DEVE revalidar autenticação, role e escopo de unidade. `ProtectedRoute`,
  filtragem de navegação e demais controles de frontend são UX e NÃO PODEM ser tratados como
  segurança.
- **Escopo constante:** toda superfície de leitura — painel, área de auditoria, exportação,
  agregação — DEVE respeitar exatamente o mesmo escopo de unidades do usuário, sem exceção.
- Escopo de unidade, papel e permissão NUNCA entram em camada de cache. Acesso revogado que
  sobrevive a um TTL é falha de autorização, não de desempenho.
- Toda entrada DEVE passar por `ValidationPipe` global com `whitelist`,
  `forbidNonWhitelisted` e `transform`; toda saída DEVE trafegar por DTO de saída declarado,
  que exclui por omissão qualquer campo não listado.
- Anexo DEVE ser aceito por **assinatura binária** conferida contra lista fechada, com
  coerência exigida entre extensão, mimetype declarado e bytes reais. O `Content-Type`
  informado pelo cliente não é evidência de nada. O nome do arquivo DEVE ser gerado pelo
  servidor.
- Sessão em cookie `HttpOnly`; toda rota de escrita DEVE exigir token anti-CSRF validado no
  servidor.

**Racional.** O produto custodia material probatório. Uma verificação que só existe no
navegador é uma verificação que o atacante não executa.

### VI. Integridade Probatória Verificável

O que sai da plataforma carrega prova de origem e inalterabilidade, conferível por terceiros.

- Todo artefato exportado — relatório concluído e extração de auditoria, em PDF, CSV e JSON,
  inclusive parciais e conjuntos vazios — DEVE receber selo de integridade.
- O pipeline é obrigatório e nesta ordem: serialização canônica (ordem fixa de campos,
  normalização de decimais, datas ISO-8601 UTC, UTF-8) → `contentDigest` (SHA-256 do dado) e
  `artifactDigest` (SHA-256 dos bytes entregues) → assinatura Ed25519 → registro imutável em
  `ExportSeal` → estampagem de QR code e código legível.
- A serialização canônica DEVE ser definida sobre contrato próprio e versionado, NUNCA sobre
  DTO de apresentação — uma mudança cosmética de DTO não pode invalidar selos já emitidos.
- `ExportSeal` é imutável. Revogação é registro adicional com motivo, nunca alteração ou
  exclusão do selo original.
- A verificação DEVE funcionar sem autenticação e offline, pela chave pública correspondente
  ao `keyId` publicado em endpoint estável e versionado. O verificador público NÃO PODE expor
  valores de indicadores, análises, planos de ação ou evidências.
- A chave privada de assinatura DEVE residir em serviço de gestão de chaves ou módulo de
  hardware, jamais no repositório, no `.env` ou em backup de banco.
- Evidências DEVEM ser gravadas sob *Object Lock* em modo **Compliance**, com a janela de
  retenção carimbada no ato do `PutObject`. Arquivo não varrido NÃO PODE entrar no bucket
  imutável: o upload aterrissa em quarentena e somente o veredito `LIMPO` o promove.
- Texto livre DEVE ser gravado exatamente como digitado e neutralizado apenas na saída:
  escape em tela, PDF e JSON; prefixação defensiva de células iniciadas por `=`, `+`, `-` ou
  `@` em CSV. Transformar o dado na entrada destrói prova.

**Racional.** O selo prova integridade e origem, não veracidade do dado — e essa distinção
DEVE permanecer declarada para que o alcance da garantia não seja superestimado em auditoria.

### VII. Determinismo, Reprodutibilidade e Degradação Segura

O comportamento é previsível, recomputável e resistente a falha de periferia.

- Duas execuções da mesma consulta sobre o mesmo acervo DEVEM produzir o mesmo resultado, na
  mesma ordem, com critério de desempate estável e declarado.
- Todo número apresentado DEVE ser recomputável a partir dos dados brutos exportados da mesma
  consulta. Toda métrica derivada exibe o denominador efetivo que a produziu.
- A Área de Auditoria DEVE consultar dado vivo. View materializada é admitida apenas em
  Painel Central e camada analítica — defasagem invisível em superfície selada é defeito, não
  otimização.
- Exportação DEVE ser server-side. É PROIBIDO construir artefato a partir do DOM: com
  virtualização, o DOM contém apenas o viewport, e o resultado seria arquivo incompleto com
  selo válido.
- Falha de serviço acessório (e-mail, object storage, fonte de coleta) NUNCA reverte transação
  de negócio já persistida nem bloqueia o ciclo. Indisponibilidade de coleta mantém o
  indicador `Não preenchido` com o erro registrado — jamais grava `0`.
- O custo de uma consulta DEVE depender do recorte pedido, não do tamanho do acervo:
  paginação por cursor sobre coluna indexada, `OFFSET` em profundidade PROIBIDO, consulta em
  laço PROIBIDA (`for`, `map` assíncrono ou `Promise.all` sobre chamadas individuais ao
  banco).
- A camada analítica projeta o que o OLTP decidiu e NÃO PODE introduzir lógica de negócio
  nova. Divergência entre BI e área de auditoria é defeito, não interpretação.

**Racional.** O acervo cresce monotonicamente porque nada é apagado. Um desenho que funciona
no primeiro ano e degrada no terceiro é inaceitável em plataforma cuja utilidade aumenta com
a profundidade do histórico.

## Restrições Tecnológicas e de Segurança

**Stack fixa.** Monorepo npm workspaces com `apps/api` (NestJS 10 + Prisma + PostgreSQL) e
`apps/web` (React 18 + Vite + TypeScript + Tailwind). Substituir qualquer elemento desta base
é decisão de arquitetura sujeita a emenda desta constituição, não escolha de implementação.

**Topologia de persistência.** Três schemas com responsabilidades estritamente separadas:
`public` (OLTP, escrita exclusiva da aplicação), `audit` (append-only, DML revogado) e
`analytics` (somente leitura, derivado). A role da aplicação, a role analítica (`tableau_ro`)
e a role administrativa de banco DEVEM ser distintas, com privilégio mínimo cada uma.

**Configuração.** Todo segredo vive em variável de ambiente, documentado sem valor real em
`.env.example`. URLs compostas (`DATABASE_URL`, `S3_ENDPOINT`, `VITE_API_URL`) DEVEM ser
**derivadas** das variáveis atômicas — porta e URL nunca duplicadas. A validação de ambiente
DEVE falhar rápido, com mensagem clara, na ausência de segredo obrigatório.

**Segurança de base.** `helmet()` no bootstrap; CORS com origem explícita obrigatória em todo
ambiente (curinga é incompatível com sessão em cookie); rate limiting global e limite estrito
no login; bloqueio dinâmico primário **por conta**, não por endereço — as unidades são
hospitais atrás de NAT, e banimento por IP derrubaria a unidade inteira; senhas em `bcryptjs`,
nunca retornadas pela API; Prisma com queries parametrizadas; TLS até o banco com
`verify-full` em produção. CSP sem `unsafe-inline` e sem `unsafe-eval`, com
`frame-ancestors 'none'`.

**Identidade e idioma.** A identidade visual é institucional e fixa, declarada em fonte única
(`apps/web/src/config/brand.ts`). NÃO PODE existir hexadecimal solto em componente nem string
literal com nome de organização, departamento ou sistema. A paleta semântica de status é
reservada ao workflow e não é reaproveitada. Interface, mensagens de erro, e-mails e artefatos
exportados DEVEM estar em português do Brasil. Estado NUNCA é comunicado apenas por cor.

**Riscos aceitos.** Todo risco de segurança conscientemente assumido DEVE estar documentado e
justificado em `apps/api/SECURITY-NOTES.md` ou `apps/web/SECURITY-NOTES.md`, e consultado
antes de alterar a área correspondente.

## Fluxo de Desenvolvimento e Portões de Qualidade

**Testes primeiro.** Funcionalidade nova e correção de defeito seguem Red-Green-Refactor: o
teste é escrito antes, falha, e só então a implementação o torna verde.

**Cobertura e convenções.** Cobertura mínima de **80%** em ambos os workspaces. Todo
componente de UI e de domínio DEVE ter arquivo `.test.tsx` par; todo cliente de API DEVE ter
`.test.ts` par. Backend: Jest para unitários e integração contra PostgreSQL real; frontend:
Vitest + Testing Library.

**Invariantes com cobertura obrigatória.** As regras abaixo são invariantes de integridade,
não detalhes de apresentação, e DEVEM ter teste explícito:

- `N/A` nunca é `0`, em todas as cinco representações (Princípio III);
- resultado vazio sem relaxamento automático de filtro (Princípio III);
- matriz esparsa em consulta multi-nível (Princípio III);
- regressão de selagem que detecte alteração de **um único byte** no conteúdo canônico
  (Princípio VI);
- soma dos pesos ativos de um template igual a 10,00 como condição de operabilidade.

**Portões antes do merge.** Lint por ESLint obrigatório nos dois workspaces; build verde
(`npm run build`); suíte completa verde (`npm test`); revisão de código com verificação
explícita de conformidade a esta constituição. Achado CRÍTICO bloqueia o merge.

**Migrações.** Versionadas em `apps/api/prisma/migrations/`. O ciclo de inicialização do
container em produção DEVE aplicar migrações pendentes de forma 100% automatizada. É
TERMINANTEMENTE PROIBIDA a dependência de comando manual no servidor para criar ou atualizar
schema e enums.

**Complexidade.** Toda complexidade adicional DEVE ser justificada contra a alternativa mais
simples. Na ausência de justificativa registrada, prevalece a solução simples.

## Governança

**Supremacia.** Esta constituição prevalece sobre qualquer outra prática, convenção ou
preferência de implementação no projeto. Conflito entre esta constituição e um documento
subordinado resolve-se a favor dela; conflito entre ela e o documento master
(`docs/Master_Technical_&_Product_Specification.md`) indica erro de derivação e DEVE ser
tratado como emenda, não como exceção pontual.

**Emenda.** Alteração desta constituição exige (a) proposta escrita declarando o princípio
afetado e o motivo, (b) avaliação de impacto sobre código, testes e acervo já produzido, e
(c) registro no Sync Impact Report no topo deste arquivo. Um princípio marcado
**INEGOCIÁVEL** só é alterado ou removido por emenda MAJOR com justificativa explícita — a
inconveniência de cumpri-lo não é justificativa.

**Versionamento.** Versionamento semântico sobre a própria constituição:

- **MAJOR** — remoção ou redefinição incompatível de princípio ou de regra de governança;
- **MINOR** — novo princípio ou seção, ou expansão material de orientação existente;
- **PATCH** — esclarecimento, correção de redação, refinamento não semântico.

**Conformidade.** Toda revisão de código e todo pull request DEVEM verificar conformidade com
os sete princípios. Planos de implementação (`/speckit-plan`) DEVEM declarar como cada
princípio aplicável é atendido, e desvios DEVEM ser registrados com justificativa antes da
implementação, nunca depois. `CLAUDE.md` fornece a orientação operacional de rotina
(comandos, stack, notas do repositório) e é subordinado a este documento.

**Version**: 1.0.0 | **Ratified**: 2026-08-07 | **Last Amended**: 2026-08-07
