import type {
  GoalOperator,
  IndicatorValidationStatus,
  ReportStatus,
  ReportSubmissionStage,
  RoleName,
  UnitLevel,
  ValidationVerdict,
} from '../types/api';

export type StatusTone = 'pendente' | 'revisao' | 'aprovacao' | 'concluido' | 'reprovado';

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDENTE: 'Pendente',
  EM_REVISAO: 'Em revisão',
  PENDENTE_APROVACAO: 'Pendente de aprovação',
  CONCLUIDO: 'Concluído',
};

// T067/FR-058: rotulo de cada linha do historico de submissoes.
export const REPORT_SUBMISSION_STAGE_LABEL: Record<ReportSubmissionStage, string> = {
  ELABORACAO: 'Elaboração',
  REVISAO: 'Revisão',
  APROVACAO: 'Aprovação',
};

export const REPORT_STATUS_TONE: Record<ReportStatus, StatusTone> = {
  PENDENTE: 'pendente',
  EM_REVISAO: 'revisao',
  PENDENTE_APROVACAO: 'aprovacao',
  CONCLUIDO: 'concluido',
};

export const INDICATOR_VALIDATION_LABEL: Record<IndicatorValidationStatus, string> = {
  EM_REVISAO: 'Em revisão',
  PENDENTE_VALIDACAO: 'Pendente de validação',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
};

export const INDICATOR_VALIDATION_TONE: Record<IndicatorValidationStatus, StatusTone> = {
  EM_REVISAO: 'revisao',
  PENDENTE_VALIDACAO: 'aprovacao',
  APROVADO: 'concluido',
  REPROVADO: 'reprovado',
};

export const VALIDATION_VERDICT_LABEL: Record<ValidationVerdict, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
};

export const ROLE_LABEL: Record<RoleName, string> = {
  OBSERVADOR: 'Observador',
  ELABORADOR: 'Elaborador',
  REVISOR: 'Revisor',
  APROVADOR: 'Aprovador',
  ADMINISTRADOR: 'Administrador',
};

export const UNIT_LEVEL_LABEL: Record<UnitLevel, string> = {
  A: 'Nível A',
  B: 'Nível B',
  C: 'Nível C',
};

export const GOAL_OPERATOR_SYMBOL: Record<GoalOperator, string> = {
  GTE: '≥',
  LTE: '≤',
  EQ: '=',
  GT: '>',
  LT: '<',
};

export const VARIABLE_LABELS: Record<string, string> = {
  EGA: 'Total de Endpoints Gerenciados pelo Antivírus (EGA)',
  ENG: 'Total de Endpoints Não Gerenciados pelo Antivírus (ENG)',
  EGI: 'Total de Endpoints no Sistema de Inventário (EGI)',
  PRE: 'Pontuação de Risco Cibernético (PRE)',
  TOM: 'Total de Ocorrências de Malwares (TOM)',
  RNR: 'Malwares Relatados e Não Resolvidos (RNR)',
  TAR: 'Total de Atualizações Recomendadas (TAR)',
  ARA: 'Atualizações Agendadas ou Aplicadas (ARA)',
  SFP: 'Servidores Físicos em Produção (SFP)',
  SGA: 'Servidores Físicos com Garantia Ativa (SGA)',
  MVP: 'Máquinas Virtuais em Produção (MVP)',
  MVL: 'Máquinas Virtuais Licenciadas (MVL)',
  IFP: 'Indisponibilidade de Firewall [minutos] (IFP)',
  MINUTOS_MENSAIS: 'Total de minutos no mês (MINUTOS_MENSAIS)',
  MVC: 'Máquinas Virtuais Críticas (MVC)',
  MBR: 'Máquinas Virtuais com Backup Restaurável (MBR)',
  DRC: 'Dispositivos de Rede Críticos (DRC)',
  DBR: 'Dispositivos de Rede com Backup Restaurável (DBR)',
  ICL: 'Indisponibilidade de Links [minutos] (ICL)',
  CA: 'Total de Chamados Abertos (CA)',
  CB: 'Total de Chamados em Backlog (CB)',
  APP: 'Ações de Conscientização Planejadas (APP)',
  ARP: 'Ações de Conscientização Realizadas (ARP)',
  RP: 'Revisões de Acesso Planejadas (RP)',
  RR: 'Revisões de Acesso Realizadas (RR)',
  TEMP: 'Temperatura Ambiente <= 27°C (1 = SIM, 0 = NÃO)',
  NOBREAK: 'Nobreak em Operação (1 = SIM, 0 = NÃO)',
  CABOS: 'Cabos Identificados e Organizados (1 = SIM, 0 = NÃO)',
  LIMPEZA_RACK: 'Ausência de Sujeira racks/piso (1 = SIM, 0 = NÃO)',
  GOTEIRAS: 'Ausência de Goteiras/Infiltrações (1 = SIM, 0 = NÃO)',
  ACESSO_FISICO: 'Controle de Acesso Físico (1 = SIM, 0 = NÃO)',
  CAMERAS: 'Câmeras de Monitoramento (1 = SIM, 0 = NÃO)',
  RUIDOS: 'Ausência de Ruídos Anormais (1 = SIM, 0 = NÃO)'
};
