import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { AuditPage } from './AuditPage';
import { renderWithProviders } from '../test/render-with-providers';
import * as auditApi from '../api/audit';
import type { AuditQueryResult } from '../api/audit';

vi.mock('../api/audit');

const baseResult: AuditQueryResult = {
  columns: [{ indicatorCode: 'IND-01', measurementUnit: 'unidades' }],
  rows: [
    {
      unitId: 'unit-A',
      referencePeriod: '2026-06',
      cells: { 'IND-01': { kind: 'VALOR', value: 10, isOutlier: false } },
    },
  ],
  aggregations: [{ label: 'IND-01', measurementUnit: 'unidades', value: 10, n: 1, totalCells: 1, scale: 2 }],
  absenceLegend: { NA_FORA_DO_NIVEL: 'Fora do nível.' },
  isEmptyResult: false,
  nextCursor: null,
  countMode: 'EXATA',
  count: 1,
  outlierRule: 'IQR',
};

describe('AuditPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockDefaults(overrides: Partial<AuditQueryResult> = {}) {
    vi.mocked(auditApi.queryAudit).mockResolvedValue({ ...baseResult, ...overrides });
    vi.mocked(auditApi.getAuditFilters).mockResolvedValue({ units: [], levels: ['A', 'B', 'C'], indicatorCodes: [] });
    vi.mocked(auditApi.getTablePreference).mockResolvedValue({ columnOrder: [], hiddenColumns: [] });
  }

  it('loads the query on mount and shows the absence legend next to the result', async () => {
    mockDefaults();

    renderWithProviders(<AuditPage />);

    await screen.findByText('Fora do nível.');
    expect(screen.getByText('NA_FORA_DO_NIVEL')).toBeInTheDocument();
    expect(auditApi.queryAudit).toHaveBeenCalled();
  });

  // US6-4/FR-083: conjunto vazio informa explicitamente, sem sugerir
  // ampliar/afrouxar nada.
  it('shows the empty-result message without offering to relax any filter', async () => {
    mockDefaults({ isEmptyResult: true, rows: [], columns: [], aggregations: [] });

    renderWithProviders(<AuditPage />);

    await screen.findByText('Nenhum registro para esta combinação de filtros');
  });

  // T118/US6-11: navegacao continua/anterior-proxima — "Proxima" so fica
  // habilitada quando ha nextCursor, nunca um conjunto ilimitado.
  it('disables "Próxima" when there is no next page and enables it when nextCursor is present', async () => {
    mockDefaults({ nextCursor: 'opaque-cursor-1' });

    renderWithProviders(<AuditPage />);

    await screen.findByText('Fora do nível.');
    const nextButton = screen.getByRole('button', { name: 'Próxima' });
    const previousButton = screen.getByRole('button', { name: 'Anterior' });
    expect(nextButton).not.toBeDisabled();
    expect(previousButton).toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      const lastCall = vi.mocked(auditApi.queryAudit).mock.calls.at(-1)![0];
      expect(lastCall.cursor).toBe('opaque-cursor-1');
    });
  });

  it('reports the declared ceiling, never a silent exact count, once the volume exceeds the threshold', async () => {
    mockDefaults({ countMode: 'TETO', count: 10000 });

    renderWithProviders(<AuditPage />);

    await screen.findByText(/Mais de 10000 registros/);
  });
});
