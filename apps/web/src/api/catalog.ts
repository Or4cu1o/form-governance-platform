import { apiGet, apiSend, buildQueryString } from '../lib/api-client';
import type { CatalogEntry } from '../types/api';

export interface CatalogEntryInput {
  code: string;
  name: string;
  measurementUnit: string;
  description?: string;
}

export function searchCatalog(query?: string): Promise<CatalogEntry[]> {
  return apiGet<CatalogEntry[]>(`/catalog${buildQueryString({ q: query || undefined })}`);
}

export function createCatalogEntry(input: CatalogEntryInput): Promise<CatalogEntry> {
  return apiSend<CatalogEntry>('POST', '/catalog', input);
}

export function updateCatalogEntry(id: string, input: Partial<CatalogEntryInput>): Promise<CatalogEntry> {
  return apiSend<CatalogEntry>('PATCH', `/catalog/${encodeURIComponent(id)}`, input);
}

export function deactivateCatalogEntry(id: string): Promise<CatalogEntry> {
  return apiSend<CatalogEntry>('POST', `/catalog/${encodeURIComponent(id)}/deactivate`);
}
