export type RoleName = 'OBSERVADOR' | 'ELABORADOR' | 'REVISOR' | 'APROVADOR' | 'ADMINISTRADOR';

export type UnitLevel = 'A' | 'B' | 'C';

export type GoalOperator = 'GTE' | 'LTE' | 'EQ' | 'GT' | 'LT';

export type ReportStatus = 'PENDENTE' | 'EM_REVISAO' | 'PENDENTE_APROVACAO' | 'CONCLUIDO';

export type IndicatorValidationStatus = 'EM_REVISAO' | 'PENDENTE_VALIDACAO' | 'APROVADO' | 'REPROVADO';

export type ValidationVerdict = 'APROVADO' | 'REPROVADO';

export type InheritanceState = 'NAO_HERDADO' | 'HERDADO' | 'HERDADO_PARCIAL';

export type ReportSubmissionStage = 'ELABORACAO' | 'REVISAO' | 'APROVACAO';

export interface AuthenticatedUser {
  id: string;
  matricula: string;
  nome: string;
  sobrenome: string;
  email: string;
  role: RoleName;
  primaryUnitId: string;
  primaryUnit?: UnitSummary;
}

export interface LoginResponse {
  user: AuthenticatedUser;
}

export interface UnitSummary {
  id: string;
  sigla: string;
  nome: string;
}

export interface Unit {
  id: string;
  sigla: string;
  nome: string;
  logoUrl: string | null;
  level: UnitLevel;
  formTemplateId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  formTemplate: { id: string; name: string } | null;
}

export interface UserUnitAccess {
  unitId: string;
  unit: UnitSummary;
}

export interface AdminUser {
  id: string;
  matricula: string;
  nome: string;
  sobrenome: string;
  email: string;
  role: RoleName;
  primaryUnitId: string;
  isActive: boolean;
  primaryUnit: UnitSummary;
  unitAccesses: UserUnitAccess[];
}

export interface FormIndicator {
  id: string;
  formTopicId: string;
  title: string;
  objective: string;
  variableKeys: string[];
  formulaExpression: string;
  goalOperator: GoalOperator;
  goalValue: string;
  isResidentState: boolean;
  order: number;
  isActive: boolean;
  scoreWeight: string;
  createdAt: string;
  updatedAt: string;
  formTopic?: FormTopic;
}

export interface IndicatorScoreItem {
  id: string;
  title: string;
  scoreWeight: number;
}

export interface IndicatorScoreSummary {
  items: IndicatorScoreItem[];
  sum: number;
  target: number;
}

export interface FormTopic {
  id: string;
  formTemplateId: string;
  title: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  indicators?: FormIndicator[];
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  topics?: FormTopic[];
}

export type EvidenceScanStatus = 'PENDENTE' | 'LIBERADO' | 'BLOQUEADO';

export interface EvidenceFile {
  id: string;
  indicatorResponseId: string | null;
  validationRecordId: string | null;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  isActive: boolean;
  scanStatus: EvidenceScanStatus;
  createdAt: string;
}

export interface ValidationRecord {
  id: string;
  indicatorResponseId: string;
  aprovadorUserId: string;
  verdict: ValidationVerdict;
  justification: string;
  createdAt: string;
  evidenceFiles?: EvidenceFile[];
}

export interface IndicatorResponse {
  id: string;
  reportInstanceId: string;
  formIndicatorId: string;
  snapshotTitle: string;
  snapshotObjective: string;
  snapshotVariableKeys: string[];
  snapshotFormulaExpression: string;
  snapshotGoalOperator: GoalOperator;
  snapshotGoalValue: string;
  variableValues: Record<string, number>;
  calculatedValue: string | null;
  calculationFailureReason: string | null;
  isCompliant: boolean | null;
  isClonedFromResident: boolean;
  inheritanceState: InheritanceState;
  unresolvedInheritedKeys: string[];
  // FR-129: versao corrente — enviada de volta como expectedVersionId na
  // proxima gravacao, para deteccao de conflito.
  currentVersionId: string | null;
  validationStatus: IndicatorValidationStatus;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  evidenceFiles?: EvidenceFile[];
  validationRecords?: ValidationRecord[];
  formIndicator?: FormIndicator;
  criticalAnalysis?: string | null;
  actionPlan?: string | null;
}

export interface IndicatorResponseVersion {
  id: string;
  indicatorResponseId: string;
  validFrom: string;
  validTo: string | null;
  variableValues: Record<string, number>;
  calculatedValue: string | null;
  calculationFailureReason: string | null;
  isCompliant: boolean | null;
  criticalAnalysis: string | null;
  actionPlan: string | null;
  authoredByUserId: string | null;
  overwroteVersionId: string | null;
  originLegacy: boolean;
  createdAt: string;
  authoredByUser: { nome: string; sobrenome: string; jobTitle: string | null } | null;
}

// FR-129: corpo do 409 de conflito de versao (contracts/api-rest.md).
export interface IndicatorVersionConflict {
  versionId: string;
  variableValues: Record<string, number>;
  authoredBy: { name: string; jobTitle: string | null } | null;
  authoredAt: string;
}

export interface ReportSubmission {
  id: string;
  reportInstanceId: string;
  stage: ReportSubmissionStage;
  submittedByUserId: string;
  submittedAt: string;
  effectiveDueDate: string;
  wasOnTime: boolean;
  reprovalCountAtSubmission: number;
  submittedByUser?: { nome: string; sobrenome: string };
}

export interface ReportInstance {
  id: string;
  unitId: string;
  formTemplateId: string;
  referenceMonth: string;
  status: ReportStatus;
  elaborationDueDate: string;
  reviewDueDate: string;
  approvalDueDate: string;
  reprovalCount: number;
  slaExtensionDueDate: string | null;
  submittedForReviewAt: string | null;
  submittedForApprovalAt: string | null;
  concludedAt: string | null;
  indicatorScore: string | null;
  slaDeflatorApplied: string | null;
  totalScore: string | null;
  isElaborationOnTime: boolean | null;
  isReviewOnTime: boolean | null;
  createdAt: string;
  updatedAt: string;
  unit: Unit;
  indicatorResponses?: IndicatorResponse[];
  submissions?: ReportSubmission[];
}

export interface SystemSetting {
  id: string;
  exportNamingPattern: string;
  slaElaborationBusinessDay: number;
  slaReviewBusinessDay: number;
  slaApprovalBusinessDay: number;
  slaReprovalExtensionDays: number;
  slaDeflatorScore: number;
  updatedAt: string;
}

export interface ReportInstanceOverview {
  id: string;
  unitId: string;
  referenceMonth: string;
  status: ReportStatus;
  totalScore: string | null;
  elaborationDueDate?: string;
  reviewDueDate?: string;
  approvalDueDate?: string;
  isElaborationOnTime: boolean | null;
  isReviewOnTime: boolean | null;
  unit: UnitSummary;
}

export type UpdatePlatformSettingsInput = Partial<
  Pick<
    SystemSetting,
    | 'exportNamingPattern'
    | 'slaElaborationBusinessDay'
    | 'slaReviewBusinessDay'
    | 'slaApprovalBusinessDay'
    | 'slaReprovalExtensionDays'
    | 'slaDeflatorScore'
  >
>;

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}
