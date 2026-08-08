# Feature Specification: FormOps — Plataforma BASE de Governança de Indicadores de TI (Etapa 1)

**Feature Branch**: `main` — nenhuma branch dedicada foi criada (extensão de git ausente neste repositório)

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "utilize o @docs/Master_Technical_&_Product_Specification.md"

## Contexto e Fronteira de Escopo

O documento master especifica o produto FormOps em **duas etapas sequenciais e
retrocompatíveis** (§1.1). Esta especificação cobre integralmente a **Etapa 1 — BASE:
Plataforma Web Assistida e Governança No-Code**.

**Fora de escopo nesta feature:** a Etapa 2 (Automação Integral de Coleta API-Driven, §11 —
Zabbix, Grafana, GLPI, Bitdefender GravityZone). Ela é acréscimo posterior que alimenta as
mesmas entidades sob as mesmas regras, e não altera nenhum requisito abaixo.

O produto substitui o processo legado de elaboração do Relatório Operacional de TI das
unidades geridas pela AGIR — hoje baseado em documentos manuais, planilhas de consolidação e
capturas de tela descentralizadas. Os relatórios produzidos são usados como **insumo em
processos de auditoria externa**, o que eleva integridade, rastreabilidade e verificabilidade
de qualidades desejáveis a requisitos de primeira ordem.

## Clarifications

### Session 2026-08-07

- Q: Quando o revisor e o elaborador da mesma unidade editam o mesmo indicador ao mesmo tempo
  durante a reabertura por reprova, o que deve acontecer? → A: Detectar o conflito na gravação —
  a segunda gravação é recusada, o autor vê o valor que chegou primeiro, quem o informou e
  quando, e decide conscientemente se sobrescreve.
- Q: Em caso de perda do banco de dados, quanto tempo a plataforma pode ficar indisponível e
  quanto trabalho já digitado pode ser perdido? → A: Perda máxima de 15 minutos de trabalho
  (RPO) e retorno em até 4 horas (RTO), com recuperação a ponto no tempo e réplica de leitura
  promovível.
- Q: Por quanto tempo os registros de alteração e de acesso devem ser mantidos antes que
  qualquer expurgo seja possível? → A: Piso igual ao das evidências — nunca menos que a janela
  de retenção configurada (10 anos por padrão), acompanhando-a se for ampliada. Expurgo apenas
  por procedimento aprovado e registrado, nunca pela aplicação.
- Q: Por quanto tempo um arquivo bloqueado por detecção de malware deve permanecer retido em
  quarentena para fins periciais? → A: 1 ano, com expurgo automático ao fim do prazo e
  liberação antecipada possível pelo administrador mediante registro. Prazo próprio,
  independente da janela de retenção das evidências.
- Q: Quantas unidades e quantos usuários a plataforma precisa atender, e com que margem de
  crescimento? → A: Envelope de planejamento de 10 anos da AGIR — 20 a 60 unidades e 100 a 400
  usuários. Amplitude de consulta de 24 meses e contagem exata até 10.000 registros são
  adequadas a essa escala; réplica de leitura e particionamento da trilha justificam-se pelo
  acúmulo de 10 anos, não pelo volume inicial.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elaborar e submeter o relatório mensal da unidade (Priority: P1)

O analista de TI de uma unidade acessa a plataforma no início do mês e encontra o relatório do
período já aberto, com os dados estruturais estáveis (inventário de servidores, ativos de rede,
links contratados, licenças) herdados do mês anterior e sinalizados como pendentes de
conferência. Ele informa apenas as variáveis que mudam, vê o resultado de cada indicador ser
calculado e aferido contra a meta na hora, escreve a análise crítica e o plano de ação, anexa
as evidências e submete o relatório para revisão do seu superior técnico.

**Why this priority**: É a razão de existir do produto. Sem esta jornada não há acervo, não há
o que revisar, pontuar, auditar ou exportar — todas as demais histórias operam sobre o que ela
produz. Sozinha, já extingue o documento manual e a captura de tela descentralizada.

**Independent Test**: Com uma unidade, um formulário e um usuário elaborador provisionados,
percorrer o ciclo do login até a submissão para revisão, verificando que o período abriu
sozinho, que os dados estruturais foram herdados, que os resultados foram calculados a partir
das variáveis informadas e que o relatório mudou de estado. Entrega valor mesmo que nenhuma
outra história exista.

**Acceptance Scenarios**:

1. **Given** que é o primeiro dia útil do mês e a unidade possui formulário vinculado, **When**
   o período vira, **Then** a instância do relatório é criada automaticamente em estado
   pendente, sem qualquer intervenção humana.
2. **Given** que a unidade preencheu no mês anterior os indicadores marcados como dados
   estruturais estáveis, **When** o novo período é aberto, **Then** esses valores são herdados
   e cada um é visualmente sinalizado como herdado e ainda não conferido.
3. **Given** que uma chave de variável existe na definição vigente mas não existia no mês
   anterior, **When** a herança ocorre, **Then** a chave fica como não preenchida, a resposta é
   marcada como herança parcial e o elaborador é alertado a conferir — em nenhuma hipótese a
   chave recebe zero ou o valor de outra chave.
4. **Given** um indicador com todas as variáveis informadas, **When** o elaborador conclui a
   entrada, **Then** o resultado é calculado e a conformidade é aferida contra a meta vigente
   no período.
5. **Given** um indicador cujo cálculo é impossível (variável ausente ou denominador zero),
   **When** o elaborador informa os valores, **Then** nenhum resultado é produzido, o motivo
   exato é apresentado na própria linha do indicador e a conformidade permanece indefinida.
6. **Given** um indicador cuja contagem real é zero, **When** o elaborador informa zero,
   **Then** o valor é aceito e tratado como medição legítima, indistinguível visualmente de
   qualquer outro número apurado.
7. **Given** um arquivo de evidência de tipo não permitido ou cujo conteúdo real diverge da
   extensão declarada, **When** o elaborador tenta anexá-lo, **Then** o envio é recusado com
   mensagem clara e nada é gravado.
8. **Given** um relatório com anexo ainda não liberado pela verificação de segurança, **When**
   o elaborador tenta submeter, **Then** a submissão é bloqueada com a pendência identificada.
9. **Given** um usuário sem permissão de escrita sobre a unidade, **When** ele tenta alterar
   qualquer valor, **Then** a alteração é recusada pelo servidor, independentemente do que a
   interface tenha exibido.

---

### User Story 2 - Revisar localmente e submeter à contraprova da Matriz (Priority: P2)

O supervisor técnico da unidade recebe o relatório submetido, confere e edita diretamente os
valores pelos quais responderá solidariamente, e o envia à Matriz. Na Matriz, o analista
aprovador percorre o relatório **indicador por indicador**, vendo valores informados, resultado,
conformidade, análise crítica, plano de ação e evidências, e emite um veredito individual —
aprovar ou reprovar — sempre acompanhado de justificativa técnico-operacional obrigatória e,
opcionalmente, de evidência da própria contraprova. Ao final, finaliza o relatório ou o devolve
à unidade.

**Why this priority**: É o que substitui a consolidação manual em planilhas e transforma o
relatório de declaração unilateral em documento verificado. Sem ela, o acervo não tem
autoridade.

**Independent Test**: Sobre um relatório submetido, emitir vereditos em todos os indicadores e
executar a finalização, verificando os dois desfechos possíveis (concluído / devolvido) e a
persistência da justificativa de cada veredito.

**Acceptance Scenarios**:

1. **Given** um relatório em revisão, **When** o revisor o submete para aprovação, **Then**
   todo indicador que ainda não esteja aprovado passa a pendente de validação.
2. **Given** um indicador pendente de validação, **When** o aprovador emite veredito sem
   preencher a justificativa, **Then** o veredito é recusado e nada é registrado.
3. **Given** um veredito emitido, **When** ele é persistido, **Then** o registro é imutável e
   preserva autor, veredito, justificativa integral, data e anexos.
