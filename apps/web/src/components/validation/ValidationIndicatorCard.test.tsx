import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { ValidationIndicatorCard } from './ValidationIndicatorCard';
import { renderWithProviders } from '../../test/render-with-providers';
import * as validationApi from '../../api/validation';
import type { IndicatorResponse } from '../../types/api';

vi.mock('../../api/validation');
vi.mock('../../api/evidence');

const baseResponse: IndicatorResponse = {
  id: 'response-1',
  reportInstanceId: 'report-1',
  formIndicatorId: 'indicator-1',
  snapshotTitle: 'Disponibilidade de sistemas',
  snapshotObjective: 'Medir uptime dos sistemas críticos',
  snapshotVariableKeys: ['uptimeMinutos', 'totalMinutos'],
  snapshotFormulaExpression: '(uptimeMinutos / totalMinutos) * 100',
  snapshotGoalOperator: 'GTE',
  snapshotGoalValue: '99',
  variableValues: { uptimeMinutos: 1430, totalMinutos: 1440 },
  calculatedValue: '99.30',
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

describe('ValidationIndicatorCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders indicator title, goal and calculated value as read-only', () => {
    renderWithProviders(<ValidationIndicatorCard response={baseResponse} reportInstanceId="report-1" isValidatable={false} />);

    expect(screen.getByText('Disponibilidade de sistemas')).toBeInTheDocument();
    expect(screen.getByText('≥ 99')).toBeInTheDocument();
    expect(screen.getByText('99,3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
  });

  it('shows Aprovar/Reprovar actions when isValidatable is true', () => {
    renderWithProviders(<ValidationIndicatorCard response={baseResponse} reportInstanceId="report-1" isValidatable />);

    expect(screen.getByRole('button', { name: /Aprovar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reprovar/ })).toBeInTheDocument();
  });

  it('opens the verdict modal and submits an APROVADO verdict', async () => {
    vi.mocked(validationApi.validateIndicator).mockResolvedValueOnce({
      id: 'record-1',
      indicatorResponseId: 'response-1',
      aprovadorUserId: 'user-2',
      verdict: 'APROVADO',
      justification: 'Dentro da meta.',
      createdAt: '2026-03-02T00:00:00.000Z',
    });

    renderWithProviders(<ValidationIndicatorCard response={baseResponse} reportInstanceId="report-1" isValidatable />);

    fireEvent.click(screen.getByRole('button', { name: /Aprovar/ }));
    expect(screen.getByText('Aprovar indicador')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Justificativa técnico-operacional/), {
      target: { value: 'Dentro da meta.' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação' }));
    });

    expect(validationApi.validateIndicator).toHaveBeenCalledWith('response-1', 'APROVADO', 'Dentro da meta.');
  });

  it('renders validation history with verdict labels', () => {
    const withHistory: IndicatorResponse = {
      ...baseResponse,
      validationRecords: [
        {
          id: 'record-1',
          indicatorResponseId: 'response-1',
          aprovadorUserId: 'user-2',
          verdict: 'REPROVADO',
          justification: 'Faltou evidência.',
          createdAt: '2026-03-02T00:00:00.000Z',
        },
      ],
    };

    renderWithProviders(<ValidationIndicatorCard response={withHistory} reportInstanceId="report-1" isValidatable={false} />);

    expect(screen.getByText('Reprovado')).toBeInTheDocument();
    expect(screen.getByText('Faltou evidência.')).toBeInTheDocument();
  });

  it('renders "Nenhuma evidência enviada." when there are no evidence files', () => {
    renderWithProviders(<ValidationIndicatorCard response={baseResponse} reportInstanceId="report-1" isValidatable={false} />);
    expect(screen.getByText('Nenhuma evidência enviada.')).toBeInTheDocument();
  });
});
