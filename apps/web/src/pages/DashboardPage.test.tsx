import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { renderWithProviders } from '../test/render-with-providers';
import { makeReportInstanceOverview } from '../test/fixtures';
import * as reportsApi from '../api/reports';

vi.mock('../api/reports');

function renderDashboard() {
  return renderWithProviders(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders report rows from every unit with action and export buttons', async () => {
    vi.mocked(reportsApi.getReportInstancesOverview).mockResolvedValueOnce([
      makeReportInstanceOverview({ unit: { id: 'unit-1', sigla: 'TI', nome: 'Tecnologia da Informação' } }),
      makeReportInstanceOverview({
        id: 'report-2',
        unitId: 'unit-2',
        unit: { id: 'unit-2', sigla: 'CRER', nome: 'Centro de Reabilitação' },
        status: 'CONCLUIDO',
        totalScore: '8.5',
      }),
    ]);

    renderDashboard();

    expect(await screen.findByText('Tecnologia da Informação')).toBeInTheDocument();
    expect(screen.getByText('Centro de Reabilitação')).toBeInTheDocument();
    expect(screen.getByText(/8,5/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Visualizar/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /CSV/i })[0]).toBeInTheDocument();
  });

  it('shows an empty state when there are no reports', async () => {
    vi.mocked(reportsApi.getReportInstancesOverview).mockResolvedValueOnce([]);

    renderDashboard();

    expect(await screen.findByText('Nenhum relatório encontrado')).toBeInTheDocument();
  });

  it('shows a dash for reports that have not been scored yet', async () => {
    vi.mocked(reportsApi.getReportInstancesOverview).mockResolvedValueOnce([
      makeReportInstanceOverview({ totalScore: null }),
    ]);

    renderDashboard();

    await screen.findByText('Tecnologia da Informação');
    expect(screen.getAllByText('—')[0]).toBeInTheDocument();
  });
});
