# FormOps — Governança e Automação de Indicadores

## O que é

O FormOps é a plataforma que substitui o controle de indicadores por planilha por um sistema único,
onde cada unidade preenche, revisa e aprova seus relatórios mensais em um fluxo digital, auditável
e à prova de adulteração.

Hoje, os indicadores de TI são preenchidos manualmente em documentos Word, com os cálculos de
fórmulas, percentuais e metas feitos à mão, indicador por indicador — um trabalho repetitivo,
demorado e sujeito a erro. Os arquivos ficam em pasta compartilhada, sem rastro de quem alterou o
quê, sem verificação automática de consistência e sem garantia de que o número final é o que foi
realmente aprovado. O FormOps resolve isso de ponta a ponta: automatiza o cálculo, dá visibilidade
completa dos dados e elimina o retrabalho manual.

## Como funciona, em 4 passos

1. **Preencher** — cada unidade lança os valores dos indicadores mensais em um formulário
   estruturado; o sistema calcula o resultado, o percentual e a conformidade com a meta
   automaticamente, com validação de erros antes do envio.
2. **Revisar e aprovar** — o relatório passa por um fluxo de revisão e aprovação com papéis
   definidos (quem preenche, quem revisa, quem aprova), sem depender de intervenção manual ou pasta
   compartilhada.
3. **Selar** — ao ser concluído, o relatório recebe um **selo de integridade digital** (a mesma
   tecnologia usada em assinaturas eletrônicas seguras). Qualquer alteração posterior — mesmo de um
   único caractere — invalida o selo.
4. **Consultar e auditar** — todo o histórico fica disponível para consulta, com trilha completa de
   quem fez o quê e quando, pronta para auditoria interna, externa ou órgãos reguladores.

## O que a plataforma já faz hoje

- **Cálculo automático de resultados** — fórmulas, percentuais e metas de cada indicador são
  definidos uma única vez e aplicados automaticamente a cada preenchimento, eliminando o cálculo
  manual e o erro humano que vem junto.
- **Fluxo completo de preenchimento → revisão → aprovação**, com prazos, lembretes e controle de
  atraso por unidade.
- **Controle de acesso por papel e por unidade** — cada pessoa só vê e edita o que é da sua alçada,
  e o acesso pode ser revogado instantaneamente quando alguém sai da equipe.
- **Evidências anexadas com verificação automática de antivírus** — nenhum arquivo malicioso chega
  a ficar acessível na plataforma.
- **Selo de integridade em cada relatório concluído**, com um portal público de verificação: basta
  o código do selo para qualquer pessoa (auditor, órgão externo, diretoria) confirmar que o
  documento não foi alterado — sem precisar de login nem acesso ao sistema.
- **Trilha de auditoria completa**, incluindo quem alterou, quando e o valor anterior — nada é
  apagado, apenas o histórico é preservado permanentemente.
- **Histórico permanente e gráfico de tendência por unidade** — nenhum relatório é apagado; o
  acervo cresce mês a mês, sem limite, e fica disponível para acompanhar a evolução de cada
  indicador e de cada unidade ao longo do tempo, não só o retrato do mês corrente.
- **Painel de indicadores com pesos configuráveis**, permitindo priorizar o que mais importa para
  cada ciclo de avaliação.
- **Camada de dados pronta para BI** — alimenta o Tableau e outras ferramentas de Business
  Intelligence de forma automática e confiável, com acesso somente-leitura e controlado, sem
  trabalho manual de preparação de dados nem risco à operação.

## Benefícios para a organização

| Hoje (docx/pasta compartilhada) | Com o FormOps |
|---|---|
| Cálculo manual de fórmulas, percentuais e metas | Cálculo automático, sempre com a mesma regra aplicada |
| Sem rastro de quem alterou o quê | Toda alteração é registrada e nunca pode ser apagada |
| Número final pode ser questionado | Selo digital comprova que o relatório não foi adulterado |
| Acesso difícil de controlar, delegar e revogar | Acesso por papel e unidade, revogável na hora |
| Consolidação manual, sujeita a erro | Validação automática antes do envio |
| Auditoria é um esforço à parte | Auditoria é nativa — está sempre disponível, sem trabalho extra |
| Evidências soltas em e-mail/drive | Evidências centralizadas, verificadas e com retenção controlada |
| Histórico se perde ou fica disperso em pastas | Histórico permanente, pronto para análise de tendência de longo prazo |

