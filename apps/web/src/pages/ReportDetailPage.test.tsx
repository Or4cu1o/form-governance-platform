import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportDetailPage } from './ReportDetailPage';
import { renderWithProviders } from '../test/render-with-providers';
import { makeIndicatorResponse, makeReportInstance, makeUser } from '../test/fixtures';
import * as reportsApi from '../api/reports';
import * as indicatorResponsesApi from '../api/indicator-responses';
import * as AuthContextModule from '../context/AuthContext';

vi.mock('../api/reports');
vi.mock('../api/indicator-responses');
vi.mock('../api/evidence');
vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../context/AuthContext')>('../context/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

function renderDetail(reportId = 'report-1') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/relatorios/${reportId}`]}>
      <Routes>
        <Route path="/relatorios/:id" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReportDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an empty state when the report cannot be loaded', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockRejectedValueOnce(new Error('not found'));

    renderDetail();

    expect(await screen.findByText('Relatório não encontrado')).toBeInTheDocument();
  });

  it('shows the "Enviar para revisão" action for an ELABORADOR on their own PENDENTE report', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser({ role: 'ELABORADOR', primaryUnitId: 'unit-1' }), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(makeReportInstance({ status: 'PENDENTE', unitId: 'unit-1' }));

    renderDetail();

    expect(await screen.findByRole('button', { name: 'Enviar para revisão' })).toBeInTheDocument();
  });

  it('does not show submit actions for a REVISOR on a report from another unit', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser({ role: 'REVISOR', primaryUnitId: 'unit-2' }), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(makeReportInstance({ status: 'EM_REVISAO', unitId: 'unit-1' }));

    renderDetail();

    await screen.findByText('TI · março de 2026');
    expect(screen.queryByRole('button', { name: 'Enviar para aprovação' })).not.toBeInTheDocument();
  });

  it('shows the reproval banner when the report was sent back from the Matriz', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser({ role: 'REVISOR', primaryUnitId: 'unit-1' }), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(
      makeReportInstance({ status: 'EM_REVISAO', unitId: 'unit-1', reprovalCount: 1 }),
    );

    renderDetail();

    expect(await screen.findByText(/reprovado pela Matriz/)).toBeInTheDocument();
  });

  it('shows an empty state when the report has no indicators', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(makeReportInstance({ indicatorResponses: [] }));

    renderDetail();

    expect(await screen.findByText('Sem indicadores')).toBeInTheDocument();
  });

  it('shows the final score banner for a concluded report', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(
      makeReportInstance({
        status: 'CONCLUIDO',
        indicatorScore: '10',
        slaDeflatorApplied: '2',
        totalScore: '8',
        isElaborationOnTime: true,
        isReviewOnTime: false,
      }),
    );

    renderDetail();

    expect(await screen.findByText('Nota final do relatório')).toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
  });

  it('does not show the final score banner when the report has not been scored yet', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(makeReportInstance({ status: 'PENDENTE' }));

    renderDetail();

    await screen.findByText(/Elaboração e revisão/);
    expect(screen.queryByText('Nota final do relatório')).not.toBeInTheDocument();
  });

  // T053 (FR-024/FR-025/FR-028): sinalizacao de heranca e motivo de falha
  // de calculo aparecem na propria linha do indicador.
  it('shows the inheritance badge and the exact calculation failure reason on the indicator line', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    const partialIndicator = makeIndicatorResponse({
      id: 'response-partial',
      inheritanceState: 'HERDADO_PARCIAL',
      calculatedValue: null,
      isCompliant: null,
      calculationFailureReason: 'Aguardando valor de: totalMinutos',
    });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(
      makeReportInstance({ indicatorResponses: [partialIndicator] }),
    );

    renderDetail();

    expect(await screen.findByText('Herdado parcialmente — confira')).toBeInTheDocument();
    expect(screen.getByText('Aguardando valor de: totalMinutos')).toBeInTheDocument();
  });

  // FR-127: salvar um indicador nao pode disparar um refetch do relatorio
  // inteiro nem alterar o outro indicador na tela — so o card afetado (e os
  // totais derivados dele) reflete a mudanca.
  it('patches only the saved indicator without refetching the whole report or touching the other indicator (FR-127)', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: makeUser({ role: 'ELABORADOR', primaryUnitId: 'unit-1' }),
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    const responseA = makeIndicatorResponse({ id: 'response-a', snapshotTitle: 'Indicador A' });
    const responseB = makeIndicatorResponse({
      id: 'response-b',
      snapshotTitle: 'Indicador B',
      snapshotVariableKeys: ['minutosParados'],
      variableValues: { minutosParados: 5 },
    });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(
      makeReportInstance({ status: 'PENDENTE', unitId: 'unit-1', indicatorResponses: [responseA, responseB] }),
    );
    vi.mocked(indicatorResponsesApi.updateIndicatorResponseValues).mockResolvedValueOnce({
      ...responseA,
      variableValues: { uptimeMinutos: 1435, totalMinutos: 1440 },
      calculatedValue: '99.65',
    });

    renderDetail();
    await screen.findByText('Indicador A');
    await screen.findByText('Indicador B');

    const [uptimeInputA] = screen.getAllByLabelText('uptimeMinutos');
    fireEvent.change(uptimeInputA, { target: { value: '1435' } });
    const [saveButtonA] = screen.getAllByRole('button', { name: 'Salvar valores' });
    await act(async () => {
      fireEvent.click(saveButtonA);
    });

    expect(await screen.findByText('99,65')).toBeInTheDocument();
    // Nenhum segundo carregamento do relatorio inteiro — so o PATCH pontual.
    expect(reportsApi.getReportInstance).toHaveBeenCalledTimes(1);
    // O indicador nao tocado mantem seu proprio valor intacto.
    expect(screen.getByLabelText('minutosParados')).toHaveValue(5);
  });
});
