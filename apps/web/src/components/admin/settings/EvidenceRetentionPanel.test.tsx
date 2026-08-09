import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { EvidenceRetentionPanel } from './EvidenceRetentionPanel';
import { renderWithProviders } from '../../../test/render-with-providers';
import * as settingsApi from '../../../api/settings';
import type { SystemSetting } from '../../../types/api';

vi.mock('../../../api/settings');

function makeSettings(overrides: Partial<SystemSetting> = {}): SystemSetting {
  return {
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
    ...overrides,
  };
}

describe('EvidenceRetentionPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // T090/US4-10: retencao indeterminada exige um dialogo dedicado, distinto
  // do salvamento comum, explicitando a irreversibilidade antes de aplicar.
  it('requires a dedicated confirmation dialog before saving unlimited retention', async () => {
    vi.mocked(settingsApi.getPlatformSettings).mockResolvedValue(makeSettings());
    renderWithProviders(<EvidenceRetentionPanel />);

    const input = await screen.findByLabelText<HTMLInputElement>('Retenção de evidências (anos)');
    await waitFor(() => expect(input).toHaveValue(10));
    fireEvent.change(input, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByRole('heading', { name: 'Confirmar retenção indeterminada' })).toBeInTheDocument();
    expect(settingsApi.updatePlatformSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar retenção indeterminada' }));

    await waitFor(() =>
      expect(settingsApi.updatePlatformSettings).toHaveBeenCalledWith({ evidenceRetentionYears: -1 }),
    );
  });

  it('does not apply unlimited retention when the dedicated dialog is cancelled', async () => {
    vi.mocked(settingsApi.getPlatformSettings).mockResolvedValue(makeSettings());
    renderWithProviders(<EvidenceRetentionPanel />);

    const input = await screen.findByLabelText<HTMLInputElement>('Retenção de evidências (anos)');
    await waitFor(() => expect(input).toHaveValue(10));
    fireEvent.change(input, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Confirmar retenção indeterminada')).not.toBeInTheDocument();
    expect(settingsApi.updatePlatformSettings).not.toHaveBeenCalled();
  });

  // T091/FR-042: reduzir a janela nao libera o acervo ja gravado.
  it('warns that already-recorded evidence is not released when reducing the window', async () => {
    vi.mocked(settingsApi.getPlatformSettings).mockResolvedValue(makeSettings({ evidenceRetentionYears: 10 }));
    renderWithProviders(<EvidenceRetentionPanel />);

    const input = await screen.findByLabelText<HTMLInputElement>('Retenção de evidências (anos)');
    await waitFor(() => expect(input).toHaveValue(10));
    fireEvent.change(input, { target: { value: '5' } });

    expect(screen.getByText(/o acervo já gravado sob a janela anterior não é liberado/)).toBeInTheDocument();
  });

  it('saves a regular reduced value directly without the dedicated dialog', async () => {
    vi.mocked(settingsApi.getPlatformSettings).mockResolvedValue(makeSettings({ evidenceRetentionYears: 10 }));
    renderWithProviders(<EvidenceRetentionPanel />);

    const input = await screen.findByLabelText<HTMLInputElement>('Retenção de evidências (anos)');
    await waitFor(() => expect(input).toHaveValue(10));
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.queryByText('Confirmar retenção indeterminada')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(settingsApi.updatePlatformSettings).toHaveBeenCalledWith({ evidenceRetentionYears: 5 }),
    );
  });
});
