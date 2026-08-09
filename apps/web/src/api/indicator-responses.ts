import { apiGet, apiSend, apiUpload } from '../lib/api-client';
import type { EvidenceFile, IndicatorResponse, IndicatorResponseVersion } from '../types/api';

export interface UpdateIndicatorResponseValuesInput {
  // FR-129: versao sobre a qual o autor editava — obrigatorio, permite ao
  // backend detectar que a versao corrente mudou por baixo dele.
  expectedVersionId: string;
  // Preenchido so na segunda requisicao deliberada, apos o autor ver o 409
  // e decidir conscientemente sobrescrever.
  overwriteVersionId?: string;
  variableValues: Record<string, number>;
  criticalAnalysis?: string;
  actionPlan?: string;
}

export function updateIndicatorResponseValues(
  id: string,
  input: UpdateIndicatorResponseValuesInput,
): Promise<IndicatorResponse> {
  return apiSend<IndicatorResponse>('PUT', `/indicator-responses/${encodeURIComponent(id)}`, input);
}

export function getIndicatorResponseVersions(id: string): Promise<IndicatorResponseVersion[]> {
  return apiGet<IndicatorResponseVersion[]>(`/indicator-responses/${encodeURIComponent(id)}/versions`);
}

export function uploadIndicatorEvidence(id: string, file: File): Promise<EvidenceFile> {
  return apiUpload<EvidenceFile>(`/indicator-responses/${encodeURIComponent(id)}/evidence`, file);
}
