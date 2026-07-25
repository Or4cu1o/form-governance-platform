import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportsPage } from './ReportsPage';
import { renderWithProviders } from '../test/render-with-providers';
import { makeReportInstance, makeUser } from '../test/fixtures';
import * as reportsApi from '../api/reports';
import * as AuthContextModule from '../context/AuthContext';

vi.mock('../api/reports');
vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../context/AuthContext')>('../context/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

function renderReports() {
  return renderWithProviders(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>,
  );
}

describe('ReportsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the actionable banner when a PENDENTE report matches an ELABORADOR', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser({ role: 'ELABORADOR' }), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.listReportInstances).mockResolvedValueOnce([makeReportInstance({ status: 'PENDENTE' })]);

    renderReports();

    expect(await screen.findByText(/aguarda sua ação/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Iniciar elaboração/i })[0]).toHaveAttribute('href', '/relatorios/report-1');
  });

  it('does not show the actionable banner when no report matches the user role and status', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser({ role: 'REVISOR' }), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.listReportInstances).mockResolvedValueOnce([makeReportInstance({ status: 'PENDENTE' })]);

    renderReports();

    await screen.findByRole('table');
    expect(screen.queryByText(/aguarda sua ação/)).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no reports for the unit', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.listReportInstances).mockResolvedValueOnce([]);

    renderReports();

    expect(await screen.findByText('Nenhum relatório encontrado')).toBeInTheDocument();
  });

  it('shows the SLA deadline and score columns for each report', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.listReportInstances).mockResolvedValueOnce([
      makeReportInstance({ status: 'CONCLUIDO', totalScore: '8', concludedAt: '2026-03-05T00:00:00.000Z' }),
    ]);

    renderReports();

    expect(await screen.findByText('Concluído em')).toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
  });

  it('shows the 6-month score trend chart above the report list', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.listReportInstances).mockResolvedValueOnce([]);

    renderReports();

    expect(await screen.findByText('Desempenho — últimos 6 meses')).toBeInTheDocument();
  });
});