4. **Given** um relatório com ao menos um indicador ainda pendente de validação ou em revisão,
   **When** o aprovador tenta finalizar, **Then** a finalização é recusada com a pendência
   identificada.
5. **Given** um relatório com todos os indicadores aprovados, **When** o aprovador finaliza,
   **Then** o relatório passa a concluído, é travado para escrita e sua nota é congelada.
6. **Given** um relatório com ao menos um indicador reprovado, **When** o aprovador finaliza,
   **Then** o relatório retorna à revisão, recebe prazo estendido automático e o contador de
   reprovas é incrementado.
7. **Given** um relatório devolvido, **When** a unidade reabre a edição, **Then** os
   indicadores reprovados voltam a exigir correção, os aprovados e não alterados permanecem
   aprovados, e qualquer indicador aprovado que seja alterado volta imediatamente a exigir nova
   contraprova.
8. **Given** um relatório devolvido, **When** a unidade conclui as correções, **Then** quem
   reabre o ciclo é o revisor — não há retorno ao estado inicial de elaboração após a primeira
   submissão do período.
9. **Given** que uma transição de fluxo ocorreu, **When** a notificação aos responsáveis
   falha, **Then** a transição permanece persistida e o ciclo prossegue, com a falha
   registrada.
10. **Given** que revisor e elaborador editam o mesmo indicador simultaneamente durante a
    reabertura, **When** o segundo tenta gravar sobre uma versão que já não é a corrente,
    **Then** a gravação é recusada e ele vê o valor que chegou primeiro, quem o informou e
    quando, podendo então decidir conscientemente se o sobrescreve — nenhuma sobrescrita
    silenciosa ocorre.

---

### User Story 3 - Enxergar desempenho e prazo em um olhar (Priority: P3)

Qualquer perfil abre a plataforma e vê, na tela inicial, o histórico de relatórios das unidades
que enxerga, com filtros por unidade, estado e intervalo de períodos, busca por sigla ou nome,
ordenação, a nota final de cada relatório concluído, a proximidade ou o estouro do prazo da
fase corrente e a tendência da nota ao longo do tempo. A nota traduz o desempenho em um número
objetivo de 0 a 10, comparável entre unidades e ao longo do tempo, com desconto por entrega
fora do prazo.

**Why this priority**: Converte o acervo em instrumento de gestão. Depende de haver relatórios
concluídos (P1 e P2), mas é o que dá à GCINFRA visibilidade comparável entre unidades.

**Independent Test**: Com relatórios concluídos em períodos distintos, verificar composição da
nota, aplicação do desconto por atraso, congelamento após a finalização e a leitura de prazo e
tendência na tela inicial.

**Acceptance Scenarios**:

1. **Given** um indicador que atingiu a meta **e** foi aprovado na contraprova, **When** a nota
   é composta, **Then** o peso do indicador entra na soma.
2. **Given** um indicador que atingiu a meta mas foi **reprovado** na contraprova, **When** a
   nota é composta, **Then** o peso não entra na soma.
3. **Given** um indicador sem resultado apurado, **When** a nota é composta, **Then** o peso
   não entra na soma e a escala **não** é reescalonada — a nota máxima continua sendo 10 e a
   unidade perde os pontos.
4. **Given** uma etapa entregue após o prazo vigente, **When** a nota final é calculada,
   **Then** o desconto configurado é subtraído uma vez por etapa atrasada, e a nota nunca fica
   abaixo de zero.
5. **Given** um relatório devolvido e reenviado dentro do prazo estendido, **When** a
   pontualidade da nova submissão é aferida, **Then** ela é medida contra o prazo estendido, e
   não contra o prazo original.
6. **Given** uma unidade que já havia estourado o prazo antes da devolução, **When** o prazo é
   estendido, **Then** o atraso pretérito permanece registrado — a extensão perdoa o ciclo
   novo, nunca o atraso anterior.
7. **Given** um relatório concluído, **When** pesos ou parâmetros de pontuação são alterados
   depois, **Then** a nota emitida permanece inalterada.
8. **Given** um relatório submetido mais de uma vez, **When** o histórico é consultado, **Then**
   cada submissão aparece com etapa, autor, data, prazo vigente aferido e resultado — nenhuma
   submissão anterior é sobrescrita.
9. **Given** períodos sem nota em uma série histórica, **When** a tendência é exibida, **Then**
   eles aparecem como lacuna, jamais como zero.

---

### User Story 4 - Evoluir a estrutura de governança sem desenvolvimento (Priority: P4)

O administrador da GCINFRA cria e edita formulários, seções temáticas e indicadores — título,
objetivo, variáveis de entrada, expressão de cálculo, operador e valor de meta, peso, marcação
de dado estrutural estável — pela própria interface, sem ciclo de desenvolvimento. Distribui os
pesos automaticamente ou define-os manualmente, mantém o catálogo canônico que dá identidade
comum a métricas equivalentes entre formulários diferentes, e ajusta os parâmetros operacionais
da plataforma: prazos, desconto por atraso, padrão de nome dos arquivos exportados e janela de
retenção das evidências.

**Why this priority**: É o que permite ao produto acompanhar a evolução da governança sem
depender de deploy. Sem ela, cada mudança de meta vira pedido de desenvolvimento.

**Independent Test**: Criar um formulário completo com seções e indicadores, balancear pesos,
vincular a uma unidade, alterar um parâmetro de prazo e verificar que relatórios futuros
refletem a mudança enquanto os já emitidos permanecem inalterados.

**Acceptance Scenarios**:

1. **Given** uma expressão de cálculo que referencia uma variável não declarada, **When** o
   administrador tenta salvá-la, **Then** o cadastro é recusado com mensagem explícita.
2. **Given** uma expressão que contém caractere fora do conjunto permitido, **When** o
   administrador tenta salvá-la, **Then** o cadastro é recusado.
3. **Given** um formulário cuja soma dos pesos ativos não é exatamente 10, **When** o
   administrador tenta vinculá-lo a uma unidade ou instanciar relatório, **Then** a operação é
   recusada e o formulário é sinalizado como pendente de balanceamento — sem impedir que ele
   seja salvo e corrigido.
4. **Given** um formulário balanceado, **When** o administrador inativa, ativa ou cria um
   indicador, **Then** a redistribuição dos pesos restantes é apresentada e exigida para
   confirmar a operação.
5. **Given** um pedido de distribuição automática de 10 pontos entre um número de indicadores
   que não divide exatamente, **When** a distribuição é executada, **Then** a soma resultante é
   exatamente 10.
6. **Given** um indicador em cadastro, **When** o administrador não informa código canônico,
   **Then** o cadastro é recusado; e a criação de uma entrada nova de catálogo é oferecida sem
   que ele precise abandonar o formulário.
7. **Given** uma entrada de catálogo com indicadores ativos vinculados, **When** o
   administrador tenta desativá-la, **Then** a operação é recusada até que os vínculos sejam
   realocados.
8. **Given** uma entrada de catálogo já vinculada a algum indicador, **When** o administrador
   tenta alterar sua unidade de medida, **Then** a alteração é recusada.
9. **Given** uma alteração de meta, fórmula ou peso, **When** ela é salva, **Then** ela afeta
   apenas relatórios futuros; relatórios já instanciados permanecem coerentes com a regra
   vigente à época.
10. **Given** o campo de janela de retenção de evidências, **When** o administrador seleciona a
    opção de retenção ilimitada, **Then** a interface explicita, antes da confirmação, que
    arquivos gravados sob ela não poderão ser removidos por ninguém em nenhuma hipótese, e
    exige confirmação em diálogo dedicado, distinto do salvamento comum.
11. **Given** que a janela de retenção foi reduzida, **When** a alteração é salva, **Then** ela
    vale apenas para gravações futuras e a interface deixa claro que o acervo já gravado não é
    liberado.

---

### User Story 5 - Administrar pessoas e unidades sem jamais excluir (Priority: P5)

O administrador cria e mantém usuários — matrícula, nome, e-mail, cargo, perfil de acesso,
unidade de lotação e acessos de leitura adicionais — e unidades — sigla, nome, logotipo, nível
de complexidade e formulário associado. Desligamento de pessoal e encerramento de unidade são
desativações lógicas, nunca exclusões, preservando a integridade de todo relatório já emitido
por aquela pessoa ou unidade.

