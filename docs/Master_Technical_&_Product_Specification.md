# FormOps — Plataforma de Governança e Automação de Indicadores de TI

**Especificação de Produto, Funcionalidades e Identidade Visual**

| | |
|---|---|
| **Sistema** | FormOps — Governança e Automação de Indicadores de TI |
| **Proprietário** | AGIR — Associação de Gestão, Inovação e Resultados em Saúde |
| **Área responsável** | GCINFRA — Gerência Corporativa de Infraestrutura |
| **Analista responsável** | Leone Santos Martins - Analista de Infraestrutura |
| **Natureza** | Sistema corporativo privado |
| **Público-alvo** | Analistas de TI, supervisores e coordenadores das unidades geridas e da Matriz |
| **Documento** | Documento master do projeto — especifica a íntegra do produto: o que deve existir, como deve funcionar e sob quais regras |

> **Confidencialidade.** Este é um produto interno e proprietário da AGIR. O código, a identidade visual, os formulários N1/N2/N3, as metas de governança e a massa de dados operacionais não são destinados a distribuição externa. Toda referência de marca, nomenclatura e paleta descrita aqui é fixa e institucional — não há modo genérico, neutro ou de terceiros.

---

## Índice

1. [Visão Geral e Objetivo Operacional](#1-visão-geral-e-objetivo-operacional)
2. [Conceitos Centrais de Arquitetura](#2-conceitos-centrais-de-arquitetura)
3. [Modelo de Domínio](#3-modelo-de-domínio)
4. [Funcionalidades](#4-funcionalidades)
   - [F1 — Identidade, Autenticação e Sessão](#f1--identidade-autenticação-e-sessão)
   - [F2 — RBAC e Escopo por Unidade](#f2--rbac-e-escopo-por-unidade)
   - [F3 — Ciclo de Vida do Relatório e Motor de SLA](#f3--ciclo-de-vida-do-relatório-e-motor-de-sla)
   - [F4 — Elaboração e Revisão Colaborativa](#f4--elaboração-e-revisão-colaborativa)
   - [F5 — Motor de Fórmulas e Aferição de Conformidade](#f5--motor-de-fórmulas-e-aferição-de-conformidade)
   - [F6 — Evidências e Object Storage](#f6--evidências-e-object-storage)
   - [F7 — Mesa de Validação Técnica](#f7--mesa-de-validação-técnica)
   - [F8 — Sistema de Pontuação e Deflator de SLA](#f8--sistema-de-pontuação-e-deflator-de-sla)
   - [F9 — Engine No-Code de Formulários](#f9--engine-no-code-de-formulários)
   - [F10 — Administração de Acessos](#f10--administração-de-acessos)
   - [F11 — Configurações da Plataforma](#f11--configurações-da-plataforma)
   - [F12 — Painel Central e Inteligência de Dados](#f12--painel-central-e-inteligência-de-dados)
   - [F13 — Motor de Exportação de Conformidade](#f13--motor-de-exportação-de-conformidade)
   - [F14 — Mensageria Transacional](#f14--mensageria-transacional)
   - [F15 — Trilha de Auditoria Contínua](#f15--trilha-de-auditoria-contínua)
   - [F16 — Segurança Aplicada](#f16--segurança-aplicada)
   - [F17 — Área de Auditoria e Rastreabilidade](#f17--área-de-auditoria-e-rastreabilidade)
   - [F18 — Selo de Integridade e Verificação Pública de Exportações](#f18--selo-de-integridade-e-verificação-pública-de-exportações)
   - [F19 — Camada de Consumo Analítico (ELT / Tableau)](#f19--camada-de-consumo-analítico-elt--tableau)
5. [Identidade Visual e Design System](#5-identidade-visual-e-design-system)
6. [Mapa de Ambientes e Telas](#6-mapa-de-ambientes-e-telas)
7. [Superfície de API](#7-superfície-de-api)
8. [Engenharia, Infraestrutura e Inicialização](#8-engenharia-infraestrutura-e-inicialização)
    - [8-A. Arquitetura de Dados, Persistência Imutável e Telemetria](#8-a-arquitetura-de-dados-persistência-imutável-e-telemetria)
    - [8-B. Desempenho e Otimização Full-Stack](#8-b-desempenho-e-otimização-full-stack)
9. [Formulários Proprietários N1, N2 e N3](#9-formulários-proprietários-n1-n2-e-n3)
10. [Qualidade e Estratégia de Testes](#10-qualidade-e-estratégia-de-testes)
11. [Etapa 2 — Automação Integral de Coleta (API-Driven)](#11-etapa-2--automação-integral-de-coleta-api-driven)
    - [11-A. Requisitos não funcionais transversais](#11-a-requisitos-não-funcionais-transversais)
12. [Glossário](#12-glossário)

---

## 1. Visão Geral e Objetivo Operacional

O FormOps digitaliza, centraliza e audita o processo de confecção do **Relatório Operacional de TI** das unidades geridas pela AGIR, extinguindo o modelo legado baseado em documentos `.docx` manuais, planilhas de consolidação e capturas de tela descentralizadas.

A solução unifica o fluxo em uma plataforma web governada por:

- **Prazos rígidos** calculados em dias úteis, com engine de cron própria;
- **Trilhas de auditoria** imutáveis em nível de banco de dados;
- **Segmentação de formulários** por complexidade da unidade;
- **Pontuação objetiva** de desempenho por relatório, com deflator por atraso;
- **Consulta de auditoria** sobre todo o acervo, cruzando unidade, período e indicador, com telemetria de autoria e alteração;
- **Verificabilidade externa** dos documentos emitidos, por selo criptográfico com QR code;
- **Preparação de dados** para consumo analítico via Tableau (pipeline ELT sobre a camada relacional consolidada).

A plataforma não é apenas um repositório de indicadores de TI: ela existe para dar **visibilidade, rastreabilidade, validade, confiabilidade e integridade** ao acervo, porque os relatórios são usados como insumo em processos de auditoria.

### 1.1 Estratégia de evolução

O produto adota duas etapas sequenciais e retrocompatíveis:

| Etapa | Nome | Escopo |
|---|---|---|
| **1** | **BASE** — Plataforma Web Assistida e Governança No-Code | Portal corporativo, motor de cálculo dinâmico, persistência relacional, filtros e busca, área de auditoria e rastreabilidade, exportação estruturada com selo de integridade, telemetria de prazo, sistema de pontuação, engine de formulários dinâmicos, RBAC estrito, administração de SLA e configurações do portal |
| **2** | **AUTOMAÇÃO** — Coleta API-Driven | Scripts de extração, APIs e webhooks para coleta autônoma de indicadores automatizáveis a partir de ferramentas especialistas (Zabbix, Grafana, GLPI, Bitdefender GravityZone), preenchendo relatórios em modo rascunho e isolando a edição humana às contingências |

A Etapa 2 é **acréscimo**, não substituição: a coleta automática alimenta as mesmas entidades, respeita as mesmas regras de validação, auditoria e selagem, e nunca remove a capacidade de preenchimento manual.

### 1.2 Princípios de produto

1. **Nada se perde.** Nenhuma entidade é fisicamente excluída; nenhum valor é sobrescrito sem registro de auditoria.
2. **O histórico é imutável.** Relatórios já emitidos preservam a definição do indicador vigente na data de emissão, mesmo que a definição mude depois.
3. **Prazo é dado, não é aviso.** O atraso não apenas notifica: ele deflaciona a nota final da unidade.
4. **Configuração antes de código.** Formulários, indicadores, fórmulas, metas, pesos, prazos e nomenclatura de exportação são administráveis pela interface, sem deploy.
5. **O backend é a autoridade.** O RBAC do frontend é conveniência de UX; a autorização real é revalidada a cada requisição.
6. **A plataforma nunca preenche lacuna.** Ausência de dado é declarada como ausência, com o motivo exato — jamais convertida em zero, jamais suprida por inferência. Um número apresentado é sempre um número que o sistema apurou.
7. **O que sai da plataforma é verificável.** Todo artefato exportado carrega prova criptográfica de origem e integridade, conferível por terceiros sem acesso ao sistema.

---

## 2. Conceitos Centrais de Arquitetura

### 2.1 Estado Residente (persistência estática)

Dados estruturais estáveis — inventário de servidores físicos, ativos de rede, links de internet contratados, licenças — são cadastrados uma única vez. Na virada do mês, o sistema clona automaticamente o estado do período anterior para a nova instância do relatório, exigindo do analista apenas a validação de modificações. Isso mitiga esquecimentos e elimina retrabalho de digitação.

- Indicadores marcados com `isResidentState = true` participam do clone.
- A resposta clonada é sinalizada com `isClonedFromResident = true`, permitindo à interface destacar o que veio herdado e ainda não foi conferido no período corrente.
- O clone só ocorre quando existe resposta correspondente no mês anterior da mesma unidade.

**Quando a definição do indicador mudou entre os meses.** O clone copia valores de variáveis, e as chaves declaradas (`variableKeys`) podem ter sido alteradas na Engine No-Code no intervalo. A regra é de correspondência por chave, nunca por posição:

| Situação da chave | Comportamento |
|---|---|
| Existe no mês anterior **e** na definição vigente | Valor clonado normalmente |
| Existe na definição vigente, **ausente** no mês anterior | Fica `Não preenchido` — jamais recebe `0` nem valor de outra chave |
| Existia no mês anterior, **removida** da definição vigente | Descartada no clone; permanece íntegra no histórico do período anterior |

Se **alguma** chave não pôde ser clonada, a resposta é marcada como clone parcial e sinalizada ao Elaborador para conferência — herdar silenciosamente um conjunto incompleto produziria um indicador que parece conferido sem ter sido.

### 2.2 Snapshot Imutável do Indicador

No momento da instanciação de um relatório, cada indicador é congelado na resposta: título, objetivo, chaves de variáveis, expressão da fórmula, operador da meta, valor da meta e peso de pontuação são gravados como `snapshot*` em `IndicatorResponse`.

**Consequência:** alterar uma fórmula ou meta na Engine No-Code afeta apenas relatórios **futuros**. Relatórios já emitidos permanecem matematicamente coerentes com a regra vigente à época — condição essencial para que o Tableau pondere o histórico contra o estado atual sem distorção retroativa.

### 2.3 Validação Ativa e Contraprova

A consolidação manual em planilhas é substituída por um fluxo integrado no qual a Matriz executa a contraprova **indicador por indicador** dentro do sistema, inserindo parecer técnico obrigatório e flag de conformidade individual, com anexo opcional de evidência da própria contraprova.

### 2.4 Soft Delete Obrigatório

É proibida a exclusão física (`DELETE`) de entidades de negócio. Desligamento de pessoal, encerramento de filial ou aposentadoria de um indicador operam estritamente via `is_active = false`, preservando integridade referencial e leitura histórica.

### 2.5 Auditoria em Nível de Banco

A trilha de auditoria não depende de a aplicação lembrar de registrar. Ela é populada por **trigger de banco de dados**, e o contexto completo da ação — autor, IP, cliente, canal e correlação de requisição — é propagado por variáveis de sessão através de `runWithAuditContext({ ... }, tx)`, assinatura única em toda a plataforma (8-A.3). Qualquer escrita transacional feita pela API já chega ao trigger com esse contexto.

---

## 3. Modelo de Domínio

### 3.1 Entidades

| Entidade | Papel |
|---|---|
| `Unit` | Unidade organizacional — sigla, nome, logotipo, nível (`N1`/`N2`/`N3`), formulário associado, flag de atividade |
| `User` | Pessoa — matrícula, nome, sobrenome, e-mail, hash de senha, **cargo (`jobTitle`)**, role, unidade primária, unidades secundárias (se houver), flag de atividade. Cargo e role são campos distintos: cargo é a função na organização, role é o perfil de acesso na plataforma (8-A.3) |
| `UserUnitAccess` | Concessão de leitura sobre unidades adicionais além da primária |
| `FormTemplate` | Formulário (ex.: N1, N3) — agrupa tópicos, é vinculado a unidades |
| `FormTopic` | Seção temática do formulário (ex.: "1. Segurança da Informação"), com ordem |
| `FormIndicator` | Definição de metadados do indicador — título, objetivo, chaves, fórmula, operador e valor de meta, peso, flag de estado residente, ordem |
| `ReportInstance` | Instância mensal do relatório de uma unidade — status, datas de SLA, notas, marcadores de pontualidade |
| `IndicatorResponse` | Resposta de um indicador dentro de um relatório, com snapshot da definição, valores das variáveis, resultado calculado, conformidade, análise crítica, plano de ação e status de validação |
| `EvidenceFile` | Arquivo de evidência vinculado a uma resposta ou a um registro de validação |
| `ValidationRecord` | Contraprova do Aprovador sobre um indicador — veredito, justificativa, evidências |
| `SystemSetting` | Tabela singleton de configuração — nomenclatura de exportação, dias úteis de SLA, extensão por reprova, deflator, janela de retenção WORM das evidências |
| `AuditLog` | Registro imutável de alteração, no schema `audit` — tabela, registro, ação, autor (com nome, cargo, role e unidade materializados), valor anterior, valor novo, IP de origem, user-agent, canal e `requestId` (8-A.3) |
| `AccessLog` | Registro imutável de leitura, no schema `audit` — consultas de auditoria, exportações, downloads de evidência, verificações de selo e autenticações (8-A.4) |
| `IndicatorResponseVersion` | Versão append-only de uma resposta de indicador, com vigência `valid_from`/`valid_to`. Substitui o `UPDATE` in place: cada alteração insere uma versão nova e preserva a anterior (8-A.2) |
| `IndicatorCatalog` | Catálogo canônico de indicadores — código estável, nome, descrição e unidade de medida. Dá identidade comum a métricas equivalentes que vivem em formulários diferentes (F17.7) |
| `ExportSeal` | Selo de integridade de um artefato exportado — código de verificação, **digest de conteúdo e digest de artefato** (F18.1), assinatura, chave signatária, escopo, autoria e estado de revogação (F18.2) |
| `ReportSubmission` | Registro append-only de cada submissão de um relatório — etapa, autor, timestamp, prazo vigente contra o qual foi aferida e veredito de pontualidade resultante. Uma reabertura por reprova gera submissão nova, jamais sobrescreve a anterior (F8) |

### 3.2 Enumerações

| Enum | Valores |
|---|---|
| `RoleName` | `OBSERVADOR`, `ELABORADOR`, `REVISOR`, `APROVADOR`, `ADMINISTRADOR` |
| `UnitLevel` | `N1`, `N2`, `N3` — complexidade da unidade; determina o formulário aplicável. Nomenclatura única em todo o produto: interface, banco, exportações e camada analítica |
| `GoalOperator` | `GTE`, `LTE`, `EQ`, `GT`, `LT` |
| `ReportStatus` | `PENDENTE`, `EM_REVISAO`, `PENDENTE_APROVACAO`, `CONCLUIDO` |
| `IndicatorValidationStatus` | `EM_REVISAO`, `PENDENTE_VALIDACAO`, `APROVADO`, `REPROVADO` |
| `ValidationVerdict` | `APROVADO`, `REPROVADO` |
| `AuditAction` | `INSERT`, `UPDATE`, `SOFT_DELETE` — a desativação lógica é registrada com ação própria, e não como `UPDATE` genérico, para que "o que foi desativado, por quem" seja consulta direta e não varredura de diferenças em JSON (8-B.1) |

### 3.3 Invariantes estruturais

- `ReportInstance` é único por `(unitId, referenceMonth)` — uma unidade tem no máximo um relatório por período.
- `IndicatorResponse` é único por `(reportInstanceId, formIndicatorId)`.
- `UserUnitAccess` é único por `(userId, unitId)`.
- A soma dos pesos (`scoreWeight`) dos indicadores ativos de um `FormTemplate` deve ser exatamente **10** para que o template seja **operável**. A soma divergente é estado transitório admitido e sinalizado (*pendente de balanceamento*, F9): o template persiste, mas não vincula unidades nem instancia relatórios enquanto não fechar em 10,00. A validação é de operabilidade, não de gravação — bloquear a persistência impediria a própria correção.
- Metas e valores calculados usam `Decimal(18,4)`; notas e pesos usam `Decimal(5,2)`.
- `IndicatorCatalog.code` é único e estável; um `FormIndicator` referencia no máximo um código canônico, e indicadores com unidades de medida distintas nunca são agregados entre si.
- `ExportSeal.verificationCode` é único, não sequencial e não enumerável; o selo é imutável — revogação é registro adicional, nunca alteração.

---

## 4. Funcionalidades

### F1 — Identidade, Autenticação e Sessão

**Objetivo.** Autenticar o colaborador da AGIR e estabelecer um contexto de sessão portátil e verificável.

| Item | Comportamento |
|---|---|
| Credencial | Matrícula **ou** e-mail institucional + senha |
| Hash de senha | `bcryptjs` |
| Token | JWT com expiração padrão `8h` (configurável por `JWT_EXPIRES_IN`), transportado em cookie `HttpOnly` (F16.2) — jamais em armazenamento acessível a script |
| Payload | Identificação do usuário, role e unidade primária |
| Guarda global | `JwtAuthGuard` aplicado a toda a API, com decorator `@Public()` para exceções (login, health) |
| Rate limiting | Global de 20 requisições/60s; limite mais estrito aplicado especificamente ao endpoint de login (proteção contra força bruta) |
| Contexto no cliente | `AuthContext` (React) expõe usuário, role, unidade e ação de logout |
| Recuperação de sessão | `GET /auth/me` reidrata o contexto a cada carregamento da SPA |

**Endpoints:** `POST /auth/login`, `GET /auth/me`.

---

### F2 — RBAC e Escopo por Unidade

**Objetivo.** Garantir que cada usuário enxergue e altere exatamente o que sua função e sua lotação permitem.

Cada usuário está estritamente associado a **uma Role** e a **uma Unidade primária**, podendo receber acessos de leitura adicionais a outras unidades.

| Role | Escopo e poderes |
|---|---|
| **Observador** | Leitura exclusiva de relatórios históricos e atuais da sua unidade e das unidades explicitamente permitidas. Sem qualquer capacidade de escrita. |
| **Elaborador** | Analista de infraestrutura/TI local. Preenche variáveis voláteis, análise crítica, plano de ação e evidências da sua unidade. Submete para revisão. |
| **Revisor** | Superior técnico imediato (supervisor/coordenador). Valida, edita diretamente os valores e responde solidariamente pelos dados enviados à Matriz. Submete para aprovação. |
| **Aprovador** | Analista técnico da Matriz. Audita, aplica contraprova indicador a indicador, aprova ou reprova, e finaliza o relatório. Escopo organizacional — todas as unidades. |
| **Administrador** | Acesso irrestrito. Gestor de roles, usuários e unidades; operador da Engine No-Code e das configurações de plataforma. |

**Mecanismos de enforcement:**

- `RolesGuard` + decorator `@Roles(...)` nos controllers da API;
- `UnitAccessService` resolve o conjunto de unidades visíveis por usuário (primária + concedidas);
- `report-edit-access.util` decide, por status do relatório e role, se a escrita é permitida — impedindo, por exemplo, que um Elaborador altere um relatório já em fase de aprovação;
- No frontend, `ProtectedRoute` filtra rotas por role e a navegação lateral só renderiza itens autorizados. **Isso é UX, não segurança:** o backend revalida sempre.

---

### F3 — Ciclo de Vida do Relatório e Motor de SLA

**Objetivo.** Governar o ciclo mensal com prazos calculados em dias úteis, sem intervenção humana na abertura de período.

#### Máquina de estados

```
  [Cron — 1º DU do mês]
          │
          ▼
     PENDENTE
          │  submit-for-review            (Elaborador)
          ▼
     EM_REVISAO ◄────────────────────────────────┐
          │  submit-for-approval  (Revisor)      │
          ▼                                      │
  PENDENTE_APROVACAO                             │
          │                                      │
          ├── finalize + algum indicador ────────┘
          │   reprovado   (+ extensão de SLA)
          │
          └── finalize + todos aprovados
                     │
                     ▼
                 CONCLUIDO
            (travado para escrita)
```

#### Fases e prazos

| Fase | Prazo padrão | Responsável | Transição |
|---|---|---|---|
| **Abertura do período** | 1º dia útil do mês | Cron do sistema | Gera a instância com status `PENDENTE`, injeta o Estado Residente do mês anterior |
| **Elaboração** | até o **6º DU** | Elaborador | `PENDENTE` → `EM_REVISAO` |
| **Revisão** | até o **8º DU** | Revisor | `EM_REVISAO` → `PENDENTE_APROVACAO` |
| **Aprovação** | do 9º ao **10º DU** | Aprovador | `PENDENTE_APROVACAO` → `CONCLUIDO` ou retorno a `EM_REVISAO` |
| **Reabertura por reprova** | **+2 DU** automáticos | Revisor + Elaborador | Nova submissão dentro da extensão |

Todos os prazos (`6`, `8`, `10`, extensão `2`) são **configuráveis** em `SystemSetting` pela área administrativa — não são constantes de código.

#### Engine de dias úteis

- Cron agendado para **06:00 de segunda a sexta** (`0 6 * * 1-5`), com duas rotinas: abertura de períodos mensais e varredura de estouro de SLA.
- O cálculo desconsidera fins de semana e **feriados nacionais de observância obrigatória**: Confraternização Universal, Sexta-Feira Santa (derivada da Páscoa pelo algoritmo Anônimo Gregoriano — Meeus/Jones/Butcher), Tiradentes, Dia do Trabalho, Independência, Nossa Senhora Aparecida, Finados, Proclamação da República e Natal.
- **Carnaval e Corpus Christi não entram no cálculo** — são pontos facultativos que variam por órgão e município. Caso a AGIR queira considerá-los, isso deve virar configuração explícita, não regra embutida.
- Todas as datas são normalizadas para meia-noite UTC, eliminando erros de fuso ao comparar e somar dias.

#### Comportamento na reprova

Se qualquer indicador for reprovado na finalização, o relatório retorna a `EM_REVISAO`, o contador `reprovalCount` é incrementado e uma nova data limite (`slaExtensionDueDate`) é calculada. O formulário reabre para edição colaborativa entre Revisor e Elaborador da **mesma unidade** — não há sub-devolução; a responsabilidade da correção é da unidade.

##### O que acontece com os vereditos já concedidos

O retorno é **seletivo, não integral**. Um veredito de aprovação é trabalho de auditoria já realizado pela Matriz e não é descartado sem motivo:

| Situação do indicador | Estado após a devolução |
|---|---|
| Reprovado na validação | Volta a `EM_REVISAO` — precisa de correção e nova contraprova |
| Aprovado e **não alterado** durante a reabertura | Permanece `APROVADO` |
| Aprovado e **alterado** durante a reabertura | Volta automaticamente a `EM_REVISAO` no instante da alteração — o valor mudou, logo a contraprova anterior não vale mais |

A reversão do indicador alterado é disparada pela própria edição, não pela devolução. Isso preserva a invariante de 8-A.10 (relatório só fecha com 100% dos indicadores em `APROVADO`) sem obrigar a Matriz a revalidar itens intocados.

##### Quem submete após a devolução

A transição de saída continua sendo `submit-for-approval`, de responsabilidade do **Revisor** — o relatório está em `EM_REVISAO`, não em `PENDENTE`. O Elaborador colabora na edição dos valores, mas não reabre o ciclo de revisão: não há retorno a `PENDENTE` depois que um período foi submetido pela primeira vez.

---

### F4 — Elaboração e Revisão Colaborativa

**Objetivo.** Prover a superfície única de preenchimento, com o mesmo componente servindo Elaborador e Revisor, diferenciados apenas pelo que o guard de acesso permite.

**Capacidades por indicador:**

- Entrada das **variáveis declaradas** (`variableKeys`), com rótulos legíveis mapeados por chave (ex.: `EGA` → "Total de Endpoints Gerenciados pelo Antivírus (EGA)");
- Cálculo do resultado e aferição de conformidade contra a meta;
- Campo de **Análise Crítica** (texto livre);
- Campo de **Plano de Ação** (texto livre);
- **Upload de evidências** múltiplas;
- Sinalização visual quando o valor foi **herdado do Estado Residente** e ainda não foi conferido;
- Exibição do status de validação corrente do indicador, incluindo o parecer da Matriz quando houver reprova anterior.

**Ações de fluxo:**

- `POST /report-instances/start-current` — o Elaborador abre o período corrente da sua unidade sob demanda, caso o cron ainda não tenha rodado;
- `POST /report-instances/:id/submit-for-review`;
- `POST /report-instances/:id/submit-for-approval`.

Toda escrita passa por `runWithAuditContext`, garantindo autoria e contexto na trilha de auditoria (8-A.3).

---

### F5 — Motor de Fórmulas e Aferição de Conformidade

**Objetivo.** Permitir que a definição matemática de um indicador seja um dado, não código.

#### Validação de definição (`formula-validator.util`)

Ao cadastrar ou editar um indicador, a expressão é validada antes de ser aceita:

- **Alfabeto restrito:** apenas letras, dígitos, `_`, `+`, `-`, `*`, `/`, `(`, `)`, `,` e espaço;
- **Fechamento de variáveis:** todo identificador citado na fórmula deve constar em `variableKeys`. Uma fórmula que referencia chave não declarada é rejeitada com mensagem explícita.

Isso protege simultaneamente contra erro de digitação do Administrador e contra a fórmula ser usada, adiante, como entrada de um avaliador.

#### Avaliação (`formula-evaluator.util`)

A expressão é avaliada sobre o mapa de variáveis informadas, produzindo `calculatedValue`. A conformidade (`isCompliant`) resulta da aplicação do `snapshotGoalOperator` sobre `calculatedValue` e `snapshotGoalValue`.

##### Condições de contorno da avaliação

O avaliador **nunca** produz resultado silencioso, `NaN`, infinito ou zero de conveniência:

| Condição | Comportamento |
|---|---|
| Alguma variável declarada não foi informada | Não avalia. `calculatedValue` fica nulo e o indicador é `Não preenchido` (F17.4) — nunca calcula com a ausente valendo zero |
| **Divisão por zero** | Não avalia. Registra o motivo (`denominador zero`) e apresenta ao usuário na própria célula, orientando a conferência dos valores de entrada |
| Resultado não finito ou fora do domínio | Mesmo tratamento: resultado nulo com motivo registrado |
| Todas as variáveis informadas e resultado finito | Avalia e afere conformidade normalmente |

**Zero é entrada legítima.** `TOM = 0` (nenhuma ocorrência de malware) é um dado válido e deve ser aceito. O que a plataforma recusa é *inferir* zero onde não houve informação — coerente com a semântica de F17.4.

**Conformidade exige resultado.** Sem `calculatedValue`, `isCompliant` permanece nulo: o indicador não é conforme nem não conforme, e não pontua (F8). Um cálculo impossível jamais é tratado como meta não atingida.

**Precisão.** A avaliação opera em aritmética decimal, não em ponto flutuante binário, evitando que arredondamento decida conformidade em valor de fronteira (ex.: `97,995` contra meta `>= 98`). O arredondamento para exibição e persistência ocorre uma única vez, ao final, na precisão declarada do campo.

#### Exemplo

| Indicador | Variáveis | Fórmula | Meta |
|---|---|---|---|
| Endpoints gerenciados pelo antivírus corporativo | `EGA`, `ENG` | `(EGA / (ENG + EGA)) * 100` | `>= 98,00` |

**Nota de modelagem:** "Total de minutos mensais" não é constante — varia com o número de dias do mês — e o avaliador entende apenas aritmética sobre variáveis informadas, sem funções de calendário. Por isso foi modelado como variável de entrada manual (`MINUTOS_MENSAIS`), preenchida a cada período.

Indicadores binários de inspeção física (temperatura, nobreak, cabos, goteiras, controle de acesso, câmeras, ruídos) são modelados como variáveis `1 = SIM / 0 = NÃO`.

---

### F6 — Evidências e Object Storage

**Objetivo.** Anexar contraprova documental a cada indicador, sem inflar o banco relacional e sem expor a plataforma a upload malicioso.

| Aspecto | Regra |
|---|---|
| Backend de armazenamento | S3-compatível (MinIO em desenvolvimento, S3 em produção), via `@aws-sdk/client-s3` |
| Tipos aceitos | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` — lista fechada |
| Tamanho máximo | 10 MB por arquivo |
| Filtro | `EVIDENCE_MIME_TYPE_FILTER` no `FileInterceptor` — o mimetype informado pelo cliente não é aceito cegamente |
| Validação de conteúdo | Assinatura binária conferida contra a lista fechada, com coerência exigida entre extensão, mimetype declarado e bytes reais (F16.2) |
| Varredura | Scanner de malware antes da liberação; o anexo carrega estado próprio de varredura e só conta como evidência válida quando `LIMPO` (F16.3) |
| Download | URL pré-assinada de vida curta, gerada sob demanda (`@aws-sdk/s3-request-presigner`), entregue como `attachment` |
| Vínculo | Uma evidência pertence a uma `IndicatorResponse` (evidência da unidade) **ou** a um `ValidationRecord` (contraprova da Matriz) |
| Remoção | Soft delete (`isActive = false`) — o arquivo permanece no storage e continua recuperável |
| Retenção física | Bucket sob *Object Lock* em modo **Compliance**: durante a janela de retenção o objeto não é sobrescrito nem removido — nem pela conta raiz. Janela configurável em `SystemSetting`, padrão de 10 anos, carimbada no arquivo no ato da gravação; `-1` a torna ilimitada e irreversível (F11, F16.3) |

**Evidência desativada continua auditável.** O soft delete remove o anexo da superfície de trabalho (elaboração e revisão), **nunca** da superfície de auditoria: a área de auditoria (F17.3), a exportação de conformidade (F13) e a camada analítica (8-A.6) continuam enxergando o arquivo, marcado como desativado, com autor e data da desativação.

O contrário tornaria a plataforma capaz de apagar prova — bastaria desativar a evidência inconveniente para que ela sumisse do rastro. Um anexo que sustentou um veredito da Matriz precisa permanecer recuperável mesmo depois de substituído.

**Racional de segurança.** Sem o filtro de mimetype, um arquivo arbitrário seria gravado com `ContentType` controlado pelo cliente e depois servido por URL pré-assinada — vetor de XSS armazenado e de distribuição de malware disfarçado de evidência.

**Endpoints:** `POST /indicator-responses/:id/evidence`, `POST /validation-records/:id/evidence`, `GET /evidence-files/:id/download-url`.

---

### F7 — Mesa de Validação Técnica

**Objetivo.** Dar ao Aprovador da Matriz uma superfície de auditoria granular, com rastro de parecer por indicador.

#### Painel gerencial (`/validacao`)

Lista todas as unidades e o progresso de cada relatório do período — `Pendente`, `Em revisão`, `Pendente de aprovação`, `Concluído` — com filtros e busca.

#### Detalhe do relatório (`/validacao/:id`)

Para cada indicador, o Aprovador vê valores informados, resultado calculado, conformidade contra a meta, análise crítica, plano de ação e evidências anexadas, e dispõe de dois botões de conferência: **Aprovar** e **Reprovar**.

Ao acionar qualquer um deles, abre-se um **modal de veredito** com:

- Campo de **justificativa técnico-operacional obrigatório**;
- Botão opcional de **upload de imagem/PDF** — evidência da contraprova realizada pela Matriz.

O veredito gera um `ValidationRecord` imutável (autor, veredito, justificativa, timestamp, anexos) e atualiza o `validationStatus` da resposta.

#### Finalização

`POST /report-instances/:id/finalize` só é aceito quando:

1. O relatório está em `PENDENTE_APROVACAO`;
2. **Todo** indicador está em `APROVADO` ou `REPROVADO` — nenhum permanece em `PENDENTE_VALIDACAO` ou `EM_REVISAO`.

Se qualquer indicador estiver reprovado → devolução (ver F3). Caso contrário → `CONCLUIDO`, com cálculo e congelamento da nota (ver F8), travamento para escrita e exposição na camada consumida pelo ELT do Tableau.

**Por que a condição cobre `EM_REVISAO` e não apenas `PENDENTE_VALIDACAO`.** Após uma devolução, um indicador aprovado que a unidade voltar a editar retorna a `EM_REVISAO` (F3). Se o guarda verificasse somente `PENDENTE_VALIDACAO`, esse indicador atravessaria a finalização sem estar aprovado nem reprovado — e o relatório fecharia violando a invariante de 8-A.10, que exige 100% dos indicadores em `APROVADO` para atingir `CONCLUIDO`.

#### Ciclo de vida do indicador

O status de validação do indicador tem máquina própria, encaixada na do relatório (F3):

```
   EM_REVISAO ──────────────────────────────┐
        │  submit-for-approval              │
        ▼  (todo indicador não aprovado      │ edição do valor
           passa a PENDENTE_VALIDACAO)      │ durante a reabertura
  PENDENTE_VALIDACAO                        │
        │                                   │
        ├── veredito Aprovar ──► APROVADO ──┘
        │
        └── veredito Reprovar ─► REPROVADO
                                     │  devolução (F3)
                                     └──► EM_REVISAO
```

| Transição | Disparo |
|---|---|
| `EM_REVISAO` → `PENDENTE_VALIDACAO` | `submit-for-approval` — promove todo indicador que ainda não esteja `APROVADO` |
| `PENDENTE_VALIDACAO` → `APROVADO` / `REPROVADO` | Veredito da Matriz na Mesa de Validação |
| `APROVADO` → `EM_REVISAO` | Edição do valor durante a reabertura (F3) — a contraprova anterior deixa de valer |
| `REPROVADO` → `EM_REVISAO` | Devolução do relatório à unidade (F3) |

Um indicador já `APROVADO` e **não** alterado permanece `APROVADO` na nova submissão: não volta a `PENDENTE_VALIDACAO` e não é reapresentado à Matriz.

---

### F8 — Sistema de Pontuação e Deflator de SLA

**Objetivo.** Converter o desempenho da unidade em uma nota objetiva de 0 a 10, comparável entre unidades e ao longo do tempo.

#### Composição da nota

```
notaIndicadores = Σ snapshotScoreWeight   (somente indicadores que satisfazem AMBAS as condições:
                                           isCompliant = true  E  validationStatus = APROVADO)

deflatorSLA     = (elaboração atrasada ? slaDeflatorScore : 0)
                + (revisão    atrasada ? slaDeflatorScore : 0)

notaFinal       = max(0, notaIndicadores − deflatorSLA)
```

**Regra dura:** meta batida porém reprovada na Mesa de Validação **não pontua**. O sistema recompensa o dado íntegro, não o dado favorável.

**Indicador sem resultado não pontua, e isso é deliberado.** Quando a avaliação não ocorre — variável ausente, denominador zero (F5) — `isCompliant` fica nulo e o peso não entra na soma. A escala **não** é reescalonada para compensar: a nota máxima continua sendo 10, e a unidade perde os pontos. O motivo é que a ausência de resultado é responsabilidade da unidade, que deixou de informar ou informou entrada inválida. Reescalonar premiaria quem entrega menos dado, invertendo o incentivo que o sistema de pontuação existe para criar.

#### Distribuição de pesos

A soma dos pesos dos indicadores ativos de um template deve ser exatamente **10,00**. A plataforma oferece distribuição automática (`distributeScoreWeights`) pelo **método dos maiores restos**: os pontos são convertidos em centavos, divididos igualmente, e o resto é repartido um centavo por vez entre os primeiros indicadores — garantindo soma exata mesmo em divisões não inteiras (ex.: 10 pontos entre 13 indicadores).

O Administrador pode aceitar a distribuição automática ou definir pesos manualmente por indicador, respeitando o total.

#### Pontualidade

Dois marcadores booleanos são gravados na finalização:

- `isElaborationOnTime` — `submittedForReviewAt` ≤ prazo vigente de elaboração;
- `isReviewOnTime` — `submittedForApprovalAt` ≤ prazo vigente de revisão.

O deflator (padrão **2,00 pontos por etapa atrasada**, configurável) é aplicado no máximo duas vezes.

##### Prazo vigente e extensão por reprova

**"Prazo vigente" não é sempre o prazo original.** Quando o relatório é devolvido pela Matriz, a unidade recebe uma extensão automática (`slaExtensionDueDate`, F3). A partir daí, a aferição de pontualidade da **nova** submissão passa a usar a extensão, não a data original:

```
prazoVigenteRevisao = slaExtensionDueDate ?? reviewDueDate
```

Sem essa regra, uma unidade que cumpre integralmente o prazo estendido seria penalizada por atraso — punindo-a por um ciclo adicional que a própria plataforma concedeu.

**O atraso original não é apagado.** Se a unidade já havia estourado o prazo antes da devolução, o marcador permanece `false`: a extensão perdoa o ciclo novo, nunca o atraso pretérito.

**Onde esse histórico vive.** Um relatório devolvido é submetido mais de uma vez, e um campo único de timestamp em `ReportInstance` seria sobrescrito a cada reenvio — apagando justamente a evidência de que houve atraso. Cada submissão gera portanto um registro append-only em `ReportSubmission` (3.1) com etapa, autor, timestamp, prazo vigente contra o qual foi aferida e resultado da aferição. Os marcadores em `ReportInstance` são a **consolidação** dessa série, nunca a sua única fonte, e o histórico completo fica visível no modo detalhado da área de auditoria (F17.3).

**A extensão vale apenas para a revisão.** Não há prazo de elaboração estendido porque não há retorno a `PENDENTE` depois da primeira submissão (F3): a etapa de elaboração é aferida uma única vez, contra o prazo original, e seu veredito não muda em reaberturas posteriores.

#### Congelamento

`indicatorScore`, `slaDeflatorApplied`, `totalScore` e os marcadores de pontualidade são calculados **uma única vez**, na finalização, e nunca recalculados. Alterar pesos ou configurações depois não altera notas já emitidas.

---

### F9 — Engine No-Code de Formulários

**Objetivo.** Permitir que a GCINFRA evolua a estrutura de governança sem ciclo de desenvolvimento.

#### Hierarquia administrável

```
FormTemplate  (ex.: "N1 — Relatório Operacional de TI (Unidades Geridas)")
   └── FormTopic     (ex.: "1. Segurança da Informação")
          └── FormIndicator
                 ├── título
                 ├── objetivo
                 ├── catalogCode         código canônico — obrigatório (F17.7)
                 ├── variableKeys[]      chaves de entrada
                 ├── formulaExpression   ex.: "(EGA / (ENG + EGA)) * 100"
                 ├── goalOperator        >=, <=, =, >, <
                 ├── goalValue           meta nominal
                 ├── scoreWeight         peso na nota — total do template = 10
                 ├── isResidentState     participa do clone mensal?
                 └── order
```

#### Operações disponíveis

| Nível | Criar | Editar | Ativar/Inativar |
|---|:---:|:---:|:---:|
| Template | ✅ | ✅ | ✅ |
| Tópico | ✅ | ✅ | ✅ |
| Indicador | ✅ | ✅ | ✅ |

Além disso: painel de pesos por template (`GET`/`PATCH /form-templates/:id/indicator-scores`) e distribuição automática (`POST /form-templates/:id/indicator-scores/distribute`).

#### Gestão do catálogo canônico

O `catalogCode` é obrigatório em todo indicador (F17.7), o que exige superfície própria de administração do `IndicatorCatalog` — sem ela, o campo obrigatório não teria como ser preenchido:

- **Seleção no cadastro do indicador**, com busca por código ou nome, e **criação inline** de entrada nova quando nenhuma existente servir — evitando que o Administrador abandone o formulário no meio;
- **Painel dedicado** de listagem, criação, edição e desativação de entradas do catálogo, com a contagem de indicadores vinculados a cada código;
- **Desativação sob restrição:** uma entrada com indicadores ativos vinculados não é desativável — o vínculo teria de ser realocado antes, sob pena de tornar aqueles indicadores inconsultáveis na área de auditoria;
- **Unidade de medida imutável após o primeiro vínculo.** Alterá-la depois reinterpretaria retroativamente séries históricas já coletadas; a correção é criar código novo e realocar, deixando o rastro visível.

#### Integridade dos pesos em toda operação estrutural

A invariante "soma dos pesos ativos = 10,00" (3.3) não pode ser quebrada por efeito colateral. Criar, ativar ou inativar um indicador altera o conjunto ativo e, portanto, a soma:

| Operação | Regra |
|---|---|
| **Inativar indicador** | A operação só é aceita acompanhada da redistribuição dos pesos restantes. A interface apresenta a redistribuição automática como padrão e permite ajuste manual antes de confirmar |
| **Ativar indicador** | Idem — o peso do indicador reativado tem de sair de algum lugar |
| **Criar indicador** | Nasce com peso `0` até que a redistribuição seja confirmada; um template com peso pendente é sinalizado ao Administrador |
| **Inativar tópico ou template** | Propaga para os indicadores contidos, sob a mesma regra |

**Nenhum template fica em estado inválido de forma persistente.** Enquanto a soma divergir de 10,00, o template é marcado como *pendente de balanceamento* e **não pode ser vinculado a novas unidades nem instanciar novos relatórios** — mas relatórios já instanciados seguem intactos, porque carregam o peso em snapshot (2.2) e não consultam a definição corrente.

#### Retrocompatibilidade

Modificações refletem-se nos relatórios **futuros**. Relatórios já instanciados preservam o snapshot (ver 2.2). Metas atualizadas passam a valer globalmente para o Tableau ponderar o histórico contra o estado atual, sem reescrever o passado.

---

### F10 — Administração de Acessos

**Objetivo.** Gestão completa de pessoas e unidades sob a regra de não-exclusão.

#### Usuários

Campos: matrícula, nome, sobrenome, e-mail, role, unidade primária, acessos adicionais.

Operações: listar, detalhar, criar, editar, **redefinir senha**, desativar, reativar, conceder acesso a unidade, revogar acesso a unidade.

#### Unidades

Campos: sigla, nome, logotipo, nível (N1/N2/N3), formulário associado.

Operações: listar, detalhar, criar, editar, desativar, reativar.

**Regra crítica de persistência:** é proibida a exclusão física. Desligamento de pessoal ou fechamento de filial opera estritamente via `is_active = false`, mantendo a integridade referencial histórica de todos os relatórios já emitidos por aquela pessoa ou unidade.

---

### F11 — Configurações da Plataforma

**Objetivo.** Manter os parâmetros operacionais do fluxo como configuração administrável, nunca como constante de código.

Área administrativa dividida em três painéis:

| Painel | Parâmetros |
|---|---|
| **Nomenclatura** | Padrão de nome do arquivo exportado, com placeholders `{SIGLA_UNIDADE}` e `{DATA_ISO}`. Padrão de fábrica: `Relatório Operacional de Tecnologia da Informação - {SIGLA_UNIDADE} - {DATA_ISO}` |
| **SLA** | Dia útil limite de elaboração (padrão 6), de revisão (padrão 8), de aprovação (padrão 10), dias úteis de extensão por reprova (padrão 2) e inclusão de Carnaval e Corpus Christi no cálculo de dias úteis (desligada por padrão, F3) |
| **Pontuação** | Deflator em pontos por etapa atrasada (padrão 2,00) |
| **Retenção de evidências** | Janela de retenção WORM em anos, aplicada a cada arquivo no ato da gravação (padrão de fábrica 10). O valor **`-1` significa retenção ilimitada** |

Persistidos em `SystemSetting`, tabela singleton. Endpoints: `GET`/`PATCH /admin/platform-settings`.

**A retenção não se comporta como os demais parâmetros.** Alterar o padrão de nomenclatura ou o dia útil de SLA muda o comportamento da plataforma dali em diante e nada mais. Alterar a janela de retenção **não alcança o acervo já gravado**: cada arquivo conserva a janela que recebeu no `PutObject`, e sob modo Compliance essa data só admite extensão, jamais redução (F16.3). A tela deixa isso explícito no ponto de edição — reduzir o valor não libera nada do que já está sob custódia.

#### Retenção ilimitada — sentinela `-1`

O campo aceita um valor especial: **`-1` define retenção ilimitada**, aplicada a partir da gravação seguinte.

**Por que `-1` e não `0`.** A escolha da sentinela é decidida pelo modo de falhar, não por estética. `0` é uma duração de aparência legítima: se algum caminho de código deixar de tratá-la como sentinela, `retainUntilDate` resolve para o instante da gravação e o objeto nasce **sem proteção alguma** — falha silenciosa, na direção insegura, indistinguível de operação normal até o dia em que o arquivo é apagado. `-1` é impossível como duração: o mesmo esquecimento produz data no passado, que a API de *Object Lock* rejeita, e a gravação falha de imediato. Entre falhar aberto em silêncio e falhar fechado com ruído, a sentinela correta é a que não consegue ser confundida com um prazo curto.

**Como se traduz no storage.** Não existe retenção infinita nativa em *Object Lock*. `-1` é materializado como `retainUntilDate` na data-limite máxima suportada (`9999-12-31`) — indistinguível de permanente para qualquer horizonte operacional.

**A opção é irreversível, e a interface precisa dizê-lo antes do clique.** Sob modo Compliance a data de retenção de um objeto só admite extensão. Gravar um arquivo sob `-1` significa que ele **jamais** será removível: não há reversão por configuração, por credencial administrativa, por conta raiz nem por suporte do provedor. Reverter o parâmetro para um valor finito afeta somente as gravações posteriores; o acervo escrito sob `-1` permanece permanente para sempre.

Requisitos de interface no campo de retenção:

- **Ícone `i` de informação adjacente ao campo**, acionável por clique e por foco de teclado, exibindo tooltip com o significado da sentinela, a irreversibilidade e o alcance da mudança (gravações futuras apenas);
- O texto da tooltip é **explícito quanto ao que não tem volta**, sem eufemismo: arquivos gravados sob retenção ilimitada não poderão ser excluídos por ninguém, em nenhuma hipótese;
- Selecionar `-1` exige **confirmação em diálogo dedicado**, distinta do salvamento comum dos demais parâmetros — a tooltip informa, o diálogo responsabiliza;
- A alteração é registrada na trilha de auditoria com autor, data e valores anterior e novo, como qualquer mudança em `SystemSetting`.

---

### F12 — Painel Central e Inteligência de Dados

**Objetivo.** Ser a tela inicial de qualquer perfil, respondendo "onde estamos" em um olhar.

#### Componentes

- **Histórico de relatórios** — passados e atuais, no escopo de unidades visíveis ao usuário;
- **Filtros avançados** — unidade, status do fluxo, período de referência (intervalo de/até);
- **Busca global** — por sigla ou nome da unidade;
- **Ordenação** — colunas ordenáveis por período e status;
- **Coluna de Nota** — nota final formatada sobre a escala `/ 10`, vazia enquanto o relatório não foi concluído;
- **Indicador de prazo** — `report-deadline` calcula e exibe a proximidade ou o estouro do prazo vigente da fase;
- **Gráfico de tendência de nota** (`ScoreTrendChart`) — sparkline SVG nativo, sem biblioteca de charts, com área preenchida, marcação de pontos e cor semântica: verde em tendência de alta, vermelho em queda; períodos sem nota são tratados como lacuna, não como zero;
- **Exportação rápida** por linha (ver F13).

---

### F13 — Motor de Exportação de Conformidade

**Objetivo.** Gerar o artefato de conformidade que espelha o relatório com seu veredito.

#### Formatos

Três formatos obrigatórios, todos disponíveis para qualquer relatório dentro do escopo do usuário:

| Formato | Content-Type | Destino de uso |
|---|---|---|
| **PDF** | `application/pdf` | Via de apresentação — leitura humana, impressão, entrega a auditor |
| **CSV** | `text/csv` | Consumo tabular e reprocessamento em planilha |
| **JSON** | `application/json` | Integração e recomputação programática |

#### Conteúdo

O arquivo espelha o relatório mantendo, por indicador, as flags de status de validação (`Aprovado`, `Reprovado`, `Pendente de validação`, `Em revisão`), valores informados, resultado calculado, meta e conformidade.

#### Requisitos do PDF

- Rodapé com o **veredito final** do relatório;
- **Assinatura eletrônica do Aprovador** responsável: nome, cargo e unidade;
- **Selo de integridade com QR code e código de verificação** no rodapé (F18);
- Identidade visual institucional AGIR/GCINFRA aplicada ao layout do documento.

#### Nomenclatura

Resolvida por `naming-pattern.util` a partir do padrão configurado em `SystemSetting`, com substituição de `{SIGLA_UNIDADE}` e `{DATA_ISO}`.

**Endpoint:** `GET /report-instances/:id/export?format=pdf|csv|json` — os três formatos são obrigatórios e compartilham a mesma serialização canônica (F18.1).

---

### F14 — Mensageria Transacional

**Objetivo.** Notificar stakeholders sobre transições de fluxo e estouro de prazo, sem que a falha de e-mail derrube uma transação de negócio.

#### Gatilhos

| Evento | Destinatários |
|---|---|
| Relatório disponível para revisão | Revisores da unidade |
| Relatório pendente de aprovação | Aprovadores (escopo organizacional) |
| Relatório reprovado pela Matriz | Elaboradores e Revisores da unidade |
| Relatório aprovado / concluído | Elaboradores e Revisores da unidade |
| Estouro de SLA | Responsáveis da fase corrente da unidade |

#### Características

- Transporte SMTP via `nodemailer`; sem configuração de SMTP, o serviço opera em **modo log** (registra o e-mail que teria sido enviado) — permitindo desenvolvimento e homologação sem servidor de e-mail;
- Assuntos padronizados com prefixo `[FormOps]`, sigla da unidade e período de referência;
- **Sanitização de cabeçalho:** siglas vêm de texto livre cadastrado por administrador, então quebras de linha são removidas do assunto — defesa em profundidade contra CRLF/header injection;
- **Isolamento de falha:** todo disparo passa por um wrapper `safely(...)` que registra o erro e segue — a indisponibilidade do servidor de e-mail nunca reverte uma submissão ou aprovação já persistida;
- Resolução de destinatários por papel: `findUnitRoleEmails` (por unidade) e `findOrgWideRoleEmails` (organizacional).

---

### F15 — Trilha de Auditoria Contínua

**Objetivo.** Registro imutável e completo de quem alterou o quê, quando.

| Aspecto | Implementação |
|---|---|
| Mecanismo | **Trigger de banco de dados** (migração `add_audit_trigger`) — não depende de a aplicação lembrar de registrar |
| Contexto | Propagado por variáveis de sessão via `runWithAuditContext({ ... }, tx)` |
| Conteúdo | Especificado integralmente em **8-A.3**, fonte única do esquema de `audit.audit_log` — incluindo cargo do autor, IP de origem, canal e correlação de requisição |
| Cobertura | Alteração de valor de indicador, upload e desativação de evidência, mudança no Estado Residente, transições de status, alterações administrativas, escrita de coleta automática (11.2) |
| Imutabilidade | Não há operação de escrita ou exclusão de `AuditLog` exposta pela aplicação; a revogação de DML e a estratégia de índices constam em 8-A.3 e 8-B.1 |

---

### F16 — Segurança Aplicada

**Postura.** A plataforma custodia material usado como prova em auditoria externa. Isso desloca o objetivo da segurança: não basta impedir acesso indevido, é preciso proteger a **integridade probatória** — que o número exibido seja o que foi apurado, que o arquivo anexado seja o que foi enviado, e que nenhuma das duas coisas possa ser alterada sem deixar rastro, inclusive por quem detém credencial administrativa.

Os controles se organizam em três camadas: base, endurecimento de aplicação e endurecimento de infraestrutura.

---

#### F16.1 Controles de base

| Camada | Controle |
|---|---|
| Cabeçalhos HTTP | `helmet()` no bootstrap da API, complementado pela política de conteúdo do tier web (F16.2) |
| CORS | Restrito por `CORS_ORIGIN` (lista separada por vírgula), com **origem explícita obrigatória em todo ambiente** — requisição que carrega credencial de sessão é incompatível com origem curinga, o que elimina o modo aberto de desenvolvimento |
| Sessão | JWT transportado em cookie `HttpOnly`, com token anti-CSRF nas rotas de escrita (F16.2) |
| Validação de entrada | `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform` — propriedades não declaradas em DTO são rejeitadas |
| Rate limiting | `ThrottlerGuard` global (20 req/60s) + limite estrito no login |
| Senhas | `bcryptjs`, nunca em claro, nunca retornadas pela API |
| Upload | Lista fechada de mimetypes, limite de 10 MB e validação por assinatura binária (F16.2) |
| SQL | Prisma com queries parametrizadas |
| Transporte | HTTPS na borda (`ENABLE_HTTPS`, `SSL_KEY_PATH`, `SSL_CERT_PATH`) e TLS até o banco (F16.2) |
| Segredos | Exclusivamente em variáveis de ambiente; `.env.example` documenta o contrato sem valores reais |
| Riscos aceitos | Documentados e justificados em `apps/api/SECURITY-NOTES.md` e `apps/web/SECURITY-NOTES.md` — consultar antes de alterar envio de e-mail ou upload |

---

#### F16.2 Endurecimento de aplicação

##### Validação de anexos por conteúdo, não por declaração

O `Content-Type` de uma requisição HTTP é informado pelo cliente e, portanto, não é evidência de nada. A API **inspeciona os primeiros bytes do buffer** e só aceita o arquivo quando a assinatura binária corresponde a um dos tipos da lista fechada de F6 — impedindo que um executável ou webshell entre com rótulo de evidência.

A validação de tipo, sozinha, não basta:

- **Coerência entre extensão, mimetype declarado e assinatura real** — divergência entre os três é rejeição, não correção silenciosa;
- **Nome de arquivo gerado pelo servidor**, nunca o nome enviado pelo cliente — elimina travessia de caminho e colisão intencional;
- **`Content-Disposition: attachment` e `X-Content-Type-Options: nosniff`** na entrega, porque o formato PDF admite JavaScript embarcado: validar o tipo não neutraliza o conteúdo;
- **Origem distinta da aplicação** para servir evidência (F6), de modo que um arquivo malicioso jamais execute no `origin` do portal.

##### Token de sessão em cookie HttpOnly

O JWT deixa de residir em armazenamento acessível a script. O transporte passa a ser cookie com:

| Atributo | Valor | Razão |
|---|---|---|
| `HttpOnly` | sempre | Torna o token ilegível a JavaScript e invisível no DevTools — um XSS bem-sucedido deixa de significar roubo de sessão |
| `Secure` | em todo ambiente com TLS | Impede trânsito em claro |
| `SameSite` | `Lax` | Preserva a navegação a partir de link recebido por e-mail (F14), que `Strict` interromperia — o usuário chegaria à tela de login apesar de ter sessão válida |

**Contrapartida assumida e coberta.** Cookie enviado automaticamente pelo navegador reintroduz CSRF, vetor que o padrão Bearer não tinha. `SameSite=Lax` protege a maior parte dos casos, mas não é defesa suficiente isoladamente: toda rota de escrita exige adicionalmente **token anti-CSRF em esquema de submissão dupla**, validado no servidor. Para uma plataforma cuja finalidade é integridade probatória, a proteção é explícita, e não delegada a um atributo de cookie.

##### Superfície do build de produção

- **`sourcemap: false`** no build de produção, removendo o mapeamento para o TypeScript original;
- **Remoção de `console.log`, `console.debug`, `console.info` e `debugger`** na etapa de minificação, **preservando `console.error`** — o canal de erro tem valor diagnóstico em produção e sua supressão cega prejudica a investigação de incidentes;
- A remoção é responsabilidade do minificador já usado pelo empacotador, sem introduzir cadeia de ferramentas adicional apenas para esse fim.

**Limite explícito deste controle.** Retirar o *source map* reduz a superfície de leitura; não protege segredo algum. O bundle continua sendo código legível para quem se dispuser a lê-lo. A única proteção real contra vazamento de segredo pelo frontend é **não haver segredo no bundle** — o que a plataforma garante mantendo toda credencial no servidor.

##### DTOs de saída estritos

Toda resposta da API trafega por um **DTO de saída declarado**, com serialização que exclui por omissão qualquer campo não listado. A aba *Network* do navegador passa a exibir apenas o necessário à tela, sem identificadores internos, metadados de persistência ou colunas acessórias.

**Interação com o selo de integridade.** A serialização canônica de F18 é definida sobre um **contrato próprio e versionado**, jamais sobre o DTO de apresentação. Sem essa separação, uma mudança cosmética em um DTO alteraria o conjunto de campos canônicos e invalidaria silenciosamente todos os selos já emitidos — a exportação deixaria de conferir contra o próprio histórico.

##### Texto livre: íntegro na escrita, neutro na saída

Campos de redação livre — Análise Crítica, Plano de Ação, justificativas, pareceres — são **gravados exatamente como o usuário os digitou**, sem transformação.

**Por que não sanitizar antes de gravar.** O rastro de auditoria (8-A) existe para provar o que foi efetivamente registrado. Se o texto for alterado no caminho da escrita, o `audit_log` passa a guardar uma versão modificada e a plataforma perde a capacidade de demonstrar o conteúdo original — contradizendo o princípio append-only que sustenta toda a seção 8-A. Transformar o dado na entrada é destruir prova para evitar risco que se resolve na saída.

A neutralização ocorre em cada superfície de renderização:

| Superfície | Tratamento |
|---|---|
| Tela | O conteúdo é tratado como texto, nunca como marcação — nenhuma rota de renderização de HTML não confiável é admitida |
| PDF | Escape aplicado no ponto de composição do documento; se a geração usar pipeline baseado em HTML, esse é o limite onde a sanitização é obrigatória |
| CSV | **Prefixação defensiva** de células iniciadas por `=`, `+`, `-` ou `@` |
| JSON | Escape de acordo com a especificação do formato, sem interpretação |

**A injeção de fórmula em CSV é vetor de primeira ordem neste produto**, não uma nota de rodapé: a exportação é entregue a auditor externo, que a abre em planilha. Um campo de justificativa iniciado por `=` deixa de ser texto e passa a ser fórmula executada na máquina de quem recebeu o arquivo.

##### Criptografia em trânsito até o banco

A conexão do ORM com o PostgreSQL exige TLS. O **modo de verificação varia por ambiente e a distinção é deliberada**:

| Ambiente | Modo | Consequência |
|---|---|---|
| Produção | `verify-full`, com CA declarada | Cifra o tráfego **e** autentica o servidor |
| Desenvolvimento | `require` | Cifra o tráfego sem validar certificado — aceitável apenas em rede local de contêineres |

`require` isoladamente **não protege contra interceptação ativa**: cifra a sessão, mas aceita qualquer certificado apresentado, inclusive o de um interposto. Adotá-lo em produção daria garantia aparente sem garantia real.

##### Política de conteúdo e anti-clickjacking

A CSP nasce em **duas camadas distintas**, e a distinção é operacionalmente relevante:

- **Tier web** — emite a política junto ao HTML da SPA. É esta que restringe o que o navegador executa e é a única que protege o usuário na prática, já que respostas de API não são renderizadas como documento;
- **API** — emite cabeçalhos de proteção nas próprias respostas, cobrindo os casos em que uma resposta é aberta diretamente no navegador.

Diretrizes obrigatórias:

| Diretriz | Regra |
|---|---|
| `script-src` | Sem `unsafe-inline` e sem `unsafe-eval`; apenas bundles servidos pela própria origem |
| `connect-src` | Origem da API **e origem do object storage** — as URLs pré-assinadas de evidência (F6) vivem em host distinto, e uma política estreita demais quebra o download |
| `frame-ancestors` | `'none'` — o portal não é embutível, o que encerra o vetor de clickjacking |
| `object-src` | `'none'` |
| `style-src` | A postura quanto a estilo inline é declarada explicitamente na configuração, com uso de *nonce* quando o pipeline de build o permitir |

---

#### F16.3 Endurecimento de infraestrutura

Medidas que dependem de provisionamento, e não apenas de código.

##### Varredura antivírus de anexos

Toda evidência recebida é submetida a scanner de malware antes de ser considerada disponível. Como a varredura é assíncrona, ela **cria um estado intermediário que precisa existir no modelo**, e não ser tratado como detalhe de implementação:

| Estado | Significado | Efeito |
|---|---|---|
| `PENDENTE_VARREDURA` | Arquivo recebido, ainda não analisado | Visível ao autor; não conta como evidência válida |
| `LIMPO` | Varredura concluída sem detecção | Evidência plenamente disponível |
| `INFECTADO` | Detecção positiva | Arquivo bloqueado para download, retido para perícia, evento registrado na trilha de auditoria |

**Regra de submissão:** um relatório não avança de etapa enquanto possuir anexo em `PENDENTE_VARREDURA`. A alternativa — permitir o avanço e varrer depois — admitiria que um indicador fosse aprovado com base em evidência que a plataforma ainda não sabe se é legítima.

**Onde o arquivo repousa enquanto não está `LIMPO`.** A varredura assíncrona e o *Object Lock* em modo Compliance impõem uma consequência que não é opcional: **arquivo não varrido não entra no bucket imutável**. O upload aterrissa em área de quarentena sem *Object Lock*; apenas o veredito `LIMPO` promove o objeto ao bucket sob retenção. Sem essa separação, uma detecção positiva ficaria gravada por dez anos sem possibilidade de remoção — a plataforma passaria a hospedar, de forma irrevogável, exatamente aquilo que o scanner existe para barrar.

Consequência para o estado `INFECTADO`: o arquivo permanece na quarentena, bloqueado para download e preservado para perícia por prazo próprio, **não** pela janela de retenção das evidências. Perícia e guarda documental são finalidades distintas e não compartilham prazo.

##### Bloqueio dinâmico por origem

Banimento temporário após acúmulo de respostas `401`, `403` e `429` consecutivas, aplicado na borda.

**Restrição de desenho ditada pelo contexto de uso.** As unidades são hospitais, e o tráfego de cada uma sai por NAT sob um punhado de endereços públicos. Banimento puro por IP significa que **um usuário errando a senha derruba o acesso de toda a unidade**. Portanto:

- O bloqueio primário é **por conta**, não por endereço;
- O bloqueio por endereço atua como camada secundária, com limiar mais alto e janela curta;
- Endereços de saída conhecidos das unidades são declarados em lista de exceção, sujeitos apenas ao limite por conta;
- Todo bloqueio é evento auditável, com desbloqueio administrativo rastreável.

##### Imutabilidade do storage contra ransomware

Políticas de *Object Lock* (WORM) sobre o bucket de evidências, em **modo Compliance**, de modo que arquivo gravado não possa ser sobrescrito nem removido durante a retenção — **nem pela conta raiz**, que é precisamente o cenário de um ataque de ransomware bem-sucedido.

**Por que Compliance e não Governance.** O modo Governance preserva uma válvula de escape: um principal portador de `s3:BypassGovernanceRetention` remove o objeto durante a janela. Essa válvula existe para atender obrigação legal de eliminação — e é dispensável aqui. O acervo sob WORM é composto de evidência operacional de TI da própria AGIR: prints de console, inventários de ativos, comprovantes de configuração. Não é base de dados pessoais de terceiros, e não há pedido de expurgo previsível sobre ele. Sem obrigação a atender, a válvula deixa de ser garantia e passa a ser apenas superfície de ataque adicional — justamente a superfície que um invasor com credencial privilegiada procura. Compliance a elimina.

Compliance é também o único modo que sustenta o princípio 1.2 sem ressalva: com o bypass disponível, *"nada se perde"* seria promessa condicionada à disciplina de quem detém a credencial.

**A contrapartida é assumida com clareza.** Objeto gravado por engano permanece gravado até o vencimento: Compliance não perdoa upload equivocado, arquivo trocado nem anexo enviado na unidade errada. É isso que faz da validação de conteúdo (F16.2) e da coerência do vínculo (F6) requisitos de **gravação**, não de revisão posterior — o momento de barrar o arquivo é antes do `PutObject`, porque depois não existe outro momento.

Três condições que a implantação não pode descobrir tarde:

- **Versionamento é pré-requisito de criação do bucket.** *Object Lock* não é habilitável retroativamente em bucket existente; a decisão pertence ao provisionamento, não a uma migração posterior;
- **O prazo é parâmetro de plataforma, não constante de arquitetura.** A janela de retenção reside em `SystemSetting` (F11), com padrão de fábrica de **10 anos** — horizonte compatível com o ciclo prescricional de fiscalização de contratos de gestão em saúde pública, que corre entre cinco e dez anos. Ampliá-la conforme o acervo histórico se acumula é decisão da GCINFRA em tela de configuração, nunca alteração de software. O parâmetro admite a sentinela **`-1` para retenção ilimitada**, materializada como `retainUntilDate` na data-limite máxima do *Object Lock*; a opção é irreversível para todo arquivo gravado sob ela e a interface a cerca de aviso e confirmação própria (F11);
- **A retenção é carimbada no objeto, no ato da gravação.** Cada arquivo herda a janela vigente no momento do `PutObject` e a carrega consigo; mudar o parâmetro afeta gravações futuras, jamais o acervo já escrito. E, sob Compliance, a data de retenção de um objeto **pode ser estendida, nunca reduzida** — o padrão de fábrica é, portanto, um piso irreversível: dez anos podem virar quinze mais tarde, mas nunca virar cinco para o que já foi gravado.

##### Backups isolados e cifra em repouso

- Rotina de backup do PostgreSQL replicada para repositório **isolado, em modo somente-escrita** a partir da origem — a credencial que grava o backup não consegue apagá-lo, o que sobrevive ao comprometimento do nó primário;
- **Cifra em repouso** de disco e volumes, com chaves sob gestão de serviço dedicado;
- **Teste de restauração periódico e registrado**: backup nunca verificado não é backup, é suposição.

##### Custódia da chave de assinatura do selo

O selo de integridade (F18) assina com chave privada Ed25519, e **toda a alegação de não-repúdio da plataforma repousa sobre a custódia dessa chave**. Chave de assinatura mantida junto às demais variáveis de ambiente reduz o selo a um carimbo: quem lê a configuração do servidor emite selo válido para qualquer conteúdo, e a verificação pública passa a atestar uma falsificação com a mesma confiança com que atestaria o original.

Requisitos de custódia:

- A chave privada reside em **serviço de gestão de chaves ou módulo de hardware**, com a assinatura executada pelo serviço — a aplicação solicita a assinatura, jamais manipula o material da chave;
- Onde esse serviço não estiver disponível, a chave vive em arquivo de permissão restrita, **fora do `.env` e fora do versionamento**, com acesso registrado;
- **Rotação programada**, apoiada no `keyId` já previsto em F18, que preserva a validade dos selos emitidos sob chaves anteriores;
- A chave pública correspondente a cada `keyId` permanece publicada e versionada, sustentando a verificação offline.

---

### F17 — Área de Auditoria e Rastreabilidade

**Objetivo.** Transformar o acervo de relatórios em uma base consultável de auditoria — respondendo, para qualquer recorte de unidade, período e indicador, não apenas *qual foi o resultado*, mas *quem produziu, quem alterou, quem validou e quando*.

Esta funcionalidade sustenta o propósito da plataforma para além do armazenamento de indicadores: **visibilidade, rastreabilidade, validade, confiabilidade e integridade**. Os relatórios são usados como insumo em processos de auditoria, e a área precisa ser defensável perante um auditor externo — o que significa que ela nunca pode preencher lacunas por conta própria nem apresentar um número que o sistema não apurou.

**Acesso.** Aberta a todas as roles, sempre limitada ao escopo de unidades que o usuário já enxerga (F2): Aprovador e Administrador com alcance organizacional; Elaborador e Revisor restritos à própria unidade; Observador às unidades concedidas. Nenhuma regra de acesso nova é introduzida.

---

#### F17.1 Eixos de consulta

Três granularidades, combináveis livremente:

| Eixo | Pergunta que responde |
|---|---|
| **Unidade** | Como esta unidade se comportou ao longo do tempo? |
| **Relatório** | O que aconteceu dentro deste período específico? |
| **Indicador** | Como esta métrica evoluiu, em uma ou em várias unidades? |

**Consulta canônica de referência:** *"período de X a Y, todas as unidades, indicador de quantitativo de servidores"* → a plataforma retorna a série histórica daquele indicador, unidade a unidade, mês a mês, dentro do intervalo, com a telemetria correspondente ao modo de visualização escolhido.

---

#### F17.2 Sistema de filtros

| Filtro | Cardinalidade | Observações |
|---|---|---|
| Período / data de referência | Intervalo (de/até) ou mês único | Sobre o `referenceMonth` do relatório |
| Unidade | Uma ou várias | Sempre interseccionado com o escopo do usuário |
| Nível de relatório | Um ou vários | Formulário vigente da unidade no período |
| Indicador | Um ou vários | Resolvido pelo catálogo canônico (F17.7) |
| Status do relatório | Um ou vários | `PENDENTE`, `EM_REVISAO`, `PENDENTE_APROVACAO`, `CONCLUIDO` |
| Conformidade | Conforme / não conforme / ambos | Sobre `isCompliant` |
| Veredito de validação | Aprovado / reprovado / pendente de validação / em revisão | |
| Pontualidade | No prazo / atrasado | Por etapa (elaboração, revisão) |
| Faixa de nota | Intervalo numérico | Sobre `totalScore` do relatório |
| Autor da ação | Um ou vários usuários | Exclusivo do modo detalhado |
| Tipo de evento | Edição de valor, upload de evidência, veredito, transição de status, clone de estado residente | Exclusivo do modo detalhado |

##### Filtros encadeados e reativos

A seleção é **dependente e reativa**: ao escolher uma unidade ou um nível, o seletor de indicadores passa a listar **apenas as métricas elegíveis** para a seleção corrente. Isso impede, já na interface, que o usuário monte uma combinação impossível — o filtro não oferece um indicador exclusivo de N3 quando a seleção contém apenas unidades N1.

Cada seletor de lista extensa (unidades, indicadores, usuários) possui **campo de busca interno com autocomplete**. Sua função é exclusivamente **localizar o item dentro da lista de seleção** — ele não altera, amplia nem reinterpreta a consulta submetida ao banco.

---

#### F17.3 Modos de visualização

##### Básico — o resultado

Responde "o que foi apurado". Colunas típicas:

| Unidade | Nível | Período | Indicador | Valor apurado | Meta | Conformidade | Veredito | Nota do relatório |
|---|---|---|---|---|---|---|---|---|

##### Detalhado — o resultado e toda a sua construção

Responde "o que foi apurado, por quem, a partir de quê, e o que mudou no caminho". Acrescenta ao modo básico:

| Dimensão | Conteúdo |
|---|---|
| **Composição do valor** | Cada variável de entrada (`variableKeys`) com seu valor informado, a expressão da fórmula em snapshot, o operador e a meta vigentes à época |
| **Autoria e cronologia** | Quem informou cada valor e quando; quem editou, o valor anterior, o valor novo e o timestamp de cada alteração |
| **Evidências** | Arquivos anexados, quem enviou, quando, e as evidências de contraprova da Matriz |
| **Validação** | Veredito por indicador, autor, justificativa técnico-operacional integral e data |
| **Ciclo de vida** | Cada transição de status do relatório com autor e timestamp; submissões, reprovas e extensões de prazo concedidas |
| **Herança** | Se o valor foi clonado do Estado Residente (`isClonedFromResident`) e se chegou a ser conferido no período |
| **Pontualidade** | Datas de submissão contra os prazos vigentes, e o deflator de SLA aplicado |

A fonte da telemetria é a trilha de auditoria (F15), que já registra autor, valor anterior, valor novo e timestamp em nível de banco. A área de auditoria é a **superfície de leitura** dessa trilha — não uma segunda fonte de verdade.

---

#### F17.4 Semântica de ausência de dado — `N/A` nunca é `0`

Esta é a regra mais importante da funcionalidade. A plataforma distingue rigorosamente cinco situações que um sistema ingênuo colapsaria em "zero" ou em célula vazia:

| Representação | Significado exato | Quando ocorre |
|---|---|---|
| `12`, `98,4` … | Indicador medido; este é o resultado apurado | Preenchimento normal |
| `0` | Indicador **medido**; a contagem apurada foi zero | Ex.: nenhuma ocorrência de malware no mês |
| `N/A — fora do nível` | A unidade **não possuía** este indicador no formulário vigente naquele período | Transição de nível, indicador exclusivo de outro nível |
| `N/A — indicador inativo no período` | O indicador não existia ou estava inativo na estrutura vigente à época | Indicador criado ou aposentado na Engine No-Code |
| `Não preenchido` | Indicador **aplicável**, mas o responsável não informou valor | Relatório incompleto ou em andamento |

##### Justificativa de auditoria

Em uma auditoria, `0` **afirma** que a métrica foi apurada e o resultado foi zero. `N/A` **afirma** que a unidade não tinha obrigação nem formulário para coletar aquela métrica no período consultado. São declarações diferentes, com consequências diferentes. Confundi-las falsifica o histórico e compromete a defensabilidade do acervo inteiro.

##### Regras duras

- O sistema **nunca** substitui ausência por `0`;
- O sistema **nunca** quebra a consulta nem estoura erro por ausência de dado;
- Toda tabela e toda exportação carrega **legenda explícita** dos códigos de ausência;
- Valores `N/A` são **excluídos do denominador** de qualquer agregação, e o denominador efetivo é sempre reportado junto do resultado (ver F17.9).

##### Como a aplicabilidade é determinada

A decisão entre "aplicável" e "fora do nível" **não** consulta o formulário que a unidade tem hoje. Ela é derivada do que a unidade de fato tinha a preencher naquele mês: o `ReportInstance.formTemplateId` daquele período e o conjunto de `IndicatorResponse` que a instância materializou — cada um já carregando o snapshot da definição vigente à época (2.2).

Isso resolve corretamente o caso de uma unidade que transitou de nível no meio do intervalo consultado: os meses anteriores à transição reportam `N/A — fora do nível` para os indicadores exclusivos do nível novo, e os meses posteriores reportam valores.

---

#### F17.5 Resultado vazio real

Quando a combinação de filtros é válida e o banco não retorna nenhum registro, a plataforma exibe, de forma explícita e transparente:

> **Nenhum histórico ou telemetria encontrada para a combinação de filtros selecionada.**

- O sistema **não altera** a busca do usuário por conta própria — não amplia período, não remove unidade, não afrouxa recorte de nível;
- O sistema **não sugere** combinações alternativas nem aponta outras unidades que teriam dados;
- O comportamento é **100% previsível, seco e auditável**: o resultado é exatamente o que foi pedido, sempre.

Um relaxamento automático de filtro produziria um conjunto de dados que ninguém solicitou, apresentado como se tivesse sido solicitado — inaceitável em um artefato destinado a auditoria.

---

#### F17.6 Agregação multi-unidade e multi-nível (matriz esparsa)

Quando o usuário seleciona múltiplas unidades de níveis diferentes em uma mesma consulta consolidada, o conjunto de indicadores elegíveis não é uniforme entre as linhas — a consulta produz uma **matriz esparsa**.

**Exemplo.** Seleção: `HOSP-A` (N3), `HOSP-B` (N2), `HOSP-E` (N1), período 07/2026.

| Unidade | Nível | Indicador comum aos três níveis | Indicador ausente em N1 |
|---|---|---|---|
| HOSP-A | N3 | 98,7 | 12 |
| HOSP-B | N2 | 97,2 | 9 |
| HOSP-E | N1 | 99,1 | `N/A — fora do nível` |

A esparsidade decorre do conjunto de indicadores de cada formulário, não do rótulo do nível. Enquanto N2 replicar a definição de N3 (9.1), as duas colunas coincidem; quando divergirem, a mesma consulta passa a produzir `N/A` entre elas sem qualquer ajuste — é o comportamento normal do JOIN, não um caso especial.

**Requisitos:**

- A consulta ao banco executa um **JOIN seguro** que trata a matriz esparsa — a plataforma não trava, não degrada e não estoura erro de query com qualquer combinação de níveis;
- O conjunto de colunas resulta da **união** dos indicadores elegíveis das unidades selecionadas;
- Toda célula sem correspondência é preenchida conforme F17.4, jamais com `0` ou vazio silencioso;
- A legenda de ausência acompanha a tabela na tela e no arquivo exportado.

---

#### F17.7 Catálogo canônico de indicadores

**O problema que resolve.** Um `FormIndicator` pertence a um `FormTemplate` específico: "quantitativo de servidores" em N1 e em N3 são definições distintas, cada uma com seu próprio identificador. Sem um vínculo estável entre elas, a pergunta "este indicador, em todas as unidades" é irrespondível quando as unidades usam formulários diferentes — que é exatamente o caso de uso central da área de auditoria.

**A estrutura:** um catálogo canônico de indicadores, transversal aos formulários.

```
IndicatorCatalog
   ├── code          identificador canônico estável (ex.: "SRV_QTD_FISICOS")
   ├── name          nome de exibição na área de auditoria
   ├── description
   ├── unit          unidade de medida (%, contagem, minutos, booleano)
   └── isActive

FormIndicator
   └── catalogCode → IndicatorCatalog.code   (obrigatório)
```

**O vínculo é obrigatório.** Um indicador sem código canônico é invisível para toda consulta multi-unidade e impossibilita a resolução da regra de aplicabilidade (`N/A — fora do nível`, F17.4) — o sistema não teria como saber se a métrica ausente em N1 é a mesma que existe em N3. Permitir o vínculo opcional criaria um acervo parcialmente inauditável, exatamente na dimensão que a área de auditoria existe para cobrir.

Consequências operacionais:

- A Engine No-Code (F9) exige o código canônico no cadastro do indicador, ofertando a criação de uma entrada nova no catálogo quando nenhuma existente servir;
- Indicadores preexistentes sem vínculo são tratados como **pendência de catalogação** e sinalizados ao Administrador, no mesmo regime do balanceamento de pesos;
- O código canônico é gravado no snapshot de `IndicatorResponse`, preservando a correlação histórica mesmo que o vínculo mude depois;
- Indicadores com unidades de medida incompatíveis **nunca** são agregados entre si.

---

#### F17.8 Ordenação e colunas configuráveis

- **Ordenação por qualquer coluna do conjunto declarado de colunas ordenáveis**, ascendente ou descendente, com critério de desempate estável e explícito (unidade → período → ordem do indicador), para que duas execuções da mesma consulta produzam sempre a mesma sequência. O conjunto ordenável é aquele coberto por índice, condição da paginação por cursor (8-B.1);
- **Exibir ou ocultar colunas em tempo de execução**, sem refazer a consulta e sem alterar o conjunto filtrado;
- Ordenação e visibilidade de colunas são **apresentação**, nunca filtro — ocultar uma coluna não remove linhas nem altera nenhuma agregação;
- A preferência de colunas é persistida por usuário;
- A exportação (F17.11) respeita as colunas visíveis e a ordenação corrente, e **registra ambas no cabeçalho do arquivo**, para que o artefato seja reproduzível.

---

#### F17.9 Inteligência de dados

A camada analítica é **determinística e reproduzível** — condição para que um auditor recomponha qualquer número apresentado a partir dos dados brutos exportados.

**Agregações disponíveis por recorte:**

| Métrica | Observação |
|---|---|
| `n` efetivo | Quantidade de observações válidas — sempre exibido junto de qualquer média |
| Média, mediana, mínimo, máximo, desvio-padrão | Sobre observações válidas |
| Taxa de conformidade | Conformes ÷ `n` efetivo |
| Variação período a período | Absoluta e percentual |
| Tendência | Direção e inclinação da série |
| Comparativo entre unidades | Mesma métrica, mesmo período, unidades lado a lado |
| Ranking | Por nota final ou por conformidade, com critério declarado |

**Sinalização de outliers.** Valores atípicos são marcados por regra estatística explícita e declarada na interface (ex.: desvio superior a 2 σ, ou fora do intervalo interquartil). A marcação é **sinalização para inspeção humana, nunca veredito** — não altera conformidade, nota ou status.

**Regras invioláveis da camada analítica:**

1. Toda métrica derivada exibe o **denominador efetivo** que a produziu;
2. **Nenhuma inferência substitui dado ausente** — sem imputação, sem interpolação, sem repetição do último valor conhecido;
3. `N/A` e `Não preenchido` ficam fora do denominador, e a diferença entre `n` efetivo e o total de células é sempre visível;
4. Toda agregação é recomputável a partir do CSV/JSON exportado da mesma consulta.

---

#### F17.10 Volume e desempenho

- Paginação server-side **por cursor**, com contagem aproximada ou teto — contagem exata apenas em recortes abaixo de um limite configurável (8-B.1); nenhuma consulta retorna conjunto ilimitado;
- Limite máximo de amplitude de intervalo por consulta, configurável em `SystemSetting`;
- Índices dedicados sobre `(unitId, referenceMonth)`, `(reportInstanceId, formIndicatorId)`, `catalogCode` e `AuditLog(tableName, recordId, changedAt)`, somados aos índices JSONB da trilha de auditoria (8-B.1);
- Consulta sempre sobre **dado vivo**: a Área de Auditoria não é servida por view materializada (8-B.3);
- O modo detalhado, por percorrer a trilha de auditoria, opera sob limites mais estritos que o básico — declarados ao usuário antes da execução.

---

#### F17.11 Exportação da consulta de auditoria

Formatos obrigatórios: **PDF**, **CSV** e **JSON**.

Todo arquivo exportado carrega, em cabeçalho ou bloco de metadados:

| Campo | Conteúdo |
|---|---|
| Filtros aplicados | Enumeração integral, incluindo os que não retornaram dados |
| Modo de visualização | Básico ou detalhado |
| Colunas e ordenação | Exatamente as vigentes na tela no momento da exportação |
| Escopo do usuário | Unidades que o solicitante podia enxergar |
| Legenda de ausência | Significado de `0`, `N/A` e `Não preenchido` |
| Autoria da extração | Usuário, matrícula, role e timestamp |
| `n` efetivo por agregação | Quando houver bloco analítico |

**Toda exportação recebe selo de integridade (F18)** — inclusive as parciais e as que retornaram conjunto vazio.

---

### F18 — Selo de Integridade e Verificação Pública de Exportações

**Objetivo.** Permitir que qualquer terceiro — inclusive um auditor externo, de posse apenas de uma via impressa — comprove que um documento emitido pela plataforma é **autêntico** (foi mesmo gerado pelo FormOps) e **inalterado** (seu conteúdo não sofreu edição após a emissão).

O modelo é o mesmo princípio empregado em documentos fiscais eletrônicos: o documento carrega um código de verificação e um QR code que remetem a uma prova criptográfica registrada na origem.

---

#### F18.1 Pipeline de selagem

```
CONTEÚDO EXPORTADO
   │
   ▼ serialização canônica (ordem fixa de campos, normalização de números,
   │                        datas em ISO-8601 UTC, encoding UTF-8)
SHA-256 ──► digest
   │
   ▼ assinatura Ed25519 (chave privada do servidor)
   │
   ├─► persistido em ExportSeal (banco)
   └─► estampado no documento:
         QR  ─► https://<host>/verificar/AGIR-2026-08-A7F3-9K2M
         código legível ─► AGIR-2026-08-A7F3-9K2M
```

| Etapa | Detalhe |
|---|---|
| **1. Serialização canônica** | Ordem fixa de campos, normalização de casas decimais, datas em ISO-8601 UTC, encoding UTF-8. O mesmo conteúdo lógico produz sempre a mesma sequência de bytes — independentemente de o arquivo sair em PDF, CSV ou JSON |
| **2. Digest** | SHA-256 sobre a serialização canônica |
| **3. Assinatura** | Ed25519 com a chave privada do servidor, sobre digest + metadados + timestamp de emissão |
| **4. Código de verificação** | Identificador curto, legível por humano, **não sequencial** e não adivinhável |
| **5. Persistência** | Registro em `ExportSeal`, imutável |
| **6. Estampagem** | QR code + código legível impressos no rodapé do PDF e presentes no cabeçalho de metadados do CSV/JSON |

**Por que canonizar antes de gerar o hash.** Sem serialização canônica, o mesmo relatório exportado em PDF e em CSV produziria digests diferentes, e o selo passaria a validar o arquivo em vez do conteúdo. Canonizando, o selo atesta **o dado**, e as três saídas de um mesmo recorte compartilham a mesma prova.

##### Digest duplo — o dado e o artefato

Assinar apenas o conteúdo canônico deixa uma brecha: alguém poderia editar visualmente o PDF — trocar um número impresso, alterar um rótulo — e o selo continuaria válido, porque o dado de origem não mudou.

Por isso o selo carrega **dois digests**:

| Digest | Sobre o quê | O que detecta |
|---|---|---|
| `contentDigest` | Serialização canônica do dado | Divergência entre o artefato e o acervo da plataforma |
| `artifactDigest` | Bytes do arquivo efetivamente entregue | Qualquer edição no PDF, CSV ou JSON após a emissão |

O `contentDigest` é compartilhado pelas três saídas do mesmo recorte; o `artifactDigest` é único por arquivo. O verificador confere ambos e distingue os casos: **conteúdo íntegro e arquivo íntegro**; **conteúdo íntegro, arquivo adulterado** (alguém editou a via); **conteúdo divergente** (o artefato não corresponde a nada emitido).

Na verificação a partir de uma via impressa — em que não há arquivo para conferir — o verificador exibe o `artifactDigest` registrado, permitindo ao auditor confrontá-lo com o do arquivo digital que recebeu.

---

#### F18.2 Conteúdo do selo

| Campo | Descrição |
|---|---|
| `verificationCode` | Código público de verificação, único |
| `contentDigest` | SHA-256 da serialização canônica do dado |
| `artifactDigest` | SHA-256 dos bytes do arquivo entregue |
| `signature` | Assinatura Ed25519 |
| `keyId` | Identificador da chave que assinou — viabiliza rotação sem invalidar selos antigos |
| `algorithm` | Ex.: `SHA-256 + Ed25519` |
| `documentType` | Relatório concluído ou extração de auditoria |
| `scopeSummary` | Unidade(s), período, e — para extrações — o conjunto de filtros aplicados |
| `issuedAt` | Timestamp de emissão |
| `issuedByUserId` | Autor da exportação |
| `revokedAt`, `revocationReason` | Nulos por padrão; preenchidos apenas em revogação (F18.5) |

`ExportSeal` é **imutável**: não há operação de edição ou exclusão exposta pela aplicação. A revogação é um registro adicional, não uma alteração do selo.

---

#### F18.3 Verificação

**Online** — o verificador recebe o código, localiza o `ExportSeal`, recompõe a serialização canônica a partir dos dados persistidos, recalcula o digest e compara. Detecta tanto adulteração do arquivo quanto divergência em relação à origem.

**Offline** — o payload assinado e a chave pública correspondente ao `keyId` permitem conferir a assinatura sem nenhuma consulta à plataforma. A chave pública é publicada em endpoint estável e versionado. Isso preserva a verificabilidade mesmo em cenário de indisponibilidade da plataforma ou de auditoria feita fora da rede da organização.

---

#### F18.4 Verificador público

Rota `/verificar/:codigo`, **sem autenticação** — é o caso de uso principal: o auditor externo recebe o PDF, escaneia o QR e confirma autenticidade sem depender de credencial.

```
┌──────────────────────────────────────┐
│  ✅ DOCUMENTO ÍNTEGRO                 │
│                                      │
│  Unidade ......... HOSPITAL XYZ      │
│  Período ......... 07/2026           │
│  Status .......... Concluído         │
│  Aprovado por .... Nome (Cargo)      │
│  Emitido em ...... 12/08/2026 14:32  │
│  Digest .......... a7f3…9k2m         │
│                                      │
│  Conteúdo do relatório não exibido.  │
└──────────────────────────────────────┘
```

**Exibe:** veredito de integridade, unidade, período de referência, status do relatório, nome e cargo do Aprovador responsável, data de emissão, tipo de documento e o digest.

**Não exibe:** valores de indicadores, análises críticas, planos de ação, evidências ou qualquer dado operacional. A prova de integridade não exige revelar o conteúdo — e não revelá-lo permite que o QR circule livremente em vias impressas sem expor dados da AGIR.

**Vereditos possíveis:** `Íntegro`, `Adulterado — digest não confere`, `Selo revogado` (com motivo e data), `Código não encontrado`.

**Proteções:** código não sequencial e não enumerável; rate limiting específico na rota pública; nenhuma resposta que permita distinguir "código inexistente" de "código malformado" por tempo de resposta.

---

#### F18.5 Gestão de chaves e revogação

- Chave privada exclusivamente em variável de ambiente ou serviço gerenciado de segredos — **nunca no repositório**, nunca em backup de banco;
- `keyId` gravado em cada selo, permitindo **rotação** de chave sem invalidar selos já emitidos;
- Chave pública publicada em endpoint estável, com histórico de chaves anteriores para verificação de documentos antigos;
- **Revogação** de selo disponível ao Administrador, exigindo motivo registrado. Um selo revogado passa a responder `Selo revogado` no verificador, com data e justificativa — o registro original nunca é apagado.

---

#### F18.6 Escopo de aplicação

| Artefato | Formatos | Selo |
|---|---|---|
| Relatório concluído (F13) | PDF, CSV, JSON | Obrigatório |
| Extração da área de auditoria (F17.11) | PDF, CSV, JSON | Obrigatório |

O selo é emitido no momento da exportação e vale para aquele recorte específico de conteúdo.

---

#### F18.7 Limites declarados do selo

Declaração deliberada, para que o alcance da garantia não seja superestimado em uma auditoria:

- O selo prova **integridade e origem do arquivo** — que aquele conteúdo saiu do FormOps e não foi alterado depois;
- O selo **não atesta a veracidade do dado informado pela unidade**. Essa garantia vem de outro lugar: da contraprova indicador a indicador feita pela Matriz (F7) e da trilha de auditoria imutável que registra quem informou o quê e quando (F15);
- Um documento íntegro cujo indicador foi **reprovado** na validação continua íntegro — e o selo, corretamente, o afirma sem contradizer o veredito impresso no próprio documento.

---

### F19 — Camada de Consumo Analítico (ELT / Tableau)

**Objetivo.** Expor o acervo consolidado para análise corporativa no Tableau, sem que a ferramenta de BI leia diretamente as tabelas operacionais da plataforma.

#### F19.1 Camada de staging

Relatórios em status `CONCLUIDO` são projetados em uma camada de staging estável, desenhada para leitura analítica e desacoplada do schema transacional — de modo que evoluções internas do modelo não quebrem dashboards.

A modelagem em estrela dessa camada — objetos de fato, dimensões e o grão declarado de cada um — está especificada em **8-A.6**, fonte única desse desenho.

#### F19.2 Regras da camada

As **regras invioláveis da camada analítica** estão declaradas em **8-A.6** e valem integralmente aqui: somente `CONCLUIDO`, semântica de ausência preservada, metas e pesos vindos do snapshot, nota congelada, somente leitura e ausência de lógica de negócio nova.

Requisito próprio desta camada:

- **Atualização incremental**, com marcação de última carga e capacidade de recarga completa.

---

## 5. Identidade Visual e Design System

> A identidade visual do FormOps é **institucional e fixa**, derivada da marca AGIR. Ela é declarada em uma **fonte única de verdade** (`apps/web/src/config/brand.ts`), da qual `tailwind.config.ts` importa a paleta diretamente. Nenhum componente contém valores hexadecimais soltos e nenhuma página contém string literal com nome de organização, departamento ou sistema — tudo é importado dessa configuração.

### 5.1 Conceito de design

O produto é uma **mesa de trabalho técnica**, não um painel de marketing. As decisões visuais seguem três diretrizes:

1. **Densidade informacional confiável** — tabelas e números têm precedência sobre ornamento; nada de gradientes decorativos genéricos.
2. **Hierarquia por peso e escala, não por família tipográfica** — uma única família de texto, diferenciada por peso e tamanho.
3. **Azul institucional como cor de comando** — reservado a ações, links e navegação ativa, jamais reaproveitado como cor de estado.

O motivo gráfico recorrente é a **grade de planta técnica** (`.blueprint-grid`) — linhas finas em malha de 28 px sobre superfície escura, evocando planta de infraestrutura. Usada no painel de login e em superfícies de destaque.

### 5.2 Paleta

#### Cor primária — azul institucional AGIR

| Token | Valor | Uso |
|---|---|---|
| `primary` / `accent` | `#00549a` | Botões primários, links, navegação ativa, anel de foco |
| `primaryHover` | `#00427a` | Estado hover |
| `primaryActive` | `#00335f` | Estado pressionado |
| `onPrimary` | `#ffffff` | Texto e ícone sobre a cor primária |

**Escala completa** (`accent-50` … `accent-900`):

| Passo | Hex | Passo | Hex |
|---|---|---|---|
| `50` | `#eff6fb` | `500` | `#1974a8` |
| `100` | `#dceaf5` | `600` | `#00549a` |
| `200` | `#b7d4ea` | `700` | `#00427a` |
| `300` | `#86b8d9` | `800` | `#00335f` |
| `400` | `#4a92c0` | `900` | `#062544` |

#### Superfícies claras — "paper"

| Token | Valor | Uso |
|---|---|---|
| `paper` | `#f7f9fc` | Fundo da aplicação |
| `paper-raised` | `#ffffff` | Cartões, painéis, linhas de tabela |
| `paper-sunken` | `#eef2f7` | Áreas recuadas, cabeçalhos de tabela, campos desabilitados |

#### Superfícies escuras — "console"

| Token | Valor | Uso |
|---|---|---|
| `console` | `#0b1522` | Barra lateral de navegação, metade esquerda do login |
| `console-raised` | `#142235` | Cartão de login, elementos elevados sobre fundo escuro |
| `console-border` | `#24374d` | Divisórias sobre superfície escura |

#### Texto — "ink"

| Token | Valor | Uso |
|---|---|---|
| `ink` | `#101826` | Texto principal, títulos |
| `ink-muted` | `#47566b` | Rótulos, texto secundário |
| `ink-faint` | `#6b7c92` | Texto terciário, placeholders, unidades de medida |

#### Bordas

| Token | Valor | Uso |
|---|---|---|
| `border` | `#e3e8ef` | Divisória padrão |
| `border-strong` | `#c7d0dc` | Divisória de ênfase, contorno de input |

#### Cores semânticas de estado

Mapeiam diretamente os status do workflow. **Não são reutilizadas em nenhum outro papel.**

| Status | Token | Valor | Rótulo na interface |
|---|---|---|---|
| Pendente | `status-pendente` | `#64748b` | "Pendente" |
| Em revisão | `status-revisao` | `#a16207` | "Em revisão" |
| Pendente de aprovação | `status-aprovacao` | `#6d28d9` | "Pendente de aprovação" |
| Concluído | `status-concluido` | `#15803d` | "Concluído" |
| Reprovado | `status-reprovado` | `#b91c1c` | "Reprovado" |

**Decisão de design registrada:** o roxo (`#6d28d9`) foi escolhido deliberadamente para "pendente de aprovação" — em vez de um segundo tom de azul — para que esse estado nunca se confunda com o azul primário de marca, que sinaliza ação clicável.

O status de validação por indicador reaproveita a mesma escala tonal: `Em revisão` → tom revisão; `Pendente de validação` → tom aprovação; `Aprovado` → tom concluído; `Reprovado` → tom reprovado.

#### Representação visual de ausência de dado (F17.4)

A distinção entre "medido e deu zero" e "não aplicável" precisa ser evidente antes da leitura do texto — em uma tabela densa de auditoria, o olho varre antes de ler.

| Caso | Tratamento visual |
|---|---|
| Valor apurado (inclusive `0`) | `ink` em `.data-figure`, alinhado à direita, tratado como qualquer outro número — **`0` nunca recebe estilo de ausência** |
| `N/A — fora do nível` | Fundo `paper-sunken`, texto `ink-faint` em itálico, alinhado ao centro; célula visualmente "desativada" |
| `N/A — indicador inativo no período` | Mesmo tratamento, diferenciado pelo texto e pela legenda |
| `Não preenchido` | Texto `ink-faint` sem fundo, com marcador discreto — sinaliza pendência, não inaplicabilidade |

Nenhum desses estados usa a paleta semântica de status (`status-*`), reservada ao workflow. A legenda dos códigos acompanha a tabela na tela e no arquivo exportado, nunca apenas como tooltip.

### 5.3 Tipografia

| Papel | Família | Pesos carregados | Aplicação |
|---|---|---|---|
| Texto e títulos | **Inter** | 400, 500, 600, 700 | Toda a interface — `font-sans` e `font-display` apontam para a mesma família |
| Números e dados | **JetBrains Mono** | 400, 500 | Valores de indicador, notas, métricas — via classe `.data-figure` com `tabular-nums` |

Ambas são servidas localmente por `@fontsource`, sem dependência de CDN externo.

**Decisão de design registrada:** `font-display` e `font-sans` apontam para a mesma família. A hierarquia vem de **peso** (`font-semibold` / `font-bold`) e de **escala de tamanho**, nunca de uma segunda família serifada — uma interface de leitura densa de dados ganha coerência com uma voz tipográfica só.

#### Escala de display

| Token | Tamanho | Line-height | Letter-spacing | Uso |
|---|---|---|---|---|
| `display-lg` | 3,25 rem | 1,04 | −0,015 em | Título do sistema no login |
| `display` | 2,25 rem | 1,08 | −0,010 em | Título de página |
| `display-sm` | 1,625 rem | 1,15 | −0,005 em | Título de seção, cabeçalho de modal |
| `display-xs` | 1,25 rem | 1,25 | 0 | Título de cartão |

Rótulos de contexto usam maiúsculas com `tracking` alargado (≈ 0,14 em) em tamanho 10 px — como no subtítulo da unidade na barra lateral.

### 5.4 Elevação e profundidade

Sombras construídas sobre o azul-escuro da tinta (`oklch(22% 0.03 255)`), não sobre preto puro — mantendo coerência cromática com a paleta fria.

| Token | Aplicação |
|---|---|
| `shadow-xs` | Separação sutil, chips |
| `shadow-panel` | Cartões e painéis em repouso |
| `shadow-raised` | Elementos elevados, hover de cartão |
| `shadow-floating` | Modais, cartão de login, popovers |

### 5.5 Raio de canto

| Token | Valor | Uso |
|---|---|---|
| `rounded-sm` | 0,25 rem | Itens de navegação, chips |
| `rounded` (padrão) | 0,375 rem | Botões, inputs |
| `rounded-lg` | 0,625 rem | Cartões |
| `rounded-xl` | 0,875 rem | Modais, painéis de destaque |

### 5.6 Movimento

Sistema de movimento discreto, orientado a confirmar mudança de estado — nunca a chamar atenção.

| Token | Valor | Uso |
|---|---|---|
| `duration-fast` | 150 ms | Micro-interações (hover de ícone) |
| `duration-normal` | 220 ms | Transições de cor, estados de navegação |
| `duration-slow` | 320 ms | Entrada de painéis e cartões |
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Curva única do sistema |

| Animação | Efeito | Uso |
|---|---|---|
| `rise-in` | Fade + translação vertical de 6 px | Entrada de cartões e páginas |
| `scale-in` | Fade + escala de 0,97 → 1 | Abertura de modais |
| `slide-in-right` | Fade + translação horizontal de 12 px | Painéis laterais, toasts |

Os tokens de duração e curva existem simultaneamente como custom properties CSS (`--duration-*`, `--ease-out-expo`) e como extensões do Tailwind, permitindo uso em CSS puro e em classes utilitárias a partir da mesma definição.

### 5.7 Iconografia

**Lucide React**, com `strokeWidth = 1.75` e tamanho padrão de 18 px na navegação. Ícones são sempre `aria-hidden` quando acompanhados de rótulo textual.

| Área | Ícone |
|---|---|
| Painel Central | `LayoutDashboard` |
| Elaboração e Revisão | `ClipboardList` |
| Mesa de Validação | `ShieldCheck` |
| Administração | `Sliders` |
| Sair | `LogOut` |
| Tendência de nota | `TrendingUp` / `TrendingDown` |

### 5.8 Biblioteca de componentes

Componentes primitivos em `apps/web/src/components/ui/`, cobertos por teste:

| Componente | Responsabilidade |
|---|---|
| `Button` | Variantes de ação com estados hover/active/disabled/loading |
| `Input`, `Textarea`, `Select` | Controles de formulário com estados de erro |
| `Field` | Rótulo + controle + mensagem de validação + marcação de obrigatório |
| `Modal` | Diálogo com foco preso, fechamento por Escape e animação `scale-in` |
| `Table` | Tabela densa com cabeçalho ordenável |
| `StatusBadge` | Selo de estado, colorido pelo mapa semântico de status |
| `ProgressMeter` | Medidor de progresso de preenchimento/validação |
| `Spinner` | Indicador de carregamento com rótulo acessível |
| `EmptyState` | Estado vazio com mensagem orientada a ação |
| `Toast` | Notificação transitória |

Componentes de domínio: `IndicatorResponseCard`, `ValidationIndicatorCard`, `ValidationVerdictModal`, `ScoreTrendChart`, `IndicatorScorePanel`, além dos painéis administrativos de acesso, formulários e configurações.

### 5.9 Padrões de layout

**Shell da aplicação (`AppShell`)** — barra lateral fixa de 288 px em superfície `console`, contendo:

- Monograma da unidade em quadrado `accent`, seguido de sigla e nome completo;
- Navegação filtrada por role, com item ativo marcado por borda esquerda `accent-300` e fundo translúcido;
- Rodapé com avatar de iniciais, nome, rótulo da role e ação de sair.

A área de conteúdo usa `paper`, com rolagem independente e `PageHeader` padronizado.

**Tela de login** — composição dividida em duas metades:

- **Esquerda** (oculta abaixo de `lg`): superfície `console` com grade de planta técnica, halo `accent/20` desfocado, logotipo institucional, título do sistema em `display-lg` e propósito curto do produto; rodapé com a linha de copyright institucional;
- **Direita**: cartão de autenticação em `console-raised` com `shadow-floating` e entrada `rise-in`.

**Layout administrativo (`AdminLayout`)** — sub-navegação em abas para Acessos, Formulários e Configurações.

### 5.10 Acessibilidade

- Foco visível global: anel de 2 px na cor `accent` com deslocamento sobre `paper` (`:focus-visible`);
- Seleção de texto em `accent-200` sobre `accent-900`;
- Navegação principal com `aria-label`; elementos decorativos marcados `aria-hidden`;
- Mensagens de erro de formulário com `role="alert"`;
- Rótulos associados via `htmlFor` em todos os controles;
- Estado nunca comunicado apenas por cor — todo `StatusBadge` carrega rótulo textual.

### 5.11 Ativos de marca

| Ativo | Arquivo | Observação |
|---|---|---|
| Logotipo sobre fundo escuro | `/logo-agir-branco.png` | Único ativo de logotipo fornecido |
| Favicon | `/favicon.ico` | — |
| Logotipo sobre fundo claro | — | Variante dedicada, a ser fornecida pela organização. Enquanto o ativo não existir, componentes que precisem de logotipo sobre `paper` **devem tratar a ausência** — recuando para monograma ou texto — e nunca reutilizar a versão branca, que ficaria invisível |

**Linha de copyright institucional:**
`GCINFRA — Gerência Corporativa de Infraestrutura | © {ano} AGIR - Associação de Gestão, Inovação e Resultados em Saúde`

---

## 6. Mapa de Ambientes e Telas

| Rota | Tela | Acesso |
|---|---|---|
| `/login` | Autenticação | Público |
| `/` | **Painel Central** — histórico, filtros, busca, ordenação, nota, tendência, exportação rápida | Todas as roles |
| `/relatorios` | **Lista de Elaboração e Revisão** | Elaborador, Revisor, Administrador |
| `/relatorios/:id` | **Área de Elaboração e Revisão Colaborativa** — preenchimento dinâmico, análise crítica, plano de ação, evidências, submissão | Elaborador, Revisor, Administrador |
| `/validacao` | **Mesa de Validação Técnica** — painel gerencial de todas as unidades e progresso | Aprovador, Administrador |
| `/validacao/:id` | **Detalhe de Validação** — contraprova indicador a indicador, veredito com justificativa, evidência da Matriz, finalização | Aprovador, Administrador |
| `/admin/acessos` | **Controle de Acesso** — usuários e unidades | Administrador |
| `/admin/formularios` | **Governança de Estrutura (Engine No-Code)** — templates, tópicos, indicadores, pesos | Administrador |
| `/admin/catalogo` | **Catálogo Canônico de Indicadores** — listagem, criação, edição e desativação de códigos canônicos, com contagem de vínculos (F9) | Administrador |
| `/auditoria` | **Área de Auditoria e Rastreabilidade** — filtros encadeados, modos básico/detalhado, ordenação, colunas configuráveis, agregações, exportação selada | Todas as roles, limitado ao escopo de unidades |
| `/admin/configuracoes` | **Configurações** — nomenclatura, SLA, pontuação | Administrador |
| `/verificar/:codigo` | **Verificador público de integridade** — veredito e metadados do selo, sem conteúdo do relatório | Público, sem autenticação |
| `*` | Página não encontrada | — |

---

## 7. Superfície de API

Base: API REST NestJS, autenticação por JWT em cookie `HttpOnly` (F16.2) em todas as rotas exceto as marcadas como públicas; rotas de escrita exigem token anti-CSRF.

### Autenticação
```
POST   /auth/login
POST   /auth/logout                          limpa o cookie de sessão no servidor
POST   /auth/refresh                         renova a sessão antes da expiração
GET    /auth/me
```

> `logout` e `refresh` são rotas obrigatórias porque a sessão vive em cookie `HttpOnly` (F16.2): o cliente não consegue apagar nem inspecionar o token, então encerrar e renovar a sessão só podem ser operações de servidor.

### Relatórios
```
GET    /report-instances                     lista no escopo do usuário
GET    /report-instances/overview            visão consolidada de todas as unidades
POST   /report-instances/start-current       abre o período corrente (Elaborador)
GET    /report-instances/:id
POST   /report-instances/:id/submit-for-review
POST   /report-instances/:id/submit-for-approval
POST   /report-instances/:id/finalize
GET    /report-instances/:id/export?format=pdf|csv|json
```

### Respostas de indicador
```
PATCH  /indicator-responses/:id
POST   /indicator-responses/:id/evidence
POST   /indicator-responses/:id/validate
```

### Validação
```
POST   /validation-records/:id/evidence
```

### Evidências
```
GET    /evidence-files/:id/download-url
GET    /evidencias/:token                    público — resolver de uso único para BI (8-A.9)
```

### Engine de formulários
```
GET    /form-templates
GET    /form-templates/:id
POST   /form-templates
PATCH  /form-templates/:id
PATCH  /form-templates/:id/deactivate
PATCH  /form-templates/:id/activate

POST   /form-templates/:templateId/topics
PATCH  /form-topics/:id
PATCH  /form-topics/:id/deactivate
PATCH  /form-topics/:id/activate

POST   /form-topics/:topicId/indicators
PATCH  /form-indicators/:id
PATCH  /form-indicators/:id/deactivate
PATCH  /form-indicators/:id/activate

GET    /form-templates/:templateId/indicator-scores
PATCH  /form-templates/:templateId/indicator-scores
POST   /form-templates/:templateId/indicator-scores/distribute
```

### Catálogo canônico de indicadores (F17.7)
```
GET    /indicator-catalog                    listagem com contagem de vínculos
POST   /indicator-catalog
PATCH  /indicator-catalog/:code
PATCH  /indicator-catalog/:code/deactivate
```

### Administração
```
GET    /admin/users                          POST  /admin/users
GET    /admin/users/:id                      PATCH /admin/users/:id
PATCH  /admin/users/:id/reset-password
PATCH  /admin/users/:id/deactivate
PATCH  /admin/users/:id/activate
POST   /admin/users/:id/unit-access
POST   /admin/users/:id/unit-access/revoke

GET    /admin/units                          POST  /admin/units
GET    /admin/units/:id                      PATCH /admin/units/:id
PATCH  /admin/units/:id/deactivate
PATCH  /admin/units/:id/activate

GET    /admin/platform-settings
PATCH  /admin/platform-settings
```

### Auditoria e rastreabilidade (F17)
```
GET    /audit/query                          consulta consolidada (modo basico|detalhado)
GET    /audit/query/export?format=pdf|csv|json
GET    /audit/aggregations                   bloco analítico do recorte corrente

GET    /audit/filters/units                  opções elegíveis no escopo do usuário
GET    /audit/filters/levels
GET    /audit/filters/indicators             encadeado: reflete unidades/níveis selecionados
GET    /audit/filters/users                  autores de ação (modo detalhado)

GET    /audit/preferences                    colunas visíveis e ordenação do usuário (F17.8)
PUT    /audit/preferences
```

### Selo de integridade e verificação (F18)
```
GET    /verificar/:codigo                    público — página do verificador
GET    /verificar/:codigo.json               público — veredito e metadados do selo
GET    /.well-known/formops-signing-keys     público — chaves públicas correntes e históricas
POST   /admin/export-seals/:id/revoke        Administrador — revogação com motivo
```

### Operacional
```
GET    /health
```

---

## 8. Engenharia, Infraestrutura e Inicialização

### 8.1 Estrutura do repositório

Monorepo npm workspaces:

```
apps/
  api/     NestJS — API REST, regras de negócio, Prisma, cron de SLA
  web/     React + Vite — SPA consumindo a API com sessão em cookie HttpOnly
scripts/
  manage.js   Orquestrador CLI em Node.js nativo
docs/
  PROMPT.md   Este documento
```

### 8.2 Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 10 + Prisma ORM + PostgreSQL |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Estado de servidor no cliente | TanStack React Query |
| Tabelas | TanStack React Table |
| Formulários | React Hook Form + Zod |
| Roteamento | React Router |
| Ícones | Lucide React |
| Autenticação | JWT em cookie `HttpOnly` + token anti-CSRF, RBAC por role e unidade |
| Agendamento | `@nestjs/schedule` |
| Armazenamento de evidências | S3-compatível (MinIO em desenvolvimento) |
| E-mail | SMTP via Nodemailer (modo log quando não configurado) |
| Orquestrador CLI | Node.js nativo (`scripts/manage.js`) |
| Testes backend | Jest (unitários + integração contra PostgreSQL real) |
| Testes frontend | Vitest + Testing Library |

### 8.3 Containerização

Projeto totalmente containerizado com **Docker** e orquestrado por **Docker Compose**, separando rigorosamente:

- Camada de aplicação (API e Web);
- Banco relacional (PostgreSQL);
- Object Storage de evidências (MinIO).

### 8.4 Configuração centralizada

Todas as variáveis são mapeadas em `.env.example`, contrato único de configuração:

| Grupo | Variáveis |
|---|---|
| PostgreSQL | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` |
| Object Storage | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE` |
| Autenticação | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| Admin inicial | `INITIAL_ADMIN_MATRICULA`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` |
| E-mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| Portas | `API_PORT` (7442), `WEB_PORT` (7443) |
| Seeds | `NODE_ENV`, `SEED_ON_START`, `SEED_PROPRIETARY_FORMS`, `SEED_DEMO_POP` |
| HTTPS / CORS | `ENABLE_HTTPS`, `SSL_KEY_PATH`, `SSL_CERT_PATH`, `CORS_ORIGIN` |

**Princípio de derivação:** URLs compostas não são duplicadas. `DATABASE_URL`, `S3_ENDPOINT` e `VITE_API_URL` são **derivadas** das variáveis atômicas acima — o Docker Compose usa nomes de serviço (`postgres`, `minio`) e o `scripts/manage.js` deriva `localhost:PORTA` para o fluxo nativo. Isso elimina a classe de bug em que porta e URL divergem.

A validação de ambiente na inicialização (`env.validation.ts`) faz a aplicação falhar rápido, com mensagem clara, se um segredo obrigatório estiver ausente.

### 8.5 Orquestração via CLI

`scripts/manage.js` expõe o ciclo operacional inteiro por comandos npm:

| Comando | Efeito |
|---|---|
| `npm start` | Sobe containers, aplica migrações, roda seeds, inicia API e Web em background, valida healthcheck |
| `npm run status` | Status da aplicação, ocupação de portas, containers e credenciais |
| `npm run restart` | Reinicia aplicação e containers |
| `npm run stop` | Para apenas a aplicação local, mantendo o banco de pé |
| `npm run down` | Para aplicação e derruba containers |
| `npm run deploy` | Deploy limpo do zero — limpa cache, volumes e `node_modules`, reinstala |
| `npm run deploy:seed` | Deploy limpo + semeadura dos formulários proprietários |
| `npm run seed:proprietary` | Semeia N1, N2 e N3 |
| `npm run seed:demo` | Semeia massa de demonstração |

### 8.6 Migrações e deploy

- **Automação de schema obrigatória.** O ciclo de inicialização do container em produção executa as migrações pendentes de forma **100% automatizada**. É terminantemente proibida a dependência de comandos manuais no servidor para criação ou atualização de schemas e enums.
- **Migrações versionadas** em `apps/api/prisma/migrations/`, incluindo a que instala o trigger de auditoria.
- Arquitetura projetada prevendo pipelines de CI/CD.

### 8.7 Provisionamento de ambiente de testes

Em desenvolvimento, os seeds rodam automaticamente após as migrações e estruturam:

- A unidade inicial padrão **MATRIZ**;
- **Um usuário de teste para cada uma das 5 roles**, todos vinculados nativamente à MATRIZ, permitindo teste imediato de login, workflow e escopo de dados;
- Opcionalmente, massa de demonstração (`SEED_DEMO_POP`) com histórico de relatórios para exercitar filtros, notas e tendência.

Em produção, o **Admin inicial** é provisionado a partir das variáveis `INITIAL_ADMIN_*`.

---

## 8-A. Arquitetura de Dados, Persistência Imutável e Telemetria

Esta seção especifica a camada que sustenta as garantias de governança, rastreabilidade e auditabilidade do produto: como o dado é persistido sem jamais ser sobrescrito, como cada ação é telemetrada, e como o acervo é exposto para inteligência de dados sem que o consumo analítico toque o núcleo transacional.

### 8-A.1 Topologia de persistência

Três schemas com responsabilidades estritamente separadas, e leitura analítica servida por réplica.

```
PRIMÁRIO (escrita)                      RÉPLICA DE LEITURA (streaming)
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ public     OLTP              │        │ public      ─ acesso negado  │
│   escrita exclusiva da API   │        │ audit       ─ acesso negado  │
│            │                 │  ────► │ analytics   ◄── tableau_ro   │
│            ▼ triggers        │        │   views e data marts         │
│ audit      append-only       │        └──────────────┬───────────────┘
│   audit_log · access_log     │                       │ live query
│                              │                       ▼
│ analytics  views e marts     │                   Tableau
└──────────────────────────────┘
```

| Schema | Conteúdo | Regime |
|---|---|---|
| `public` | Modelo transacional (OLTP) — entidades de negócio da Seção 3 | Escrita exclusiva da aplicação |
| `audit` | `audit_log`, `access_log` e contexto de requisição | **Append-only**: `UPDATE` e `DELETE` revogados para toda role da aplicação |
| `analytics` | Views e data marts (OLAP) preparados para BI e ciência de dados | Somente leitura, derivado |

**Desacoplamento de leitura.** A plataforma deve nascer preparada para operar com **réplicas de leitura**: a camada de acesso a dados distingue conexão de escrita (primário) de conexão de leitura (réplica), e o roteamento é configuração, não código. Consultas analíticas — as views do schema `analytics`, incluindo `current_indicator_response`, e os data marts consumidos pelo Tableau e por pipelines de BI — são roteadas **prioritariamente para a réplica**, liberando o nó primário para as operações transacionais das unidades.

A separação OLTP × OLAP é estrutural: evoluções internas do modelo transacional não podem quebrar dashboards, e consultas de BI não podem competir com o fluxo de elaboração e validação.

---

### 8-A.2 Persistência imutável — versionamento append-only

**Princípio.** Nenhuma informação de histórico é sobrescrita ou removida. Uma correção não substitui o dado anterior: ela cria uma nova versão, e a versão anterior permanece consultável para sempre.

`IndicatorResponse` deixa de sofrer `UPDATE` in place. A identidade da resposta permanece única por `(reportInstanceId, formIndicatorId)` (3.3) — **o que é versionado é o conteúdo, em tabela própria**, não a linha de identidade. Cada alteração insere uma nova versão em `indicator_response_version`, com vigência temporal explícita:

```
indicator_response_version
  id | response_id | version | valid_from        | valid_to
  ───┼─────────────┼─────────┼───────────────────┼──────────────────
   1 | resp-A      |    1    | 2026-07-03T10:12Z | 2026-07-05T09:40Z
   2 | resp-A      |    2    | 2026-07-05T09:40Z | 2026-07-08T14:03Z
   3 | resp-A      |    3    | 2026-07-08T14:03Z | NULL   ◄ corrente
```

| Regra | Especificação |
|---|---|
| Versão corrente | `valid_to IS NULL`; exposta pela view `current_indicator_response` |
| Fechamento de versão | Ao inserir a versão *n+1*, a versão *n* recebe `valid_to` igual ao `valid_from` da nova — operação atômica na mesma transação |
| Revogação de DML | `UPDATE` e `DELETE` revogados na tabela versionada para as roles da aplicação; a única escrita permitida é `INSERT` |
| Caminho de escrita | Como o `UPDATE` está revogado no banco, a atualização direta pelo ORM (`update` sobre a tabela versionada) **falha por construção** — e isso é o comportamento desejado. Toda alteração passa por serviço de versionamento explícito, que insere a versão nova e fecha a anterior na mesma transação. A garantia é do banco, não da disciplina de quem escreve o código |
| Autoria por versão | Cada versão carrega o autor e o contexto completo de quem a produziu (8-A.3) |
| Snapshot preservado | Os campos `snapshot*` da definição do indicador (2.2) acompanham cada versão |
| Efeito para o BI | O versionamento entrega a série temporal de alterações sem custo adicional de modelagem |

O mesmo regime vale para as demais entidades cujo histórico é objeto de auditoria: `ValidationRecord` e `ExportSeal` já são imutáveis por natureza — nascem e não mudam; `Unit`, `User` e as entidades da Engine No-Code operam sob soft delete (2.4) e têm suas alterações capturadas integralmente pela trilha.

---

### 8-A.3 Telemetria de alteração — `audit.audit_log`

Toda modificação registra, sem exceção:

| Campo | Conteúdo |
|---|---|
| `tableName`, `recordId` | O que foi alterado |
| `action` | `INSERT` / `UPDATE` / `DELETE` lógico |
| `userId`, `userName`, `userJobTitle`, `userRole`, `unitId` | **Quem fez** — identificação, nome, **cargo**, perfil de acesso e lotação, materializados no momento do evento para que a leitura histórica não dependa do estado atual do cadastro |
| `previousValue`, `newValue` | Valor anterior e valor novo, em JSON |
| `changedAt` | **Quando fez** — timestamp com precisão de microssegundos, em UTC |
| `sourceIp` | **IP de origem** da requisição |
| `userAgent` | Cliente que originou a ação |
| `origin` | Canal: `WEB`, `API`, `CRON`, `COLETA_AUTOMATICA`, `SEED` |
| `requestId` | Correlaciona todos os eventos de uma mesma requisição |

**Cargo é dado obrigatório.** A entidade `User` passa a carregar `jobTitle` (cargo), distinto de `role` (perfil de acesso). São coisas diferentes: *Coordenador de Infraestrutura* é cargo; *Revisor* é papel na plataforma. O cargo é exigido pela assinatura eletrônica do Aprovador na exportação (F13) e pela rastreabilidade de autoria.

#### Propagação do contexto de requisição

O trigger de banco não enxerga a camada HTTP por conta própria. A aplicação propaga o contexto completo por variáveis de sessão, na abertura da transação:

```
runWithAuditContext({ userId, sourceIp, userAgent, origin, requestId }, tx)
    │
    ▼  SET LOCAL app.audit_user_id / app.audit_source_ip /
    │            app.audit_user_agent / app.audit_origin / app.audit_request_id
    ▼
  trigger lê current_setting(...) e grava em audit.audit_log
```

- O escopo é `SET LOCAL` — o contexto morre com a transação, sem vazar entre requisições;
- Uma escrita que chegue ao banco **sem contexto de auditoria** é rejeitada pelo trigger, nunca gravada em silêncio;
- Ações não humanas (cron, coleta automática, seed) declaram um ator de sistema identificável e o `origin` correspondente — jamais aparecem como autor nulo.

##### Ações legitimamente anônimas

Duas superfícies da plataforma são públicas por especificação: o verificador de selo (F18.4) e o resolver de evidências para BI (8-A.9). Elas **precisam** gravar em `access_log` e não possuem usuário autenticado — o que colidiria com a regra de rejeição acima.

A resolução é explícita, não uma exceção implícita: essas rotas declaram o **ator anônimo** (`origin = PUBLICO`, `userId` nulo por contrato declarado, não por omissão), acompanhado de IP, user-agent e `requestId`. O trigger aceita a ausência de usuário **somente** quando o ator anônimo é declarado; continua rejeitando escrita que simplesmente não informou contexto.

A distinção importa em auditoria: *"ninguém autenticado, e sabemos disso"* é um registro; *"não sabemos quem foi"* é uma falha.

---

### 8-A.4 Telemetria de acesso — `audit.access_log`

Rastrear apenas quem *alterou* deixa descoberta a auditoria de **quem acessou**. A plataforma registra também a leitura de dados sensíveis:

| Evento registrado | Conteúdo |
|---|---|
| Consulta na área de auditoria | Filtros aplicados, modo, escopo retornado, volume de linhas |
| Exportação de artefato | Tipo, formato, recorte, selo emitido |
| Download de evidência | Arquivo, via de acesso (plataforma ou resolver de BI) |
| Verificação de selo | Código consultado, veredito devolvido |
| Autenticação | Sucesso e falha |

Cada registro carrega ator (quando identificável), IP, user-agent, origem, `requestId` e timestamp. `access_log` é append-only, no mesmo regime de `audit_log`.

---

### 8-A.5 Retenção, particionamento e proteção

| Controle | Especificação |
|---|---|
| Particionamento | `audit_log` e `access_log` particionados por mês |
| Retenção | Definida por política explícita e documentada; expurgo de partição só por procedimento aprovado e registrado — nunca por operação de aplicação |
| Proteção contra DML | `UPDATE`/`DELETE` revogados para todas as roles de aplicação; alteração no schema `audit` exige credencial administrativa distinta da usada pela API |
| Fonte de tempo | Servidores sincronizados por NTP; timestamps gravados em UTC, com conversão apenas na apresentação |
| Backup e restauração | Backup regular com **teste periódico de restauração** — um backup nunca restaurado não é um backup |
| Segregação de credenciais | A role da aplicação, a role de leitura analítica (`tableau_ro`) e a role administrativa de banco são distintas, com privilégio mínimo cada uma |

---

### 8-A.6 Schema `analytics` — modelagem para BI e ciência de dados

Modelagem em estrela, com grão declarado por objeto. Todas as views filtram **exclusivamente relatórios em status `CONCLUIDO`** (8-A.10): etapas de elaboração e revisão são ruído operacional e não compõem métrica oficial.

| Objeto | Grão | Conteúdo |
|---|---|---|
| `fact_indicator_result` | unidade × período × indicador canônico | Valor apurado, fórmula em snapshot, operador e meta vigentes, conformidade, peso, veredito de validação, **flag de aplicabilidade** |
| `fact_indicator_variable` | … × **variável** | Cada chave de entrada com seu valor — a decomposição do cálculo |
| `fact_indicator_event` | evento | Quem registrou, editou, validou; valor anterior e novo; cargo, IP, origem e timestamp |
| `fact_report_score` | unidade × período | Nota de indicadores, deflator de SLA, nota final, pontualidade por etapa, contagem de reprovas |
| `dim_unit` | unidade | Sigla, nome, nível e formulário vigente **no período** |
| `dim_indicator` | código canônico | Nome, descrição, unidade de medida, tópico |
| `dim_time` | mês de referência | Ano, mês, trimestre, dias úteis do período |
| `dim_user` | usuário | Nome, cargo, perfil, unidade |
| `dim_evidence` | evidência | Nome do arquivo, tipo, tamanho, autor do upload, **URL mascarada** (8-A.9) |

**Regras invioláveis da camada analítica:**

1. **Somente `CONCLUIDO`.** Nenhum número provisório circula como consolidado;
2. **A semântica de ausência atravessa a camada.** A flag de aplicabilidade acompanha cada fato — o Tableau precisa distinguir `0` de `N/A` exatamente como F17.4 distingue, e nenhuma agregação de BI pode tratar inaplicável como zero;
3. **Metas e pesos vêm do snapshot**, nunca da definição corrente (2.2);
4. **Nota congelada** — a camada reproduz a nota calculada na finalização, jamais recalcula (F8);
5. **Somente leitura** — nenhuma escrita retorna do BI para a plataforma;
6. **Sem lógica de negócio nova** — a camada projeta o que o OLTP decidiu; não reinterpreta regra.

**Relação com F17.** A área de auditoria interna e o BI respondem perguntas parecidas e são, ambos, consumidores da mesma verdade transacional. O BI **nunca** é fonte alternativa: divergência entre os dois é defeito, não interpretação.

---

### 8-A.7 Linearidade de cálculo — drill-down do resultado à evidência

O modelo entrega ao analista a cadeia completa por trás de qualquer número, sem sair do Tableau:

```
fact_indicator_result          valor apurado ......... 65
        │                      fórmula ............... (EGA / (ENG + EGA)) * 100
        │                      meta .................. >= 98,00
        │                      conformidade .......... não conforme
        │
        ├──► fact_indicator_variable     EGA = 130 · ENG = 70
        │                                (uma linha por variável de entrada)
        │
        ├──► fact_indicator_event        quem registrou, quem editou,
        │                                valor anterior → novo, cargo,
        │                                IP, origem, timestamp,
        │                                quem validou e a justificativa
        │
        └──► dim_evidence                anexo, autor, data,
                                         URL mascarada no domínio da plataforma
```

Cada elo é uma junção direta por chave — o analista parte do valor final e desce até o arquivo de evidência em quatro passos.

---

### 8-A.8 Acesso do Tableau

| Aspecto | Especificação |
|---|---|
| Modo de consumo | **Conexão direta** ao banco (live query). Nenhuma API intermediária participa da leitura |
| Destino da conexão | Réplica de leitura, conforme 8-A.1 |
| Credencial | Role dedicada `tableau_ro` |
| Privilégio | **`SELECT` estrito, somente no schema `analytics`**. Acesso a `public` e a `audit` explicitamente negado |
| Escrita | Nenhuma — sem `INSERT`, `UPDATE`, `DELETE`, `CREATE` ou `TEMP` |
| Rede | Conexão restrita por origem autorizada e canal cifrado |
| Observabilidade | Consultas da role registradas para acompanhamento de volume e desempenho |

---

### 8-A.9 Resolver de evidências para o BI

O Tableau em live query não invoca endpoint autenticado — ele exibe o que está na coluna. Para que o drill-down chegue ao anexo sem transformar o link em credencial permanente, `dim_evidence` expõe uma **URL mascarada pelo domínio da plataforma**, governada por token de curta duração e uso único.

```
Coluna no Tableau:
  https://<host>/evidencias/{token}
           │
           ▼  usuário clica
  [ token válido na janela corrente? ] ── não ──► tela de expiração
           │ sim
  [ token já consumido? ] ── sim ──────────────► tela de expiração
           │ não
  marca token como consumido · grava audit.access_log
           │
           ▼
  302 ─► URL pré-assinada do MinIO (expiração em minutos)
```

| Regra | Especificação |
|---|---|
| **Geração** | Token derivado por **HMAC-SHA256** sobre o identificador da evidência e a janela de tempo corrente, com segredo do servidor. Computado **na própria view**, no momento em que o Tableau executa a consulta — cada atualização do painel produz um token novo |
| **Validade** | Poucos minutos; expirado, não resolve |
| **Uso único** | Invalidado **imediatamente após o primeiro clique ou download**; a segunda tentativa cai na tela de expiração |
| **Sem login** | O acesso originado do BI **não exige sessão nem conta na plataforma** — Diretoria e analistas navegam de forma fluida, sem provisionamento de usuários |
| **UX de expiração** | Tela amigável, instruindo a retornar ao Tableau e clicar novamente no indicador para gerar novo acesso. Nunca um erro cru |
| **Registro** | Toda resolução — bem-sucedida, expirada ou já consumida — é gravada em `audit.access_log` |
| **Rede** | Política estrita de CORS em toda a plataforma, com bloqueio de origens não autorizadas |
| **Mascaramento** | A URL do MinIO nunca aparece no BI, em log de dashboard ou em captura de tela — apenas o domínio da plataforma |

**Limite declarado.** A dispensa de login é escolha deliberada de usabilidade: dentro da janela de validade e antes do primeiro uso, quem detiver o link acessa a evidência. O risco é contido pela combinação de janela curta, consumo único, registro integral de acesso, restrição de origem, e pelo fato de o link só ser obtenível por quem já possui acesso ao Tableau. Evidências que exijam confidencialidade superior a essa garantia não devem ser expostas pelo resolver de BI.

---

### 8-A.10 Nomenclatura de estados por granularidade

Os dois vocabulários coexistem porque descrevem objetos diferentes — e a distinção precisa ser explícita para que nenhuma view, relatório ou auditoria os confunda:

| Nível | Objeto | Estado final | Significado |
|---|---|---|---|
| **Relatório** (documento) | `ReportInstance.status` | `CONCLUIDO` | O documento percorreu o ciclo de vida integralmente e teve o período de edição encerrado |
| **Indicador** (métrica individual) | `IndicatorResponse.validationStatus` | `APROVADO` | A métrica passou pela contraprova da Matriz |

**Regra de fechamento:** um relatório só atinge `CONCLUIDO` quando **100% dos seus indicadores** estiverem em `APROVADO`. Um único indicador reprovado devolve o relatório à unidade (F3).

As views do schema `analytics` filtram por relatório em `CONCLUIDO`, garantindo que o BI consuma exclusivamente documentos cujo ciclo de vida foi totalmente finalizado e aprovado.

---

## 8-B. Desempenho e Otimização Full-Stack

**Premissa.** O acervo cresce de forma monotônica — nada é apagado, tudo é versionado (8-A.2). Um desenho que funciona no primeiro ano e degrada no terceiro não é aceitável em plataforma cuja utilidade aumenta com a profundidade do histórico. As regras abaixo existem para que o custo de uma consulta dependa do **recorte pedido**, e não do tamanho do acervo.

Duas camadas: refinamentos de código e evolução de infraestrutura.

---

### 8-B.1 Acesso a dados — backend

##### Proibição de consulta em laço

Leituras hierárquicas pesadas — relatório com tópicos, indicadores, respostas e evidências — são resolvidas em projeção única. **É vedado o laço que emite consulta por iteração** (`for`, `map` assíncrono, `Promise.all` sobre chamadas individuais ao banco): o custo passaria a crescer com o número de linhas, que é exatamente a variável que a plataforma não controla.

**Precisão necessária sobre o ORM.** `include` **não produz JOIN** por padrão: o Prisma emite uma consulta por relação. Isso já elimina o N+1 clássico — o custo cresce com o número de relações, não de linhas — mas não é o mesmo que uma projeção unificada, e a diferença precisa ser deliberada, não presumida. Para a leitura hierárquica mais pesada, valem duas rotas:

| Rota | Quando |
|---|---|
| Estratégia de carga por JOIN declarada explicitamente no ORM | Leitura de agregado único, com profundidade conhecida |
| Leitura a partir de **view do banco** | Consultas de amplitude larga — padrão já estabelecido em 8-A para a camada analítica |

Escrever `include` acreditando ter obtido um JOIN é o erro que esta subseção existe para prevenir.

##### Indexação da trilha de auditoria

A `audit.audit_log` guarda `previousValue` e `newValue` em JSONB. **A escolha do índice depende da pergunta**, e um único tipo não cobre as duas que a Área de Auditoria faz:

| Pergunta | Índice | Observação |
|---|---|---|
| "onde este campo valia este valor" | GIN com `jsonb_path_ops` | Containment (`@>`) e existência de chave; menor e mais rápido que o operador padrão quando só há containment |
| "onde qualquer valor contém este texto" | GIN com `pg_trgm` sobre expressão textual da coluna | Busca por substring **não é acelerada** por GIN de JSONB — sem este índice, a consulta cai em varredura completa mesmo com o índice de containment presente |

**Custo assumido.** GIN amplifica escrita, e a trilha é append-only de alto volume. O particionamento previsto em 8-A.5 mantém cada índice restrito à sua partição, o que torna o custo administrável — mas ele é real e deve ser medido, não presumido irrelevante.

##### Paginação por cursor

Para a Área de Auditoria, fica **vedado `OFFSET` em profundidade**: o banco descarta as linhas puladas, e o custo cresce linearmente com a página acessada. A navegação usa **cursor sobre chave estável** (keyset), apoiado no critério de desempate já declarado em F17.8.

Três consequências que o desenho assume abertamente:

- **Ordenação livre restrita a colunas indexadas.** O cursor precisa compor a chave de ordenação; coluna sem índice degenera na varredura que a medida quer evitar. As colunas ordenáveis são declaradas, não arbitrárias;
- **Sem salto para página arbitrária.** A navegação é anterior/próxima ou rolagem contínua — "ir para a página 40" deixa de existir, porque não há como conhecer o cursor da página 40 sem percorrer as anteriores;
- **Contagem aproximada.** Totalizar exatamente o conjunto filtrado é `O(n)` e anularia a promessa de custo constante. A interface apresenta estimativa ou teto (`mais de 10.000 registros`), com contagem exata reservada a recortes abaixo de um limite configurável.

---

### 8-B.2 Renderização e rede — frontend

##### Virtualização de tabelas densas

Tabelas de alto volume — Área de Auditoria e tela de preenchimento — renderizam **apenas as linhas visíveis no viewport**, mantendo o custo de rolagem independente do tamanho do resultado.

Duas consequências que precisam estar declaradas, porque a virtualização as torna contraintuitivas:

- **Nenhuma exportação é construída a partir do DOM.** Só existem as linhas visíveis; a geração de PDF, CSV e JSON é server-side, coerente com F17.11 e com a serialização canônica de F18. Exportar o que está na tela produziria arquivo incompleto e selo válido — a pior combinação possível;
- **A busca dentro do resultado é server-side.** O `Ctrl+F` do navegador alcança apenas o viewport, e confiar nele levaria o usuário a concluir que um registro não existe quando ele apenas não está renderizado.

##### Divisão de código por rota

Roteamento com carregamento sob demanda: telas administrativas, Engine No-Code, exportadores e a Área de Auditoria só têm seus bundles transferidos quando acessados. O Elaborador — perfil majoritário — não paga o custo de download de superfícies que nunca abre.

##### Isolamento de re-renderização no preenchimento

Alterar a variável de um indicador **jamais** re-renderiza a página inteira ou os demais indicadores. O estado de formulário é mantido de forma desacoplada e os blocos de indicador são encapsulados para não reagir a mudanças que não lhes dizem respeito.

O limite do isolamento: a aferição do indicador alterado (F5) e os totais que dependem dele **precisam** reagir. O isolamento é de escopo, não de propagação — o que muda junto é o que a regra de negócio determina que mude.

##### Cache de cliente por domínio

O tempo de frescor é declarado **por domínio de dado**, nunca por um valor global — a mesma política não pode servir a um catálogo estável e a uma mesa de decisão:

| Domínio | Frescor | Razão |
|---|---|---|
| Catálogo de indicadores, configurações, estrutura de formulário | Generoso | Muda raramente e por ação administrativa explícita |
| Painel Central e séries históricas | Moderado | Defasagem de segundos não altera decisão |
| Área de Auditoria, Mesa de Validação, ciclo de vida do relatório | **Zero** | São superfícies de governança: servir silenciosamente um valor vencido permitiria emitir veredito sobre dado já alterado |

Toda mutação invalida explicitamente as chaves afetadas — o frescor generoso vale para ausência de mudança, não para mudança não observada.

##### Ativos e tipografia

- Fontes servidas localmente com `font-display: swap`, evitando bloqueio de renderização de texto;
- Gráficos de tendência desenhados em SVG nativo, sem biblioteca externa de visualização — a necessidade é uma linha de tendência, e não justifica o peso de uma dependência gráfica completa.

---

### 8-B.3 Evolução de infraestrutura

##### Camada de cache de aplicação

Configurações globais (`SystemSetting`), catálogos e estrutura de formulários (`FormTemplate`) residem em cache dedicado, com **invalidação por evento**, e não por expiração cega.

**Sinergia com o modelo.** Cachear `FormTemplate` é seguro precisamente porque relatórios congelam a definição em snapshot no instante da instanciação (2.2): um template servido do cache não pode corromper histórico, já que o histórico não o consulta.

**Exclusão obrigatória.** Escopo de unidade, papel e permissão de usuário **nunca** entram nessa camada. Acesso revogado que sobrevive a um TTL é falha de autorização, não de desempenho — e a revogação de acesso a uma unidade precisa ser imediata por definição.

##### Views materializadas para agregação

Agregações de longa amplitude usam views materializadas com atualização agendada, **restritas a Painel Central e camada analítica**.

**A Área de Auditoria (F17) consulta sempre dado vivo.** A razão é a defensabilidade: com view materializada, duas exportações do mesmo recorte em momentos diferentes divergiriam, e o selo de integridade (F18) carimbaria ambas como legítimas — sem que nada no artefato explicasse a diferença. Numa superfície cuja finalidade é sustentar auditoria externa, defasagem invisível é defeito, não otimização.

**Restrição de topologia.** View materializada é relação física: o refresh executa no **nó primário** e alcança a réplica por replicação. O alívio prometido é parcial — o custo do refresh recai justamente sobre o nó que 8-A.1 protege ao rotear leitura analítica para a réplica. Daí duas exigências:

- Refresh em **janela de baixa demanda transacional**, nunca em horário de pico de elaboração ou de fechamento de período;
- Refresh **concorrente**, para não bloquear leitores durante a atualização — o que pressupõe índice único declarado na view.

---

## 9. Formulários Proprietários N1, N2 e N3

### 9.1 Origem

As definições estruturais foram obtidas por **engenharia reversa** dos documentos de especificação originais em `./template-forms` (`.docx` de N1 e N3), extraindo chaves, fórmulas, objetivos e metas de cada indicador de Segurança, Infraestrutura e Governança.

**N2 não possui documento de origem próprio.** Não há `.docx` de N2 em `./template-forms`. O nível é válido, cadastrável e operacional: seu formulário é **replicado da definição de N3** — mesmos tópicos, indicadores, variáveis, fórmulas, pesos e metas.

A replicação produz um **template próprio**, não um vínculo compartilhado com o de N3. Os dois nascem idênticos e podem divergir a qualquer momento, sem que ajustar a meta de um altere a do outro. A estrutura comum vive em um módulo de definição único, consumido pelos dois scripts de carga — replica-se conteúdo, não código.

### 9.2 Isolamento dos scripts de carga

As definições de N1, N2 e N3 vivem em scripts de seed isolados, separados da lógica da aplicação:

```
apps/api/prisma/seed-proprietary/
  seed-n1.ts      definição estrutural do formulário N1
  seed-n2.ts      formulário N2 — instancia a definição compartilhada
  seed-n3.ts      formulário N3 — instancia a definição compartilhada
  definicao-n3.ts estrutura de origem, comum a N2 e N3
  seed-utils.ts   rotina compartilhada de carga (seedFormTemplate)
```

**Racional:** a engine de formulários e o conteúdo de governança são responsabilidades distintas. Alterar uma meta não deve tocar código de aplicação, e a carga proprietária é acionada por flag explícita (`SEED_PROPRIETARY_FORMS=true`) ou comando dedicado (`npm run seed:proprietary`, `seed:n1`, `seed:n2`, `seed:n3`), nunca implicitamente.

**Ponto de divergência.** Enquanto N2 e N3 forem idênticos, ambos consomem `definicao-n3.ts` sem alteração. No momento em que N2 receber estrutura própria, `seed-n2.ts` deixa de instanciar a definição comum e passa a declarar a sua — mudança contida em um arquivo, sem migração de dados e sem efeito sobre os relatórios de N3 já emitidos, que permanecem presos ao seu snapshot (2.2).

### 9.3 Estrutura e omissões deliberadas

**Exemplo de estrutura (N1):**

```
Template: "N1 - Relatório Operacional de TI (Unidades Geridas)"
  Tópico "1. Segurança da Informação"
    ├── Endpoints: Gerenciados pelo Antivírus Corporativo
    │     objetivo:  mensurar o índice de instalação do antivírus nas estações
    │     variáveis: EGA, ENG
    │     fórmula:   (EGA / (ENG + EGA)) * 100
    │     meta:      >= 98,00
    └── …
  Tópico "2. Infraestrutura"
  Tópico "3. Governança"
```

**Omitido deliberadamente** por não se encaixar no modelo `FormIndicator` (que exige operador, meta e fórmula numérica):

| Seção original | Motivo |
|---|---|
| "4. Melhorias e Aprimoramentos" | Log qualitativo em texto livre, não indicador aferível |
| "5. Notas de Versão" | Changelog do documento, não indicador |

**Adaptação registrada:** "Total de minutos mensais" (base dos indicadores de disponibilidade) virou a variável de entrada manual `MINUTOS_MENSAIS`, preenchida a cada período, porque o valor varia com o número de dias do mês e o avaliador de fórmulas não possui funções de calendário.

### 9.4 Dicionário de variáveis

A interface traduz cada chave em rótulo legível. Extrato:

| Chave | Rótulo |
|---|---|
| `EGA` / `ENG` | Endpoints gerenciados / não gerenciados pelo antivírus |
| `EGI` | Endpoints no sistema de inventário |
| `PRE` | Pontuação de risco cibernético |
| `TOM` / `RNR` | Ocorrências de malware / relatadas e não resolvidas |
| `TAR` / `ARA` | Atualizações recomendadas / agendadas ou aplicadas |
| `SFP` / `SGA` | Servidores físicos em produção / com garantia ativa |
| `MVP` / `MVL` | Máquinas virtuais em produção / licenciadas |
| `MVC` / `MBR` | VMs críticas / com backup restaurável |
| `DRC` / `DBR` | Dispositivos de rede críticos / com backup restaurável |
| `IFP` / `ICL` | Indisponibilidade de firewall / de links (minutos) |
| `CA` / `CB` | Chamados abertos / em backlog |
| `APP` / `ARP` | Ações de conscientização planejadas / realizadas |
| `RP` / `RR` | Revisões de acesso planejadas / realizadas |
| `MINUTOS_MENSAIS` | Total de minutos no mês |
| `TEMP`, `NOBREAK`, `CABOS`, `LIMPEZA_RACK`, `GOTEIRAS`, `ACESSO_FISICO`, `CAMERAS`, `RUIDOS` | Inspeções físicas binárias (1 = SIM, 0 = NÃO) |

---

## 10. Qualidade e Estratégia de Testes

| Camada | Ferramenta | Escopo |
|---|---|---|
| Backend — unitário | Jest | Serviços, utilitários (dias úteis, fórmulas, distribuição de pesos, CSV, nomenclatura), guards, strategy JWT |
| Backend — integração | Jest contra PostgreSQL real | Controllers e fluxo transacional |
| Frontend — unitário e de componente | Vitest + Testing Library | Páginas, componentes de UI e de domínio, clientes de API, utilitários |

**Convenções:**

- Todo componente de UI e de domínio **deve ter** arquivo `.test.tsx` par;
- Todo cliente de API **deve ter** arquivo `.test.ts` par;
- Cobertura mínima exigida: **80%**;
- Lint por ESLint obrigatório em ambos os workspaces;
- As regras de auditoria de F17.4 (`N/A` ≠ `0`), F17.5 (resultado vazio sem relaxamento) e F17.6 (matriz esparsa) **devem ter cobertura de teste explícita** — são invariantes de integridade, não detalhes de apresentação;
- A selagem (F18) **deve ter** teste de regressão que detecte alteração de um único byte no conteúdo canônico.

**Comandos:**

```bash
npm run build     # api (Nest → dist/) + web (Vite → dist/)
npm test          # suíte completa
npm run test:cov --workspace=apps/api
npm run test:cov --workspace=apps/web
npm run lint --workspace=apps/api
npm run lint --workspace=apps/web
```

---

## 11. Etapa 2 — Automação Integral de Coleta (API-Driven)

**Objetivo.** Eliminar a digitação humana de todo indicador que uma ferramenta especialista já mede, reduzindo o trabalho do Elaborador à conferência e à contingência.

O relatório passa a nascer **pré-preenchido em modo rascunho**; a intervenção humana fica reservada aos indicadores não automatizáveis (inspeções físicas, análise crítica, plano de ação) e aos casos em que a coleta falhou ou divergiu.

### 11.1 Fontes de coleta

| Fonte | Indicadores atendidos |
|---|---|
| **Zabbix** | Disponibilidade de links e de firewall, condições ambientais de sala técnica |
| **Grafana** | Séries de disponibilidade e capacidade |
| **GLPI** | Chamados abertos, backlog, inventário de ativos |
| **Bitdefender GravityZone** | Endpoints gerenciados, ocorrências de malware, pontuação de risco, atualizações |

O vínculo entre uma fonte e um indicador é feito pelo **código canônico do catálogo** (F17.7), não pelo `FormIndicator` de um formulário específico — assim uma mesma integração serve N1, N2 e N3 sem duplicação.

### 11.2 Regras da coleta automática

| Regra | Especificação |
|---|---|
| **Idempotência** | Reexecutar a coleta do mesmo indicador, no mesmo período, produz o mesmo estado — nunca duplica resposta nem acumula valor |
| **Origem do dado** | Cada `IndicatorResponse` registra se o valor veio de coleta automática ou de digitação humana, com identificação da fonte e timestamp da extração |
| **Política de sobrescrita** | Valor informado por humano **nunca** é sobrescrito silenciosamente pela coleta. A divergência é sinalizada ao Elaborador e ao Revisor, que decidem qual prevalece — e a decisão fica na trilha de auditoria |
| **Falha de coleta** | Indisponibilidade da fonte não bloqueia o ciclo nem invalida o relatório: o indicador permanece `Não preenchido` e disponível para entrada manual, com o erro registrado |
| **Ausência ≠ zero** | Uma coleta que retorna vazio **jamais** grava `0`. Vale integralmente a semântica de F17.4 |
| **Auditabilidade** | Toda escrita automática passa pela mesma trilha de auditoria (F15), com um ator de sistema identificável, e entra na telemetria detalhada da área de auditoria (F17.3) |
| **Autoridade da validação** | A coleta automática não altera o fluxo: o dado coletado continua sujeito à revisão local e à contraprova da Matriz (F7) |

---

## 11-A. Requisitos não funcionais transversais

| Dimensão | Requisito |
|---|---|
| **Determinismo** | Duas execuções da mesma consulta, sobre o mesmo acervo, produzem o mesmo resultado, na mesma ordem |
| **Reprodutibilidade** | Todo número apresentado é recomputável a partir dos dados brutos exportados da mesma consulta |
| **Não destrutividade** | Nenhuma operação da plataforma remove registro histórico; correções são novos registros com autoria |
| **Degradação segura** | Falha de serviço acessório (e-mail, object storage, fonte de coleta) nunca reverte transação de negócio já persistida nem bloqueia o ciclo |
| **Escopo constante** | Qualquer superfície de leitura — painel, auditoria, exportação — respeita o mesmo escopo de unidades do usuário, sem exceção |
| **Idioma** | Toda a interface, mensagens de erro, e-mails e artefatos exportados em português do Brasil |

---

## 12. Glossário

| Termo | Significado |
|---|---|
| **DU** | Dia útil — desconsidera fins de semana e feriados nacionais obrigatórios |
| **Estado Residente** | Dados estruturais estáveis clonados automaticamente do período anterior |
| **Snapshot** | Cópia congelada da definição do indicador no momento da instanciação do relatório |
| **Contraprova** | Verificação independente realizada pela Matriz sobre um indicador informado pela unidade |
| **Deflator de SLA** | Pontos subtraídos da nota final por etapa entregue fora do prazo |
| **Engine No-Code** | Construtor visual de formulários baseado em metadados, operado pelo Administrador |
| **Matriz** | Sede corporativa — unidade que exerce o papel de Aprovador |
| **Unidade gerida** | Filial/hospital sob gestão da AGIR que elabora o relatório |
| **N1 / N3** | Formulários proprietários por complexidade da unidade |
| **Soft Delete** | Desativação lógica (`is_active = false`) em substituição à exclusão física |
| **`N/A` (fora do nível)** | A unidade não possuía aquele indicador no formulário vigente no período — distinto de `0`, que afirma medição com resultado zero |
| **`n` efetivo** | Quantidade de observações válidas que compõem uma agregação, excluídas as células `N/A` e `Não preenchido` |
| **Matriz esparsa** | Resultado de consulta que cruza unidades de níveis diferentes, em que nem todo indicador se aplica a toda linha |
| **Catálogo canônico** | Identidade estável de um indicador entre formulários distintos, permitindo comparação da mesma métrica entre níveis |
| **Serialização canônica** | Representação em bytes determinística do conteúdo, base do digest — garante que PDF, CSV e JSON do mesmo recorte compartilhem a mesma prova |
| **Digest de conteúdo** | SHA-256 da serialização canônica do dado — idêntico entre PDF, CSV e JSON do mesmo recorte |
| **Digest de artefato** | SHA-256 dos bytes do arquivo entregue — detecta edição no arquivo mesmo quando o dado de origem não mudou |
| **Selo de integridade** | Conjunto digest + assinatura + código de verificação que comprova origem e inalterabilidade de um artefato exportado |
