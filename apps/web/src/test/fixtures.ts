import type { AuthenticatedUser, IndicatorResponse, ReportInstance, ReportInstanceOverview, Unit } from '../types/api';

export function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    matricula: '001',
    nome: 'Ana',
    sobrenome: 'Silva',
    email: 'ana@example.com',
    role: 'ELABORADOR',
    primaryUnitId: 'unit-1',
    ...overrides,
  };
}

export function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-1',
    sigla: 'TI',
    nome: 'Tecnologia da Informação',
    logoUrl: null,
    level: 'A',
    formTemplateId: 'template-1',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    formTemplate: { id: 'template-1', name: 'Formulário Mensal' },
    ...overrides,
  };
}

export function makeReportInstance(overrides: Partial<ReportInstance> = {}): ReportInstance {
  return {
    id: 'report-1',
    unitId: 'unit-1',
    formTemplateId: 'template-1',
    referenceMonth: '2026-03-01',
    status: 'PENDENTE',
    elaborationDueDate: '2026-04-05T00:00:00.000Z',
    reviewDueDate: '2026-04-10T00:00:00.000Z',
    approvalDueDate: '2026-04-15T00:00:00.000Z',
    reprovalCount: 0,
    slaExtensionDueDate: null,
    submittedForReviewAt: null,
    submittedForApprovalAt: null,
    concludedAt: null,
    indicatorScore: null,
    slaDeflatorApplied: null,
    totalScore: null,
    isElaborationOnTime: null,
    isReviewOnTime: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    unit: makeUnit(),
    indicatorResponses: [],
    submissions: [],
    ...overrides,
  };
}

export function makeIndicatorResponse(overrides: Partial<IndicatorResponse> = {}): IndicatorResponse {
  return {
    id: 'response-1',
    reportInstanceId: 'report-1',
    formIndicatorId: 'indicator-1',
    snapshotTitle: 'Disponibilidade de sistemas',
    snapshotObjective: 'Medir uptime dos sistemas críticos',
    snapshotVariableKeys: ['uptimeMinutos', 'totalMinutos'],
    snapshotFormulaExpression: '(uptimeMinutos / totalMinutos) * 100',
    snapshotGoalOperator: 'GTE',
    snapshotGoalValue: '99',
    variableValues: { uptimeMinutos: 1430, totalMinutos: 1440 },
    calculatedValue: '99.30',
    calculationFailureReason: null,
    isCompliant: true,
    isClonedFromResident: false,
    inheritanceState: 'NAO_HERDADO',
    unresolvedInheritedKeys: [],
    currentVersionId: 'version-1',
    validationStatus: 'EM_REVISAO',
    updatedByUserId: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    evidenceFiles: [],
    validationRecords: [],
    ...overrides,
  };
}

export function makeReportInstanceOverview(overrides: Partial<ReportInstanceOverview> = {}): ReportInstanceOverview {
  return {
    id: 'report-1',
    unitId: 'unit-1',
    referenceMonth: '2026-03-01',
    status: 'PENDENTE',
    totalScore: null,
    isElaborationOnTime: null,
    isReviewOnTime: null,
    unit: { id: 'unit-1', sigla: 'TI', nome: 'Tecnologia da Informação' },
    ...overrides,
  };
}