**Why this priority**: Habilita a operação em escala real. Em ambiente de teste os usuários
podem ser provisionados por carga inicial, o que mantém P1–P4 testáveis sem esta história.

**Independent Test**: Criar usuário e unidade, conceder e revogar acesso adicional, desativar e
reativar ambos, verificando que relatórios históricos permanecem íntegros e legíveis após a
desativação.

**Acceptance Scenarios**:

1. **Given** um usuário com relatórios elaborados no passado, **When** o administrador o
   desativa, **Then** ele perde o acesso, mas sua autoria permanece legível em todo o acervo.
2. **Given** uma unidade com histórico, **When** o administrador a desativa, **Then** nenhum
   relatório é perdido e o histórico continua consultável.
3. **Given** um usuário com acesso de leitura concedido a uma segunda unidade, **When** o
   acesso é revogado, **Then** a perda de visibilidade é imediata, sem intervalo de tolerância.
4. **Given** qualquer entidade de negócio, **When** uma exclusão física é tentada por qualquer
   via da aplicação, **Then** ela não é possível.
5. **Given** uma alteração administrativa qualquer, **When** ela é persistida, **Then** autor,
   data, valor anterior e valor novo ficam registrados.

---

### User Story 6 - Consultar o acervo como base de auditoria (Priority: P6)

Qualquer perfil, dentro do escopo de unidades que já enxerga, consulta o acervo cruzando
período, unidade, nível, indicador, estado, conformidade, veredito, pontualidade, faixa de nota
e — no modo detalhado — autor e tipo de evento. Os seletores são encadeados: escolher unidades
ou níveis restringe a lista de indicadores às métricas efetivamente elegíveis. O modo básico
responde *o que foi apurado*; o modo detalhado responde *o que foi apurado, por quem, a partir
de quê e o que mudou no caminho* — cada variável de entrada, a expressão e a meta vigentes à
época, cada edição com valor anterior e novo, evidências, vereditos com justificativa integral,
transições de estado e pontualidade.

**Why this priority**: É o que torna o acervo defensável perante um auditor externo, e o que
diferencia a plataforma de um repositório de indicadores.

**Independent Test**: Executar a consulta canônica de referência — *"período de X a Y, todas as
unidades, indicador de quantitativo de servidores"* — e verificar a série histórica retornada,
unidade a unidade, mês a mês, com a semântica de ausência correta em cada célula.

**Acceptance Scenarios**:

1. **Given** uma seleção contendo apenas unidades de um nível, **When** o usuário abre o
   seletor de indicadores, **Then** apenas métricas elegíveis para aquela seleção são
   oferecidas.
2. **Given** uma consulta que cruza unidades de níveis diferentes, **When** o resultado é
   montado, **Then** as colunas resultam da união dos indicadores elegíveis e toda célula sem
   correspondência é marcada com o código de ausência exato — nunca com zero nem com vazio
   silencioso.
3. **Given** uma unidade que mudou de nível no meio do intervalo consultado, **When** a série é
   exibida, **Then** os meses anteriores à transição reportam ausência por inaplicabilidade
   para os indicadores exclusivos do nível novo, e os meses posteriores reportam valores.
4. **Given** uma combinação de filtros válida sem nenhum registro correspondente, **When** a
   consulta é executada, **Then** a plataforma informa explicitamente o conjunto vazio e **não**
   amplia período, não remove unidade, não afrouxa recorte nem sugere alternativas.
5. **Given** qualquer tabela ou arquivo produzido pela consulta, **When** ele é apresentado,
   **Then** a legenda dos códigos de ausência o acompanha — na tela e no arquivo, nunca apenas
   como dica de passagem do mouse.
6. **Given** qualquer média ou taxa exibida, **When** ela é apresentada, **Then** o número de
   observações válidas que a produziu é exibido junto, e a diferença para o total de células é
   visível.
7. **Given** células ausentes em um recorte, **When** uma agregação é calculada, **Then** elas
   ficam fora do denominador e nenhuma inferência, interpolação ou repetição de valor anterior
   é aplicada.
8. **Given** um valor estatisticamente atípico, **When** ele é sinalizado, **Then** a
   sinalização é apenas indicação para inspeção humana, com a regra estatística declarada na
   interface, e não altera conformidade, nota ou estado.
9. **Given** a mesma consulta executada duas vezes sobre o mesmo acervo, **When** os resultados
   são comparados, **Then** eles são idênticos, inclusive na ordem das linhas.
10. **Given** um usuário de escopo restrito, **When** ele consulta a área de auditoria, **Then**
    ele enxerga exatamente as unidades que já enxergava nas demais telas — nenhum acesso novo é
    introduzido.
11. **Given** um resultado de alto volume, **When** o usuário navega, **Then** a navegação é
    contínua ou anterior/próxima, com contagem aproximada ou teto informado, e nenhuma consulta
    retorna conjunto ilimitado.
12. **Given** que o usuário ocultou colunas ou reordenou o resultado, **When** o conjunto é
    reavaliado, **Then** nenhuma linha é removida e nenhuma agregação muda — ordenação e
    visibilidade são apresentação, nunca filtro.

---

### User Story 7 - Emitir documento verificável por terceiro (Priority: P7)

Qualquer usuário exporta um relatório concluído ou uma consulta de auditoria em documento de
apresentação, planilha ou formato de integração. O documento espelha o conteúdo com o veredito
de cada indicador, traz a assinatura eletrônica do aprovador responsável com nome, cargo e
unidade, e carrega um selo de integridade com código de verificação e QR code. Um auditor
externo, de posse apenas da via impressa, escaneia o QR e confirma — sem credencial e sem
acesso ao sistema — que o documento saiu do FormOps e não foi alterado depois.

**Why this priority**: É a entrega final do acervo ao mundo externo, e a única forma de a
plataforma sustentar sua utilidade em auditoria sem exigir que o auditor tenha acesso a ela.

**Independent Test**: Exportar um relatório concluído nos três formatos, verificar o selo pelo
verificador público, alterar um único byte do arquivo e confirmar que a verificação passa a
acusar adulteração.

**Acceptance Scenarios**:

1. **Given** um mesmo recorte de conteúdo, **When** ele é exportado nos três formatos, **Then**
   os três compartilham a mesma prova de conteúdo — o selo atesta o dado, não o arquivo.
2. **Given** um arquivo exportado, **When** um único byte dele é alterado, **Then** a
   verificação distingue o caso: conteúdo íntegro com arquivo adulterado.
3. **Given** um artefato que não corresponde a nada emitido, **When** ele é verificado,
   **Then** a verificação acusa divergência de conteúdo.
4. **Given** uma via impressa sem arquivo digital para conferir, **When** o auditor consulta o
   código, **Then** a prova registrada do arquivo é exibida para que ele a confronte com o
   arquivo que recebeu.
5. **Given** o verificador público, **When** um código válido é consultado, **Then** são
   exibidos veredito de integridade, unidade, período, estado do relatório, nome e cargo do
   aprovador, data de emissão e a prova — e **nenhum** valor de indicador, análise, plano de
   ação ou evidência.
6. **Given** um código inexistente ou malformado, **When** ele é consultado, **Then** a resposta
   não permite distinguir os dois casos, inclusive pelo tempo de resposta.
7. **Given** um selo revogado pelo administrador, **When** ele é verificado, **Then** o
   verificador responde revogado, com motivo e data, e o registro original permanece intacto.
8. **Given** uma exportação parcial ou que retornou conjunto vazio, **When** ela é emitida,
   **Then** ela também recebe selo.
9. **Given** um arquivo de planilha contendo justificativa iniciada por caractere de fórmula,
   **When** ele é aberto pelo auditor, **Then** o conteúdo é lido como texto e não é executado.
