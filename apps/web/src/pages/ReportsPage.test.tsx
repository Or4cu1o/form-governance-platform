import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

  // T067/FR-058/US3-8: cada submissao aparece com etapa, autor, data e
  // resultado — um reenvio pos-reprova mostra AS DUAS linhas de REVISAO,
  // nao so a mais recente (nenhuma sobrescrita).
  it('shows every submission of the history without collapsing a resubmission after reprova', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.listReportInstances).mockResolvedValueOnce([
      makeReportInstance({
        status: 'EM_REVISAO',
        submissions: [
          {
            id: 'submission-1',
            reportInstanceId: 'report-1',
            stage: 'REVISAO',
            submittedByUserId: 'revisor-1',
            submittedAt: '2026-03-11T00:00:00.000Z',
            effectiveDueDate: '2026-03-10T00:00:00.000Z',
            wasOnTime: false,
            reprovalCountAtSubmission: 0,
            submittedByUser: { nome: 'Rita', sobrenome: 'Revisora' },
          },
          {
            id: 'submission-2',
            reportInstanceId: 'report-1',
            stage: 'REVISAO',
            submittedByUserId: 'revisor-1',
            submittedAt: '2026-03-20T00:00:00.000Z',
            effectiveDueDate: '2026-03-22T00:00:00.000Z',
            wasOnTime: true,
            reprovalCountAtSubmission: 1,
            submittedByUser: { nome: 'Rita', sobrenome: 'Revisora' },
          },
        ],
      }),
    ]);

    renderReports();

    expect(await screen.findByText('Fora do prazo')).toBeInTheDocument();
    expect(screen.getByText('No prazo')).toBeInTheDocument();
  });

  // T076: os controles ja disparam a mesma requisicao que o backend
  // (report-instances.service.ts) ja aceita — search e referenceMonthFrom/To.
  it('wires the search and reference-month filters to the list request', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.listReportInstances).mockResolvedValue([makeReportInstance()]);

    renderReports();
    await screen.findByRole('table');

    fireEvent.change(screen.getByLabelText('Buscar unidade'), { target: { value: 'TI' } });
    fireEvent.change(screen.getByLabelText('Período de (mês)'), { target: { value: '2026-01' } });
    fireEvent.change(screen.getByLabelText('Período até (mês)'), { target: { value: '2026-06' } });

    await waitFor(() => {
      expect(reportsApi.listReportInstances).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: 'TI',
          referenceMonthFrom: '2026-01-01',
          referenceMonthTo: '2026-06-01',
        }),
      );
    });
  });

  it('shows the 6-month score trend chart above the report list', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.listReportInstances).mockResolvedValueOnce([]);

    renderReports();

    expect(await screen.findByText('Desempenho — últimos 6 meses')).toBeInTheDocument();
  });
});
