import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { FormTemplateDetail } from './FormTemplateDetail';
import { renderWithProviders } from '../../../test/render-with-providers';
import * as formsApi from '../../../api/forms';
import type { FormTemplate } from '../../../types/api';

vi.mock('../../../api/forms');

const templateWithoutTopics: FormTemplate = {
  id: 'template-1',
  name: 'Formulário Mensal',
  description: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  topics: [],
};

const templateWithTopics: FormTemplate = {
  ...templateWithoutTopics,
  topics: [
    {
      id: 'topic-1',
      formTemplateId: 'template-1',
      title: 'Infraestrutura',
      order: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      indicators: [
        {
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
        },
      ],
    },
  ],
};

describe('FormTemplateDetail', () => {
  beforeEach(() => {
    vi.mocked(formsApi.getIndicatorScores).mockResolvedValue({ items: [], sum: 0, target: 10 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an empty state when the template has no topics', () => {
    renderWithProviders(<FormTemplateDetail template={templateWithoutTopics} />);
    expect(screen.getByText('Sem tópicos')).toBeInTheDocument();
  });

  it('renders topics and their indicators', () => {
    renderWithProviders(<FormTemplateDetail template={templateWithTopics} />);
    expect(screen.getByText('Infraestrutura')).toBeInTheDocument();
    expect(screen.getByText('Disponibilidade')).toBeInTheDocument();
    expect(screen.getByText('uptime, total')).toBeInTheDocument();
  });

  it('toggles a topic active status', async () => {
    vi.mocked(formsApi.deactivateFormTopic).mockResolvedValueOnce(templateWithTopics.topics![0]);

    renderWithProviders(<FormTemplateDetail template={templateWithTopics} />);

    await act(async () => {
      fireEvent.click(screen.getByTitle('Desativar tópico'));
    });

    expect(formsApi.deactivateFormTopic).toHaveBeenCalledWith('topic-1');
  });

  // T085/T089/US4-4: desativar um indicador que desbalanceia o restante
  // apresenta a redistribuicao proposta e exige confirmacao para aplicar.
  it('shows the weight rebalance confirmation dialog when toggling an indicator unbalances the active set', async () => {
    vi.mocked(formsApi.deactivateFormIndicator).mockResolvedValueOnce({
      indicator: { ...templateWithTopics.topics![0].indicators![0], isActive: false },
      weightRebalance: { items: [{ id: 'ind-2', title: 'Outro indicador', scoreWeight: 10 }], sum: 10, target: 10 },
    });

    renderWithProviders(<FormTemplateDetail template={templateWithTopics} />);

    await act(async () => {
      fireEvent.click(screen.getByTitle('Desativar indicador'));
    });

    expect(screen.getByText('Confirmar redistribuição de pesos')).toBeInTheDocument();
    expect(screen.getByText('Outro indicador')).toBeInTheDocument();
  });

  it('opens the indicator creation modal for a topic', () => {
    renderWithProviders(<FormTemplateDetail template={templateWithTopics} />);

    fireEvent.click(screen.getByRole('button', { name: /Indicador/ }));
    expect(screen.getByText('Novo indicador')).toBeInTheDocument();
  });

  it('collapses and expands a topic when its header is clicked', () => {
    renderWithProviders(<FormTemplateDetail template={templateWithTopics} />);

    const topicHeader = screen.getByRole('button', { name: /Infraestrutura/ });
    expect(topicHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Disponibilidade')).toBeInTheDocument();

    fireEvent.click(topicHeader);
    expect(topicHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Disponibilidade')).not.toBeInTheDocument();

    fireEvent.click(topicHeader);
    expect(topicHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Disponibilidade')).toBeInTheDocument();
  });
});