10. **Given** uma exportação de consulta de auditoria, **When** o arquivo é gerado, **Then**
    ele carrega filtros aplicados na íntegra (inclusive os que não retornaram dados), modo de
    visualização, colunas e ordenação vigentes, escopo do solicitante, legenda de ausência,
    autoria da extração e o número de observações de cada agregação.
11. **Given** a indisponibilidade da plataforma, **When** o auditor possui o documento e a
    chave pública publicada, **Then** ele ainda consegue conferir a assinatura.

---

### User Story 8 - Consumir o acervo consolidado em ferramenta de BI (Priority: P8)

A Diretoria e os analistas corporativos analisam o acervo na ferramenta de BI corporativa, sem
que ela leia as tabelas operacionais da plataforma. A camada de consumo expõe apenas relatórios
concluídos, preserva a semântica de ausência, usa metas e pesos congelados à época e reproduz a
nota calculada na finalização. O analista parte do valor final e desce, em poucos passos, até a
decomposição do cálculo, o histórico de quem informou e alterou, e o arquivo de evidência.

**Why this priority**: Amplia o alcance do acervo à gestão corporativa. Depende de haver
relatórios concluídos e é a última camada da Etapa 1.

**Independent Test**: A partir de um valor apurado na ferramenta de BI, percorrer a cadeia até
a evidência anexada, verificando que cada elo é alcançável e que nenhum número diverge do que a
área de auditoria interna apresenta.

**Acceptance Scenarios**:

1. **Given** relatórios em qualquer estado que não seja concluído, **When** a camada analítica
   é consultada, **Then** eles não aparecem — nenhum número provisório circula como
   consolidado.
2. **Given** uma célula inaplicável, **When** ela atravessa para a camada analítica, **Then** a
   marcação de aplicabilidade a acompanha e nenhuma agregação de BI a trata como zero.
3. **Given** uma meta alterada após a emissão de um relatório, **When** o BI lê aquele
   relatório, **Then** ele enxerga a meta vigente à época, não a atual.
4. **Given** a camada analítica, **When** qualquer escrita é tentada a partir do BI, **Then**
   ela é recusada.
5. **Given** uma mesma pergunta feita à área de auditoria interna e ao BI, **When** as
   respostas divergem, **Then** isso é um defeito, não uma interpretação alternativa.
6. **Given** um vínculo de evidência exibido no BI, **When** o analista clica, **Then** ele
   acessa o arquivo sem possuir conta na plataforma, dentro de uma janela curta e uma única
   vez; a segunda tentativa apresenta tela amigável de expiração, nunca um erro cru.
7. **Given** qualquer acesso originado do BI, **When** ele ocorre — bem-sucedido, expirado ou
   já consumido —, **Then** ele é registrado.
8. **Given** o endereço real do armazenamento de evidências, **When** o BI exibe o vínculo,
   **Then** esse endereço nunca aparece — apenas o domínio da plataforma.

---

### Edge Cases

- **Herança parcial de dados estruturais.** A definição do indicador mudou entre os meses e
  alguma chave não pôde ser herdada → a resposta é marcada como parcial e sinalizada; chaves
  removidas da definição vigente são descartadas na herança mas permanecem íntegras no
  histórico do período anterior.
- **Cálculo impossível.** Variável ausente, denominador zero ou resultado fora do domínio →
  nenhum resultado, motivo apresentado ao usuário, conformidade indefinida, peso fora da nota.
- **Valor de fronteira.** Um resultado como 97,995 contra meta de 98 não pode ter sua
  conformidade decidida por arredondamento de exibição.
- **Indicador aprovado e depois alterado.** Durante a reabertura por reprova, alterar um
  indicador já aprovado invalida a contraprova anterior no instante da edição — não na
  devolução.
- **Formulário desbalanceado.** Soma dos pesos diferente de 10 é estado transitório admitido:
  o formulário persiste e é corrigível, mas não vincula unidades nem instancia relatórios.
- **Unidade que troca de nível.** A aplicabilidade de um indicador em um mês passado é decidida
  pelo que a unidade de fato tinha a preencher naquele mês, nunca pelo formulário que ela tem
  hoje.
- **Anexo com detecção positiva.** O arquivo é bloqueado para download, retido para perícia e o
  evento é registrado; ele nunca ingressa no acervo sob retenção imutável.
- **Retenção ilimitada.** Uma vez gravado sob ela, o arquivo é permanente — reverter o
  parâmetro afeta apenas gravações futuras.
- **Edição simultânea do mesmo indicador.** Durante a reabertura por reprova, revisor e
  elaborador editam colaborativamente. A segunda gravação sobre uma versão que já não é a
  corrente é recusada, e o autor decide conscientemente se sobrescreve — a plataforma nunca
  descarta trabalho em silêncio nem registra a sobrescrita como se fosse correção deliberada.
- **Falha de serviço acessório.** Indisponibilidade de e-mail ou de armazenamento não reverte
  submissão nem aprovação já persistida.
- **Muitos usuários atrás de um mesmo endereço público.** As unidades são hospitais cujo
  tráfego sai por poucos endereços compartilhados: erro de senha de um usuário não pode
  derrubar o acesso da unidade inteira.
- **Feriado móvel.** A Sexta-Feira Santa varia a cada ano e entra no cálculo de dias úteis;
  Carnaval e Corpus Christi não entram por padrão, por serem pontos facultativos que variam por
  órgão e município.
- **Consulta de amplitude excessiva.** Intervalos além do limite configurado são recusados com
  orientação, e o modo detalhado opera sob limite mais estrito que o básico, declarado antes da
  execução.
- **Busca dentro de resultado extenso.** A busca alcança o conjunto inteiro, não apenas o
  trecho visível na tela — concluir que um registro não existe porque ele não está renderizado
  é inaceitável.
- **Cron não executado.** Se a abertura automática do período falhar ou atrasar, o elaborador
  pode abrir o período corrente da sua unidade sob demanda.

## Requirements *(mandatory)*

### Functional Requirements

#### Identidade, acesso e escopo

- **FR-001**: O sistema MUST autenticar o colaborador por matrícula **ou** e-mail
  institucional, acompanhados de senha.
- **FR-002**: O sistema MUST manter a sessão inacessível a scripts executando na página e MUST
  oferecer encerramento e renovação de sessão como operações de servidor.
- **FR-003**: O sistema MUST associar cada usuário a exatamente um perfil de acesso e uma
  unidade de lotação, admitindo concessões de leitura adicionais a outras unidades.
- **FR-004**: O sistema MUST suportar cinco perfis com poderes distintos: observador (leitura),
  elaborador (preenche a própria unidade), revisor (valida e edita a própria unidade),
  aprovador (contraprova, escopo organizacional) e administrador (irrestrito).
- **FR-005**: O sistema MUST revalidar autenticação, perfil e escopo de unidade a cada
  requisição. Filtragem de menus e rotas no cliente MUST ser tratada como conveniência de uso,
  nunca como controle de acesso.
- **FR-006**: Toda superfície de leitura — tela inicial, elaboração, validação, auditoria,
  exportação e agregação — MUST respeitar o mesmo escopo de unidades do usuário, sem exceção.
- **FR-007**: A revogação de acesso a uma unidade MUST produzir efeito imediato, sem intervalo
  de tolerância.
- **FR-008**: O sistema MUST limitar a taxa de requisições e MUST aplicar limite mais estrito
  ao ponto de autenticação.
- **FR-009**: O bloqueio automático por tentativas sucessivas rejeitadas MUST ser primariamente
  por conta, e não por endereço de origem; bloqueio por endereço MUST atuar apenas como camada
  secundária, com limiar mais alto e janela curta, admitindo lista de exceção para os endereços
  de saída conhecidos das unidades. Todo bloqueio e desbloqueio MUST ser registrado.

#### Ciclo de vida do relatório e prazos

- **FR-010**: O sistema MUST abrir automaticamente, no primeiro dia útil de cada mês, a
  instância do relatório de cada unidade ativa, sem intervenção humana.
- **FR-011**: O elaborador MUST poder abrir o período corrente da sua unidade sob demanda, caso
  a abertura automática ainda não tenha ocorrido.
