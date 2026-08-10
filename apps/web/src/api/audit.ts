import { apiGet, apiSend } from '../lib/api-client';
import type { UnitLevel } from '../types/api';

export type AuditQueryMode = 'BASICO' | 'DETALHADO';

export type AuditCellKind = 'VALOR' | 'ZERO_MEDIDO' | 'NA_FORA_DO_NIVEL' | 'NA_INATIVO_NO_PERIODO' | 'NAO_PREENCHIDO';

export interface AuditCell {
  kind: AuditCellKind;
  value: number | null;
  isOutlier: boolean;
}

export interface AuditColumn {
  indicatorCode: string;
  measurementUnit: string;
}

export interface AuditRow {
  unitId: string;
  referencePeriod: string;
  cells: Record<string, AuditCell>;
}

export interface AuditAggregation {
  label: string;
  measurementUnit: string;
  value: number | null;
  n: number;
  totalCells: number;
  scale: number;
}

export interface AuditQueryResult {
  columns: AuditColumn[];
  rows: AuditRow[];
  aggregations: AuditAggregation[];
  absenceLegend: Record<string, string>;
  isEmptyResult: boolean;
  nextCursor: string | null;
  countMode: 'EXATA' | 'APROXIMADA' | 'TETO';
  count: number;
  outlierRule: string;
}

export interface AuditQueryParams {
  mode?: AuditQueryMode;
  periodFrom: string;
  periodTo: string;
  unitIds?: string[];
  levels?: UnitLevel[];
  indicatorCodes?: string[];
  search?: string;
  cursor?: string;
  pageSize?: number;
}

// buildQueryString (lib/api-client) nao suporta array — a consulta de
// auditoria e o primeiro consumidor do projeto com parametros repetidos
// (?unitIds=a&unitIds=b), por isso monta a query string aqui mesmo.
function buildAuditQueryString(params: AuditQueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.set(key, String(value));
    }
  }
  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
}

export function queryAudit(params: AuditQueryParams): Promise<AuditQueryResult> {
  return apiGet<AuditQueryResult>(`/audit/query${buildAuditQueryString(params)}`);
}

export interface AuditFilterOptions {
  units: Array<{ id: string; sigla: string; nome: string; level: UnitLevel }>;
  levels: UnitLevel[];
  indicatorCodes: Array<{ code: string; name: string; measurementUnit: string }>;
}

export function getAuditFilters(params: { unitIds?: string[]; levels?: UnitLevel[] } = {}): Promise<AuditFilterOptions> {
  return apiGet<AuditFilterOptions>(`/audit/filters${buildAuditQueryString(params as AuditQueryParams)}`);
}

export interface TablePreference {
  columnOrder: string[];
  hiddenColumns: string[];
}

export function getTablePreference(tableKey: string): Promise<TablePreference> {
  return apiGet<TablePreference>(`/audit/table-preferences/${encodeURIComponent(tableKey)}`);
}

export function saveTablePreference(tableKey: string, preference: TablePreference): Promise<TablePreference> {
  return apiSend<TablePreference>('POST', `/audit/table-preferences/${encodeURIComponent(tableKey)}`, preference);
}