## O que isso viabiliza para a diretoria

- **Confiança no número** — o dado que chega até a diretoria tem garantia técnica de que não foi
  alterado depois de aprovado.
- **Resposta rápida a auditoria** — interna, externa ou regulatória, sem precisar reconstruir
  histórico manualmente.
- **Redução de risco operacional e de compliance** — menos dependência de processos informais e de
  pessoas específicas para "saber onde está" cada informação.
- **Visão executiva sem abrir mão de segurança** — dashboards e relatórios de BI alimentados
  diretamente pela plataforma, com controle de acesso mantido.
- **Visão de longo prazo para decisão estratégica** — com histórico permanente e tendência por
  unidade, a diretoria enxerga a evolução ao longo de anos, não só o retrato do mês.
- **Evolução mensurável das unidades hospitalares** — dados estruturados, auditáveis e com
  histórico contínuo são exatamente o tipo de maturidade de governança de dados que certificações
  internacionais de gestão hospitalar, como a HIMSS, avaliam. A plataforma vira evidência concreta
  desse avanço, não apenas um sistema interno de controle.

## Próximos passos

A demonstração de hoje roda em ambiente de teste, para validação com a diretoria antes da decisão
de seguir para produção. O próximo passo, uma vez aprovado, é o deploy em ambiente definitivo
(infraestrutura em nuvem dedicada), com os mesmos controles de segurança já validados aqui.

Um passo futuro já mapeado é a coleta automática de indicadores diretamente das ferramentas de
monitoramento de rede, segurança e infraestrutura — reduzindo ainda mais a digitação manual, sem
substituir o controle humano, apenas o trabalho repetitivo.

## O que é necessário para colocar em produção

**Uma máquina virtual (VM) na AWS**, rodando um conjunto de containers isolados entre si:
o banco de dados, a verificação de antivírus dos arquivos enviados, e a aplicação em si
(backend e frontend). O banco de dados roda dentro dessa mesma VM, via Docker — não é
necessário contratar um serviço de banco gerenciado à parte para começar.

**Capacidade recomendada para começar**: algo na faixa de 4 núcleos de processamento e 8 GB de
memória, com ~50 GB de disco — folga confortável para o serviço de antivírus (o mais pesado do
conjunto) e para o banco crescer por alguns anos de uso normal. É um ponto de partida, ajustável
depois de observarmos o uso real; não é uma máquina de grande porte.

**Armazenamento de evidências — MinIO ou Amazon S3.** O ambiente de testes de hoje guarda os
arquivos anexados aos relatórios num serviço próprio (MinIO), rodando dentro da mesma VM. A
plataforma já é compatível com o Amazon S3 real sem nenhuma alteração de código — é só uma troca
de configuração. A recomendação é usar o S3 direto em produção: tira um serviço inteiro de dentro
da VM (menos memória e disco consumidos ali, menos coisa para atualizar e manter segura), com
durabilidade de nível empresarial para os arquivos. Como o volume de evidências de relatórios
mensais tende a ser pequeno, o ganho de desempenho e a redução de responsabilidade operacional
compensam o custo adicional, que se mantém baixo justamente por ser pouco espaço usado.

**Acesso externo.** Para uso real (fora da demonstração de hoje, que usa um link temporário),
também é necessário um domínio próprio com certificado de segurança (HTTPS) apontando para a VM —
item padrão de qualquer aplicação web, não específico do FormOps.

## Sobre custos

**Infraestrutura (AWS):** não há valores fechados agora — dependem de decisões de contratação
(tamanho da VM, banda, política de backup) que fazem mais sentido na conversa direta com o time
responsável pela conta AWS. O que dá para afirmar com segurança: será necessária uma VM ativa de
forma contínua, com custo mensal recorrente, mas moderado para o porte descrito acima. Não há
custo de licenciamento de software — toda a base tecnológica usada é de código aberto.

**Desenvolvimento:** a construção da plataforma usou o Claude Code (assistente de IA para
desenvolvimento de software), pago com recursos próprios, na assinatura Pro, no limite da cota. O
custo total rastreado em todas as sessões de trabalho deste projeto, do início até agora, soma
pouco mais de **US$ 500**.
