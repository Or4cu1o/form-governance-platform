import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ValidationDetailPage } from './ValidationDetailPage';
import { renderWithProviders } from '../test/render-with-providers';
import { makeReportInstance, makeUser } from '../test/fixtures';
import * as reportsApi from '../api/reports';
import * as AuthContextModule from '../context/AuthContext';
import type { IndicatorResponse } from '../types/api';

vi.mock('../api/reports');
vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../context/AuthContext')>('../context/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

function renderDetail(reportId = 'report-1') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/validacao/${reportId}`]}>
      <Routes>
        <Route path="/validacao/:id" element={<ValidationDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const pendingIndicator: IndicatorResponse = {
  id: 'response-1',
  reportInstanceId: 'report-1',
  formIndicatorId: 'indicator-1',
  snapshotTitle: 'Disponibilidade',
  snapshotObjective: 'Medir uptime',
  snapshotVariableKeys: [],
  snapshotFormulaExpression: '1',
  snapshotGoalOperator: 'GTE',
  snapshotGoalValue: '99',
  variableValues: {},
  calculatedValue: '99',
  calculationFailureReason: null,
  isCompliant: true,
  isClonedFromResident: false,
  inheritanceState: 'NAO_HERDADO',
  unresolvedInheritedKeys: [],
  validationStatus: 'PENDENTE_VALIDACAO',
  updatedByUserId: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  evidenceFiles: [],
  validationRecords: [],
};

describe('ValidationDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disables "Finalizar relatório" while an indicator is still pending validation', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser({ role: 'APROVADOR' }), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(
      makeReportInstance({ status: 'PENDENTE_APROVACAO', indicatorResponses: [pendingIndicator] }),
    );

    renderDetail();

    const finalizeButton = await screen.findByRole('button', { name: 'Finalizar relatório' });
    expect(finalizeButton).toBeDisabled();
  });

  it('enables "Finalizar relatório" once every indicator has a verdict', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser({ role: 'APROVADOR' }), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(
      makeReportInstance({
        status: 'PENDENTE_APROVACAO',
        indicatorResponses: [{ ...pendingIndicator, validationStatus: 'APROVADO' }],
      }),
    );

    renderDetail();

    const finalizeButton = await screen.findByRole('button', { name: 'Finalizar relatório' });
    expect(finalizeButton).not.toBeDisabled();
  });

  it('does not show the finalize action for a non-APROVADOR role', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({ user: makeUser({ role: 'REVISOR' }), isLoading: false, login: vi.fn(), logout: vi.fn() });
    vi.mocked(reportsApi.getReportInstance).mockResolvedValueOnce(
      makeReportInstance({ status: 'PENDENTE_APROVACAO', indicatorResponses: [pendingIndicator] }),
    );

    renderDetail();

    await screen.findByText('TI · março de 2026');
    expect(screen.queryByRole('button', { name: 'Finalizar relatório' })).not.toBeInTheDocument();
  });
});
