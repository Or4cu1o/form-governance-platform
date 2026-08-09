import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { IndicatorResponseCard } from './IndicatorResponseCard';
import { renderWithProviders } from '../../test/render-with-providers';
import * as indicatorResponsesApi from '../../api/indicator-responses';
import { ApiError } from '../../lib/api-error';
import type { IndicatorResponse } from '../../types/api';

vi.mock('../../api/indicator-responses');
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
  validationStatus: 'EM_REVISAO',
  updatedByUserId: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  evidenceFiles: [],
  validationRecords: [],
};

describe('IndicatorResponseCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders indicator title, objective, goal and calculated value', () => {
    renderWithProviders(<IndicatorResponseCard response={baseResponse} reportInstanceId="report-1" isEditable={false} />);

    expect(screen.getByText('Disponibilidade de sistemas')).toBeInTheDocument();
    expect(screen.getByText('Medir uptime dos sistemas críticos')).toBeInTheDocument();
    expect(screen.getByText('≥ 99')).toBeInTheDocument();
    expect(screen.getByText('Dentro da meta')).toBeInTheDocument();
  });

  it('disables inputs and hides the save button when not editable', () => {
    renderWithProviders(<IndicatorResponseCard response={baseResponse} reportInstanceId="report-1" isEditable={false} />);

    expect(screen.getByLabelText('uptimeMinutos')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salvar valores' })).not.toBeInTheDocument();
  });

  it('keeps the save button disabled until a value changes, then saves the parsed values', async () => {
    vi.mocked(indicatorResponsesApi.updateIndicatorResponseValues).mockResolvedValueOnce(baseResponse);

    renderWithProviders(<IndicatorResponseCard response={baseResponse} reportInstanceId="report-1" isEditable />);

    const saveButton = screen.getByRole('button', { name: 'Salvar valores' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('uptimeMinutos'), { target: { value: '1435' } });
    expect(saveButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(indicatorResponsesApi.updateIndicatorResponseValues).toHaveBeenCalledWith(
      'response-1',
      {
        uptimeMinutos: 1435,
        totalMinutos: 1440,
      },
      '',
      '',
    );
  });

  it('shows "Fora da meta" when isCompliant is false', () => {
    renderWithProviders(
      <IndicatorResponseCard response={{ ...baseResponse, isCompliant: false }} reportInstanceId="report-1" isEditable={false} />,
    );
    expect(screen.getByText('Fora da meta')).toBeInTheDocument();
  });

  it('shows "Aguardando valores" when isCompliant is null', () => {
    renderWithProviders(
      <IndicatorResponseCard response={{ ...baseResponse, isCompliant: null }} reportInstanceId="report-1" isEditable={false} />,
    );
    expect(screen.getByText('Aguardando valores')).toBeInTheDocument();
  });

  // T054 (FR-037): estado de verificacao de seguranca pendente fica visivel
  // na lista de evidencias, com rotulo textual (nao so cor, FR-125).
  it('shows a pending security verification label for an evidence file awaiting antivirus scan', () => {
    const withPendingEvidence: IndicatorResponse = {
      ...baseResponse,
      evidenceFiles: [
        {
          id: 'evidence-1',
          indicatorResponseId: 'response-1',
          validationRecordId: null,
          fileKey: 'some-key.pdf',
          fileName: 'comprovante.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadedByUserId: 'user-1',
          isActive: true,
          scanStatus: 'PENDENTE',
          createdAt: '2026-03-01T00:00:00.000Z',
        },
      ],
    };

    renderWithProviders(
      <IndicatorResponseCard response={withPendingEvidence} reportInstanceId="report-1" isEditable={false} />,
    );

    expect(screen.getByText('verificação pendente')).toBeInTheDocument();
  });

  // T054 (FR-040): arquivo bloqueado pelo antivirus fica visivelmente
  // desabilitado — nao tenta baixar nem finge que o arquivo esta disponivel.
  it('disables download and shows a blocked label for evidence blocked by antivirus', () => {
    const withBlockedEvidence: IndicatorResponse = {
      ...baseResponse,
      evidenceFiles: [
        {
          id: 'evidence-2',
          indicatorResponseId: 'response-1',
          validationRecordId: null,
          fileKey: 'some-key.pdf',
          fileName: 'suspeito.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          uploadedByUserId: 'user-1',
          isActive: true,
          scanStatus: 'BLOQUEADO',
          createdAt: '2026-03-01T00:00:00.000Z',
        },
      ],
    };

    renderWithProviders(
      <IndicatorResponseCard response={withBlockedEvidence} reportInstanceId="report-1" isEditable={false} />,
    );

    expect(screen.getByText('bloqueado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /suspeito\.pdf/ })).toBeDisabled();
  });

  // T054 (FR-035): a recusa por tipo mostra o motivo especifico devolvido
  // pelo backend, nao um erro generico.
  it('shows the specific backend rejection reason when the upload is refused by type', async () => {
    vi.mocked(indicatorResponsesApi.uploadIndicatorEvidence).mockRejectedValueOnce(
      new ApiError(400, 'A extensao do arquivo nao corresponde ao tipo declarado (application/pdf).'),
    );

    renderWithProviders(<IndicatorResponseCard response={baseResponse} reportInstanceId="report-1" isEditable />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['conteudo'], 'evidencia.png', { type: 'application/pdf' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(
      await screen.findByText('A extensao do arquivo nao corresponde ao tipo declarado (application/pdf).'),
    ).toBeInTheDocument();
  });

  it('renders validation history entries when present', () => {
    const withHistory: IndicatorResponse = {
      ...baseResponse,
      validationRecords: [
        {
          id: 'record-1',
          indicatorResponseId: 'response-1',
          aprovadorUserId: 'user-2',
          verdict: 'REPROVADO',
          justification: 'Faltou evidência de contraprova.',
          createdAt: '2026-03-02T00:00:00.000Z',
        },
      ],
    };

    renderWithProviders(<IndicatorResponseCard response={withHistory} reportInstanceId="report-1" isEditable={false} />);

    expect(screen.getByText('Reprovado')).toBeInTheDocument();
    expect(screen.getByText('Faltou evidência de contraprova.')).toBeInTheDocument();
  });

  it('renders "Nenhuma evidência enviada." when there are no evidence files', () => {
    renderWithProviders(<IndicatorResponseCard response={baseResponse} reportInstanceId="report-1" isEditable={false} />);
    expect(screen.getByText('Nenhuma evidência enviada.')).toBeInTheDocument();
  });
});
