import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { IndicatorFormModal } from './IndicatorFormModal';
import { renderWithProviders } from '../../../test/render-with-providers';
import * as formsApi from '../../../api/forms';
import * as catalogApi from '../../../api/catalog';
import type { FormIndicator } from '../../../types/api';

vi.mock('../../../api/forms');
vi.mock('../../../api/catalog');

const indicator: FormIndicator = {
  id: 'indicator-1',
  formTopicId: 'topic-1',
  title: 'Disponibilidade',
  objective: 'Medir uptime',
  variableKeys: ['uptime', 'total'],
  formulaExpression: '(uptime / total) * 100',
  goalOperator: 'GTE',
  goalValue: '99',
  isResidentState: false,
  order: 0,
  isActive: true,
  scoreWeight: '0',
  catalogEntryId: 'catalog-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Disponibilidade' } });
  fireEvent.change(screen.getByLabelText(/^Objetivo/), { target: { value: 'Medir uptime' } });
  fireEvent.change(screen.getByLabelText(/Fórmula/), { target: { value: '(uptime / total) * 100' } });
}

describe('IndicatorFormModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires title, objective and formula before submitting', () => {
    renderWithProviders(<IndicatorFormModal isOpen onClose={vi.fn()} templateId="template-1" topicId="topic-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar indicador' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha título, objetivo e fórmula.');
    expect(formsApi.createFormIndicator).not.toHaveBeenCalled();
  });

  it('requires at least one variable key', () => {
    renderWithProviders(<IndicatorFormModal isOpen onClose={vi.fn()} templateId="template-1" topicId="topic-1" />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: 'Criar indicador' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe ao menos uma chave de variável.');
  });

  it('rejects variable keys that do not match the identifier pattern', () => {
    renderWithProviders(<IndicatorFormModal isOpen onClose={vi.fn()} templateId="template-1" topicId="topic-1" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/Chaves de variáveis/), { target: { value: '1invalid, uptime' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar indicador' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Chaves devem começar com letra');
    expect(formsApi.createFormIndicator).not.toHaveBeenCalled();
  });

  it('requires a catalog entry before submitting (FR-062)', () => {
    renderWithProviders(<IndicatorFormModal isOpen onClose={vi.fn()} templateId="template-1" topicId="topic-1" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/Chaves de variáveis/), { target: { value: 'uptime, total' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar indicador' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Selecione ou crie um código de catálogo');
    expect(formsApi.createFormIndicator).not.toHaveBeenCalled();
  });

  it('creates an indicator with parsed variable keys, numeric fields and the selected catalog entry', async () => {
    vi.mocked(catalogApi.searchCatalog).mockResolvedValueOnce([
      { id: 'catalog-1', code: 'DISP-01', name: 'Disponibilidade', description: null, measurementUnit: '%', isActive: true, createdAt: '', updatedAt: '' },
    ]);
    vi.mocked(formsApi.createFormIndicator).mockResolvedValueOnce({ indicator, weightRebalance: null });
    const onClose = vi.fn();

    renderWithProviders(<IndicatorFormModal isOpen onClose={onClose} templateId="template-1" topicId="topic-1" />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/Chaves de variáveis/), { target: { value: 'uptime, total' } });
    fireEvent.change(screen.getByLabelText(/^Valor da meta/), { target: { value: '99' } });

    fireEvent.change(screen.getByLabelText(/Código de catálogo/), { target: { value: 'DISP' } });
    await waitFor(() => expect(screen.getByText(/DISP-01/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/DISP-01/));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Criar indicador' }));
    });

    expect(formsApi.createFormIndicator).toHaveBeenCalledWith('topic-1', {
      title: 'Disponibilidade',
      objective: 'Medir uptime',
      variableKeys: ['uptime', 'total'],
      formulaExpression: '(uptime / total) * 100',
      goalOperator: 'GTE',
      goalValue: 99,
      catalogEntryId: 'catalog-1',
      isResidentState: false,
      order: 0,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