- **FR-012**: Uma unidade MUST ter no máximo um relatório por período de referência.
- **FR-013**: O sistema MUST governar as transições: pendente → em revisão (elaborador); em
  revisão → pendente de aprovação (revisor); pendente de aprovação → concluído ou retorno a em
  revisão (aprovador).
- **FR-014**: O sistema MUST calcular prazos em dias úteis, desconsiderando fins de semana e os
  feriados nacionais de observância obrigatória, incluindo os móveis derivados da Páscoa.
- **FR-015**: A inclusão de pontos facultativos (Carnaval e Corpus Christi) no cálculo MUST ser
  configurável e MUST vir desligada.
- **FR-016**: Os limites de elaboração, revisão e aprovação, e a extensão concedida por
  reprova, MUST ser parâmetros administráveis, com padrões de 6º, 8º e 10º dia útil e 2 dias
  úteis de extensão.
- **FR-017**: Na reprova, o sistema MUST devolver o relatório à unidade, incrementar o contador
  de reprovas e calcular novo prazo limite, reabrindo a edição para revisor e elaborador da
  mesma unidade.
- **FR-018**: Após a primeira submissão de um período, o sistema MUST NOT permitir retorno ao
  estado inicial de elaboração.
- **FR-019**: Um relatório concluído MUST ser travado para escrita.
- **FR-020**: O sistema MUST varrer periodicamente o estouro de prazo e notificar os
  responsáveis da fase corrente.

#### Dados estruturais estáveis (estado residente)

- **FR-021**: Indicadores marcados como dados estruturais estáveis MUST ter seus valores
  herdados do período anterior da mesma unidade na abertura do novo período.
- **FR-022**: A herança MUST ocorrer por correspondência de **chave declarada**, nunca por
  posição.
- **FR-023**: Chave presente na definição vigente e ausente no período anterior MUST ficar não
  preenchida — MUST NOT receber zero nem valor de outra chave.
- **FR-024**: Herança incompleta MUST ser marcada como parcial e sinalizada ao elaborador para
  conferência.
- **FR-025**: Todo valor herdado MUST ser visualmente distinguível como herdado e ainda não
  conferido no período corrente.

#### Cálculo e aferição de conformidade

- **FR-026**: A definição matemática de um indicador MUST ser dado administrável, não código.
- **FR-027**: O sistema MUST recusar expressão que contenha caractere fora do conjunto
  permitido ou que referencie variável não declarada, com mensagem explícita.
- **FR-028**: O sistema MUST NOT produzir resultado silencioso, indefinido, infinito ou zero de
  conveniência. Variável ausente, denominador zero ou resultado fora do domínio MUST produzir
  ausência de resultado, com o motivo registrado e apresentado na própria linha do indicador.
- **FR-029**: Sem resultado apurado, a conformidade MUST permanecer indefinida — o indicador
  não é conforme nem não conforme.
- **FR-030**: Zero MUST ser aceito como entrada legítima e tratado como qualquer outro número
  apurado.
- **FR-031**: O cálculo MUST operar em precisão decimal, de modo que arredondamento de exibição
  nunca decida conformidade em valor de fronteira; o arredondamento MUST ocorrer uma única vez,
  ao final.

#### Congelamento da definição

- **FR-032**: Na instanciação do relatório, cada indicador MUST ser congelado na resposta —
  título, objetivo, chaves, expressão, operador e valor de meta, peso e código canônico.
- **FR-033**: Alteração de definição MUST afetar apenas relatórios futuros; relatórios já
  instanciados MUST permanecer coerentes com a regra vigente à época.

#### Evidências

- **FR-034**: O sistema MUST permitir anexar múltiplas evidências por indicador e evidências de
  contraprova aos vereditos.
- **FR-035**: O sistema MUST aceitar apenas os tipos de arquivo de uma lista fechada, MUST
  limitar o tamanho por arquivo, e MUST decidir a aceitação pelo **conteúdo real** do arquivo,
  exigindo coerência entre extensão, tipo declarado e conteúdo. Divergência MUST resultar em
  recusa, nunca em correção silenciosa.
- **FR-036**: O nome do arquivo armazenado MUST ser gerado pelo sistema, nunca o nome enviado
  pelo cliente.
- **FR-037**: Toda evidência MUST ser submetida a verificação de segurança antes de ser
  considerada disponível, com três estados distinguíveis: pendente de verificação, liberada e
  bloqueada por detecção.
- **FR-038**: Um relatório MUST NOT avançar de etapa enquanto possuir anexo pendente de
  verificação.
- **FR-039**: Arquivo com detecção positiva MUST ser bloqueado para download, retido para
  perícia e registrado, e MUST NOT ingressar no acervo sob retenção imutável.
- **FR-039a**: A guarda pericial MUST durar 1 ano, prazo próprio e independente da janela de
  retenção das evidências, com expurgo automático ao término. A liberação antecipada MUST ser
  possível ao administrador e MUST ser registrada com autor, motivo e data.
- **FR-040**: A entrega de evidência MUST ocorrer por vínculo de vida curta gerado sob demanda,
  entregue como transferência de arquivo e servida a partir de origem distinta da aplicação.
- **FR-041**: Evidência removida MUST permanecer no acervo, marcada como desativada, com autor
  e data, e MUST continuar visível em auditoria, exportação e camada analítica.
- **FR-042**: O acervo de evidências MUST ser gravado sob retenção imutável durante a janela
  configurada, de modo que nenhum arquivo possa ser sobrescrito ou removido durante ela — nem
  por quem detenha a credencial mais privilegiada.
- **FR-043**: A janela de retenção MUST ser parâmetro administrável, com padrão de 10 anos, e
  MUST ser carimbada em cada arquivo no ato da gravação. Alteração do parâmetro MUST afetar
  apenas gravações futuras.
- **FR-044**: A opção de retenção ilimitada MUST ser oferecida, MUST ser precedida de
  explicação inequívoca da irreversibilidade acessível por clique e por teclado, e MUST exigir
  confirmação em diálogo dedicado, distinto do salvamento comum.

#### Contraprova e finalização

- **FR-045**: O aprovador MUST dispor de superfície que apresente, por indicador, valores
  informados, resultado, conformidade, análise crítica, plano de ação e evidências.
- **FR-046**: Todo veredito MUST exigir justificativa técnico-operacional e MUST admitir anexo
  de evidência da própria contraprova.
- **FR-047**: O registro de veredito MUST ser imutável, preservando autor, veredito,
  justificativa integral, data e anexos.
- **FR-048**: A finalização MUST ser recusada enquanto qualquer indicador não tiver veredito.
- **FR-049**: Um relatório MUST atingir o estado concluído apenas quando 100% dos seus
  indicadores estiverem aprovados.
- **FR-050**: Durante a reabertura por reprova, indicador aprovado e não alterado MUST
  permanecer aprovado; indicador aprovado que seja alterado MUST voltar a exigir contraprova no
  instante da alteração.

#### Pontuação

- **FR-051**: O sistema MUST compor a nota somando os pesos dos indicadores que satisfaçam
  **ambas** as condições: conformes com a meta **e** aprovados na contraprova.
- **FR-052**: Indicador sem resultado apurado MUST NOT pontuar, e a escala MUST NOT ser
  reescalonada para compensar — a nota máxima permanece 10.
- **FR-053**: A soma dos pesos dos indicadores ativos de um formulário MUST ser exatamente 10
  para que ele seja operável.
- **FR-054**: O sistema MUST oferecer distribuição automática de pesos cuja soma resultante
  seja exatamente 10, inclusive quando a divisão não for exata.
- **FR-055**: O sistema MUST aplicar desconto por etapa entregue fora do prazo, no máximo duas
  vezes, com valor administrável e padrão de 2 pontos, e a nota final MUST NOT ficar abaixo de
  zero.
- **FR-056**: A pontualidade de uma submissão MUST ser aferida contra o prazo **vigente** — o
  estendido, quando houver extensão concedida.
- **FR-057**: Atraso ocorrido antes de uma devolução MUST permanecer registrado; a extensão
  MUST NOT perdoar atraso pretérito.
