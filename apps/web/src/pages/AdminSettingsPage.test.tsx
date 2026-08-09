import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { AdminSettingsPage } from './AdminSettingsPage';
import { renderWithProviders } from '../test/render-with-providers';
import * as settingsApi from '../api/settings';

vi.mock('../api/settings');

const baseSettings = {
  id: 'settings-1',
  exportNamingPattern: '{SIGLA UNIDADE} - {data iso}',
  slaElaborationBusinessDay: 6,
  slaReviewBusinessDay: 8,
  slaApprovalBusinessDay: 10,
  slaReprovalExtensionDays: 2,
  slaDeflatorScore: 2,
  evidenceRetentionYears: 10,
  includeOptionalHolidays: false,
  auditMaxRangeMonths: 24,
  auditDetailedMaxRangeMonths: 12,
  auditExactCountThreshold: 10000,
  outlierRule: 'IQR',
  forensicHoldYears: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AdminSettingsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the platform naming panel by default and switches tabs', async () => {
    vi.mocked(settingsApi.getPlatformSettings).mockResolvedValue(baseSettings);

    renderWithProviders(<AdminSettingsPage />);

    expect(await screen.findByLabelText('Padrão de nomenclatura de exportação')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Prazos (SLA)' }));
    expect(await screen.findByLabelText('Elaboração (dia útil)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pontuação' }));
    expect(await screen.findByLabelText('Nota de deflator por atraso')).toBeInTheDocument();
  });
});