- **FR-058**: Cada submissão MUST gerar registro próprio com etapa, autor, data, prazo vigente
  aferido e resultado da aferição; nenhuma submissão anterior MUST ser sobrescrita.
- **FR-059**: Nota, desconto aplicado e marcadores de pontualidade MUST ser calculados uma
  única vez, na finalização, e MUST NOT ser recalculados depois.

#### Governança da estrutura

- **FR-060**: O administrador MUST poder criar, editar e desativar formulários, seções e
  indicadores pela interface, sem ciclo de desenvolvimento.
- **FR-061**: Criar, ativar ou inativar indicador MUST exigir a redistribuição dos pesos como
  parte da operação; formulário desbalanceado MUST ser sinalizado, MUST permanecer salvo e
  corrigível, e MUST NOT vincular novas unidades nem instanciar novos relatórios.
- **FR-062**: Todo indicador MUST possuir código canônico que lhe dê identidade comum a
  métricas equivalentes em formulários diferentes.
- **FR-063**: O cadastro de indicador MUST oferecer busca no catálogo e criação de entrada nova
  sem exigir que o administrador abandone o formulário.
- **FR-064**: Entrada de catálogo com indicadores ativos vinculados MUST NOT ser desativável, e
  sua unidade de medida MUST NOT ser alterável após o primeiro vínculo.
- **FR-065**: Indicadores com unidades de medida distintas MUST NOT ser agregados entre si.
- **FR-066**: Prazos, desconto por atraso, padrão de nome dos arquivos exportados, janela de
  retenção e limites de amplitude de consulta MUST ser parâmetros administráveis sem deploy.

#### Não-destrutividade e rastreabilidade

- **FR-067**: O sistema MUST NOT permitir exclusão física de entidade de negócio; desativação
  lógica MUST ser o único mecanismo de encerramento.
- **FR-068**: Nenhuma informação de histórico MUST ser sobrescrita: correção MUST criar registro
  novo, preservando o anterior consultável.
- **FR-069**: Toda alteração MUST registrar o que mudou, quem alterou — com nome, cargo, perfil
  e lotação preservados como eram no momento do evento —, valor anterior, valor novo, quando,
  de qual endereço, por qual cliente, por qual canal, e sob qual correlação de requisição.
- **FR-070**: O registro de alterações MUST ser somente-acréscimo; a aplicação MUST NOT expor
  qualquer operação de alteração ou remoção sobre ele.
- **FR-071**: Ações não humanas — abertura automática de período, cargas iniciais — MUST
  declarar ator de sistema identificável; MUST NOT aparecer como autoria nula.
- **FR-072**: Superfícies públicas por especificação MUST declarar explicitamente o ator
  anônimo, distinguindo "ninguém autenticado, e sabemos disso" de "não sabemos quem foi".
- **FR-073**: O sistema MUST registrar também os **acessos de leitura** sensíveis: consultas de
  auditoria com filtros, escopo e volume; exportações; downloads de evidência; verificações de
  selo; e autenticações bem-sucedidas e falhas.
- **FR-074**: O cargo do usuário MUST ser dado próprio, distinto do perfil de acesso.
- **FR-074a**: Os registros de alteração e de acesso MUST ser retidos por, no mínimo, a janela
  de retenção vigente das evidências — 10 anos por padrão —, acompanhando-a caso ela seja
  ampliada. O expurgo MUST ocorrer apenas por procedimento aprovado e registrado; a aplicação
  MUST NOT dispor de qualquer meio de removê-los.

#### Consulta de auditoria

- **FR-075**: O sistema MUST permitir consultar o acervo por três eixos combináveis — unidade,
  relatório e indicador — respondendo à consulta canônica de referência de uma métrica ao longo
  do tempo em várias unidades.
- **FR-076**: Os filtros MUST ser encadeados e reativos: a seleção corrente MUST restringir as
  opções subsequentes às efetivamente elegíveis.
- **FR-077**: Cada seletor de lista extensa MUST possuir busca interna que apenas localiza item
  na lista — MUST NOT alterar, ampliar ou reinterpretar a consulta submetida.
- **FR-078**: O sistema MUST oferecer modo básico (o resultado) e modo detalhado (o resultado e
  toda a sua construção: composição do valor, autoria e cronologia, evidências, vereditos, ciclo
  de vida, herança e pontualidade).
- **FR-079**: A área de auditoria MUST ser superfície de leitura da trilha existente, MUST NOT
  ser segunda fonte de verdade.
- **FR-080**: O sistema MUST distinguir rigorosamente cinco representações e MUST NOT
  colapsá-las: valor apurado; zero medido; ausência por inaplicabilidade ao nível; ausência por
  indicador inativo no período; e não preenchido.
- **FR-081**: A decisão de aplicabilidade MUST derivar do que a unidade de fato tinha a
  preencher naquele período, MUST NOT consultar o formulário vigente hoje.
- **FR-082**: O sistema MUST NOT substituir ausência por zero, MUST NOT quebrar a consulta por
  ausência de dado, e MUST acompanhar toda tabela e todo arquivo de legenda explícita dos
  códigos de ausência.
- **FR-083**: Consulta válida sem resultado MUST informar explicitamente o conjunto vazio; o
  sistema MUST NOT ampliar período, remover unidade, afrouxar recorte nem sugerir alternativas.
- **FR-084**: Consulta que cruza níveis diferentes MUST produzir o conjunto de colunas pela
  união dos indicadores elegíveis e MUST preencher toda célula sem correspondência com o código
  de ausência exato, sem degradar nem falhar.
- **FR-085**: Toda métrica derivada MUST exibir o número de observações válidas que a produziu,
  e a diferença para o total de células MUST ser visível.
- **FR-086**: Nenhuma inferência MUST substituir dado ausente — sem imputação, sem interpolação,
  sem repetição do último valor conhecido.
- **FR-087**: Valores atípicos MUST ser sinalizados por regra estatística declarada na
  interface, como indicação para inspeção humana; a sinalização MUST NOT alterar conformidade,
  nota ou estado.
- **FR-088**: Toda agregação MUST ser recomputável a partir dos dados brutos exportados da
  mesma consulta.
- **FR-089**: Duas execuções da mesma consulta sobre o mesmo acervo MUST produzir resultado
  idêntico, na mesma ordem, com critério de desempate estável e declarado.
- **FR-090**: A ordenação MUST ser restrita a um conjunto declarado de colunas; a exibição e
  ocultação de colunas MUST ser possível sem refazer a consulta; ordenação e visibilidade MUST
  ser apresentação, nunca filtro; a preferência MUST ser persistida por usuário.
- **FR-091**: Nenhuma consulta MUST retornar conjunto ilimitado; a navegação MUST ser contínua
  ou anterior/próxima, com contagem aproximada ou teto informado, e contagem exata reservada a
  recortes abaixo de um limite configurável.
- **FR-092**: A busca dentro de um resultado MUST alcançar o conjunto inteiro, não apenas o
  trecho visível na tela.
- **FR-093**: A área de auditoria MUST consultar sempre dado vivo, MUST NOT ser servida por
  projeção defasada.

#### Exportação e selo de integridade

- **FR-094**: O sistema MUST oferecer três formatos para qualquer relatório e qualquer consulta
  de auditoria no escopo do usuário: documento de apresentação, planilha e formato de
  integração.
- **FR-095**: O documento de apresentação MUST conter o veredito final, a assinatura eletrônica
  do aprovador com nome, cargo e unidade, o selo com código de verificação e QR code, e a
  identidade visual institucional.
- **FR-096**: O nome do arquivo MUST ser resolvido a partir do padrão configurado, com
  substituição de sigla da unidade e data.
- **FR-097**: Todo artefato exportado MUST receber selo de integridade — inclusive exportações
  parciais e as que retornaram conjunto vazio.
- **FR-098**: O selo MUST atestar **o dado**, de modo que os três formatos de um mesmo recorte
  compartilhem a mesma prova de conteúdo, e MUST atestar adicionalmente **o arquivo entregue**,
  de modo a detectar edição posterior mesmo quando o dado de origem não mudou.
- **FR-099**: A prova de conteúdo MUST ser derivada de um contrato de serialização próprio e
  versionado, independente de como os dados são apresentados nas telas.
- **FR-100**: O código de verificação MUST ser único, legível por humano, não sequencial e não
  enumerável.
- **FR-101**: O registro do selo MUST ser imutável; revogação MUST ser registro adicional com
  motivo, MUST NOT alterar ou remover o selo original.
- **FR-102**: A verificação MUST ser pública, sem autenticação, e MUST exibir veredito de
  integridade, unidade, período, estado, nome e cargo do aprovador, data de emissão, tipo de
  documento e a prova — e MUST NOT exibir valores de indicadores, análises, planos de ação ou
  evidências.
- **FR-103**: A verificação MUST distinguir os vereditos: íntegro; conteúdo íntegro com arquivo
  adulterado; conteúdo divergente; selo revogado com motivo e data; código não encontrado.
- **FR-104**: A verificação MUST ser possível também sem consultar a plataforma, a partir da
  chave pública publicada em endereço estável e versionado, preservando a validade de selos
  emitidos sob chaves anteriores.
- **FR-105**: Códigos inexistentes e malformados MUST NOT ser distinguíveis pela resposta,
  inclusive pelo tempo de resposta, e a rota pública MUST ter limitação de taxa própria.
- **FR-106**: A chave privada de assinatura MUST ser custodiada fora do repositório e fora do
  conjunto ordinário de variáveis de configuração, com acesso registrado e rotação programada.
- **FR-107**: A exportação de consulta de auditoria MUST carregar filtros aplicados na íntegra
  (inclusive os sem retorno), modo, colunas e ordenação vigentes, escopo do solicitante,
  legenda de ausência, autoria da extração e o número de observações de cada agregação.
- **FR-108**: A exportação MUST ser produzida a partir do acervo, MUST NOT ser construída a
  partir do que está renderizado na tela.

#### Texto livre e integridade de saída

- **FR-109**: Campos de redação livre MUST ser gravados exatamente como digitados, sem
  transformação — alterar o texto no caminho da escrita destruiria a prova do que foi
  registrado.
- **FR-110**: A neutralização MUST ocorrer em cada superfície de saída: conteúdo tratado como
  texto e nunca como marcação na tela e no documento; e células de planilha iniciadas por
  caractere de fórmula MUST ser prefixadas defensivamente, de modo que o arquivo entregue ao
  auditor externo não execute conteúdo.

#### Notificações

- **FR-111**: O sistema MUST notificar os responsáveis nas transições de fluxo — disponível
  para revisão, pendente de aprovação, reprovado, concluído — e no estouro de prazo.
- **FR-112**: A falha de notificação é o caso particular de **FR-123**, que carrega a regra geral.
  O que é próprio dela: o registro MUST identificar o destinatário e a transição de fluxo afetados —
  sem isso a falha fica registrada mas ninguém sabe quem deixou de ser avisado do quê.
- **FR-113**: O assunto das notificações MUST ser padronizado com identificação do sistema,
  sigla da unidade e período, e MUST ser higienizado contra conteúdo de cadastro livre.

#### Camada de consumo analítico

- **FR-114**: O acervo consolidado MUST ser exposto à ferramenta de BI por uma camada
  desacoplada do modelo operacional, de modo que evoluções internas não quebrem painéis.
- **FR-115**: A camada MUST expor exclusivamente relatórios concluídos.
- **FR-116**: A marcação de aplicabilidade MUST atravessar a camada, de modo que nenhuma
  agregação de BI trate ausência como zero.
- **FR-117**: Metas e pesos MUST vir do congelamento da época; a nota MUST ser reproduzida como
  calculada na finalização, nunca recalculada.
- **FR-118**: A camada MUST ser somente leitura e MUST NOT introduzir lógica de negócio nova.
- **FR-119**: A camada MUST permitir descer do valor apurado até a decomposição do cálculo, o
  histórico de autoria e alteração, e o arquivo de evidência.
- **FR-120**: O acesso à evidência a partir do BI MUST dispensar conta na plataforma, MUST
  valer por janela curta e uma única utilização, MUST apresentar tela amigável de expiração
  (nunca erro cru), MUST ser integralmente registrado e MUST NOT revelar o endereço real do
  armazenamento.
- **FR-121**: A camada MUST suportar atualização incremental com marcação de última carga e
  capacidade de recarga completa.
- **FR-122**: Divergência entre a camada analítica e a área de auditoria interna MUST ser
  tratada como defeito, não como interpretação alternativa.

#### Requisitos transversais

- **FR-123**: Falha de serviço acessório — notificação, armazenamento de evidências — MUST NOT
  reverter transação de negócio já persistida nem bloquear o ciclo, e MUST ser registrada com o
  serviço afetado, a operação tentada e a causa. A verificação de segurança de anexo **não** é
  serviço acessório para este efeito: sua indisponibilidade mantém o anexo pendente e barra o avanço
  de etapa, conforme FR-038.
- **FR-124**: Toda a interface, mensagens de erro, notificações e artefatos exportados MUST
  estar em português do Brasil.
- **FR-125**: Nenhum estado MUST ser comunicado apenas por cor; todo indicativo de estado MUST
  carregar rótulo textual.
- **FR-126**: O custo de uma consulta MUST depender do recorte pedido, não do tamanho acumulado
  do acervo.
- **FR-127**: A alteração de uma variável de indicador MUST NOT provocar recomposição da tela
  inteira nem dos demais indicadores; apenas a aferição do indicador alterado e os totais que
  dependem dele MUST reagir.
- **FR-128**: Escopo de unidade, perfil e permissão MUST NOT ser mantidos em qualquer camada de
  cache.
- **FR-129**: Quando dois usuários editam concorrentemente a mesma resposta de indicador, o
  sistema MUST recusar a gravação feita sobre uma versão que já não é a corrente e MUST
  apresentar ao autor o valor que prevaleceu, quem o informou e quando, permitindo-lhe decidir
  se o sobrescreve. O sistema MUST NOT descartar alteração concorrente em silêncio nem
  registrar a sobrescrita como correção deliberada.
- **FR-130**: O sistema MUST ser recuperável de uma perda total do banco de dados com perda
  máxima de 15 minutos de trabalho já registrado e retorno ao ar em até 4 horas. A rotina de
  backup MUST admitir recuperação a ponto no tempo, MUST replicar para repositório isolado ao
  qual a credencial de origem não tenha permissão de remoção, e MUST ter sua restauração
  testada periodicamente e o teste registrado — backup nunca restaurado não é backup.

### Key Entities

- **Unidade**: unidade organizacional gerida pela AGIR — sigla, nome, logotipo, nível de
  complexidade (N1/N2/N3), formulário associado, situação de atividade.
- **Usuário**: pessoa — matrícula, nome, e-mail, **cargo** (função na organização, distinto do
  perfil de acesso), perfil, unidade de lotação, acessos adicionais, situação de atividade.
- **Concessão de acesso**: permissão de leitura de um usuário sobre uma unidade além da sua.
- **Formulário**: agrupa seções temáticas e é vinculado a unidades de um nível.
- **Seção temática**: agrupamento ordenado de indicadores dentro de um formulário.
- **Definição de indicador**: título, objetivo, código canônico, chaves de entrada, expressão
  de cálculo, operador e valor de meta, peso, marcação de dado estrutural estável, ordem.
- **Catálogo canônico**: identidade estável de uma métrica entre formulários distintos — código,
  nome, descrição e unidade de medida. Sem ele, "esta métrica em todas as unidades" é
  irrespondível quando as unidades usam formulários diferentes.
- **Relatório**: instância mensal de uma unidade — estado, prazos, notas, marcadores de
  pontualidade, contagem de reprovas.
- **Resposta de indicador**: resposta de um indicador dentro de um relatório, com a definição
  congelada, valores das variáveis, resultado, conformidade, análise crítica, plano de ação e
  estado de validação.
- **Versão de resposta**: registro de vigência de cada conteúdo que a resposta já teve, com
  início e fim, preservando o anterior a cada correção.
- **Submissão**: registro de cada envio de um relatório — etapa, autor, data, prazo vigente
  aferido e resultado da aferição.
- **Evidência**: arquivo anexado a uma resposta (prova da unidade) ou a um veredito (prova da
  contraprova), com estado de verificação de segurança e janela de retenção carimbada.
- **Veredito de validação**: contraprova do aprovador sobre um indicador — decisão,
  justificativa, evidências, autor e data. Imutável.
- **Registro de alteração**: quem alterou o quê, quando, a partir de onde e por qual canal, com
  valor anterior e novo. Somente-acréscimo.
- **Registro de acesso**: quem leu o quê, quando e em que recorte — consultas, exportações,
  downloads, verificações e autenticações. Somente-acréscimo.
- **Selo de integridade**: prova de origem e inalterabilidade de um artefato exportado — código
  de verificação, prova de conteúdo, prova de arquivo, assinatura, identificação da chave,
  escopo, autoria, emissão e eventual revogação. Imutável.
- **Configuração da plataforma**: parâmetros operacionais únicos — prazos, desconto por atraso,
  padrão de nomenclatura, janela de retenção, limites de consulta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos períodos mensais são abertos sem qualquer ação humana, e nenhuma unidade
  ativa fica sem relatório instanciado no primeiro dia útil.
- **SC-002**: A Matriz fecha o período sem manter nenhuma planilha externa de consolidação — o
  número de artefatos de consolidação fora da plataforma é zero.
- **SC-003**: Em 100% dos relatórios concluídos, cada indicador possui veredito individual com
  justificativa registrada e autor identificado.
- **SC-004**: Em auditoria por amostragem de 100% das exportações emitidas, nenhuma célula de
  ausência aparece como zero ou como vazio sem legenda.
- **SC-005**: 100% das tentativas de sobrescrever ou remover registro histórico são recusadas, e
  cada tentativa fica registrada.
- **SC-006**: Para qualquer valor apresentado no acervo, é possível recuperar em até 3 passos de
  navegação quem o informou, quem o alterou, o valor anterior e a justificativa do veredito que
  o acompanhou.
- **SC-007**: Duas execuções da mesma consulta sobre o mesmo acervo produzem resultado idêntico,
  na mesma ordem, em 100% das repetições.
- **SC-008**: 100% dos números apresentados em blocos analíticos são recomputáveis a partir dos
  dados brutos exportados da mesma consulta.
- **SC-009**: Um auditor externo, de posse apenas da via impressa e sem qualquer credencial,
  confirma a autenticidade do documento em menos de 1 minuto.
- **SC-010**: A alteração de um único byte em um arquivo exportado é detectada pela verificação
  em 100% dos casos.
- **SC-011**: A consulta de auditoria sobre 24 meses e todas as unidades apresenta a primeira
  página de resultados em menos de 3 segundos, e esse tempo não se degrada à medida que o
  acervo cresce.
- **SC-012**: O tempo de resposta percebido nas telas de trabalho não se altera de forma
  perceptível entre o primeiro e o terceiro ano de operação, com o acervo várias vezes maior.
- **SC-012a**: Com 60 unidades e 400 usuários — o teto do envelope de 10 anos — a plataforma
  sustenta o pico de fechamento mensal, quando todas as unidades disputam a mesma janela de
  prazo, sem degradação perceptível nas telas de preenchimento e validação.
- **SC-013**: Um elaborador conclui o preenchimento mensal informando apenas as variáveis que
  mudaram — ao menos 60% dos campos de dados estruturais estáveis chegam pré-preenchidos.
- **SC-014**: A GCINFRA altera prazo, meta, peso, fórmula ou estrutura de formulário sem
  nenhuma solicitação de desenvolvimento e sem indisponibilidade da plataforma.
- **SC-015**: Nenhuma nota, meta ou peso de relatório já emitido muda em consequência de
  alteração posterior de configuração — verificável comparando exportações do mesmo relatório
  antes e depois da alteração.
- **SC-016**: Indisponibilidade do serviço de notificação ou do armazenamento de evidências não
  reverte nenhuma submissão ou aprovação já registrada.
- **SC-017**: Um erro de senha de um usuário não interrompe o acesso dos demais usuários da
  mesma unidade.
- **SC-018**: Nenhum arquivo com detecção positiva de segurança fica disponível para download,
  e nenhum ingressa no acervo sob retenção imutável.
- **SC-019**: A ferramenta de BI e a área de auditoria interna respondem o mesmo número para a
  mesma pergunta em 100% das comparações.
- **SC-020**: Um analista sem conta na plataforma alcança o arquivo de evidência a partir do
  painel de BI, e o mesmo vínculo deixa de funcionar após a primeira utilização.
- **SC-021**: Em exercício de restauração a partir do backup, a plataforma volta a operar em
  até 4 horas e nenhum trabalho registrado há mais de 15 minutos antes da falha é perdido. O
  exercício é executado periodicamente e seu resultado é registrado.

## Assumptions

- **Estágio do produto.** Parte do escopo desta especificação já existe implementada no
  repositório. Esta spec descreve o **estado-alvo completo da Etapa 1**; o levantamento do que
  já está construído contra o que falta pertence à fase de planejamento, não a esta.
- **Etapa 2 fora de escopo.** A coleta automática a partir de ferramentas especialistas é
  acréscimo posterior e não altera nenhum requisito acima.
- **Provisionamento de contas.** Não há autocadastro: usuários são colaboradores da AGIR com
  conta criada por administrador, e o administrador inicial é provisionado na implantação.
- **Formulário N2.** N2 não possui documento de origem próprio; seu formulário nasce replicado
  da definição de N3, como template próprio que pode divergir a qualquer momento sem afetar N3.
- **Feriados.** Apenas os feriados nacionais de observância obrigatória entram no cálculo de
  dias úteis. Carnaval e Corpus Christi são pontos facultativos, configuráveis e desligados por
  padrão.
- **Idioma único.** Português do Brasil, sem previsão de internacionalização.
- **Topologia de rede das unidades.** As unidades são hospitais cujo tráfego sai por poucos
  endereços públicos compartilhados — premissa que determina o desenho do bloqueio automático.
- **Exposição do verificador.** O verificador público é alcançável fora da rede corporativa;
  sem isso o caso de uso central (auditor externo com a via impressa) não se sustenta.
- **Ferramenta de BI.** O Tableau é a ferramenta corporativa já existente e consome a camada
  analítica diretamente, sem intermediação de serviço próprio.
- **Retenção da trilha de auditoria** *(decidido — ver Clarifications)*: os registros de
  alteração e de acesso têm como piso a janela de retenção vigente das evidências (10 anos por
  padrão) e a acompanham se ela for ampliada. O documento master deixava esta política em
  aberto; a regra decorre de a trilha nunca poder viver menos que aquilo que ela prova.
- **Guarda de arquivo com detecção positiva** *(decidido — ver Clarifications)*: 1 ano em
  quarentena, prazo próprio e independente da janela de retenção das evidências, com expurgo
  automático ao término e liberação antecipada registrada. O documento master declarava que o
  prazo é próprio, sem fixá-lo.
- **Escala de planejamento** *(decidido — ver Clarifications)*: envelope de 10 anos da AGIR de
  20 a 60 unidades e 100 a 400 usuários. Réplica de leitura e particionamento da trilha
  justificam-se pelo acúmulo do período, não pelo volume inicial.
- **Amplitude máxima de consulta** *(confirmado adequado à escala acima)*: 24 meses por consulta
  e contagem exata reservada a recortes de até 10.000 registros — ambos administráveis.
- **Regra de sinalização de valores atípicos** *(default adotado)*: intervalo interquartil,
  declarado na interface e ajustável.
- **Logotipo sobre fundo claro.** O ativo ainda não foi fornecido pela organização; enquanto não
  existir, as superfícies claras recuam para monograma ou texto, nunca reutilizando a versão
  destinada a fundo escuro.
