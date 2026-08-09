import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, PenSquare, Plus, Power, PowerOff } from 'lucide-react';
import {
  activateFormIndicator,
  activateFormTopic,
  deactivateFormIndicator,
  deactivateFormTopic,
} from '../../../api/forms';
import { Button, EmptyState, StatusBadge, Table, TBody, TD, TH, THead, TR, useToast } from '../../ui';
import { GOAL_OPERATOR_SYMBOL } from '../../../lib/status';
import { formatNumber } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import { TopicFormModal } from './TopicFormModal';
import { IndicatorFormModal } from './IndicatorFormModal';
import { IndicatorScorePanel } from './IndicatorScorePanel';
import { WeightRebalanceModal } from './WeightRebalanceModal';
import type { FormIndicator, FormTemplate, FormTopic, IndicatorScoreSummary } from '../../../types/api';

type TopicModalState = { type: 'create' } | { type: 'edit'; topic: FormTopic } | null;
type IndicatorModalState = { type: 'create'; topicId: string } | { type: 'edit'; topicId: string; indicator: FormIndicator } | null;

type Props = {
  template: FormTemplate;
};

export function FormTemplateDetail({ template }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [topicModal, setTopicModal] = useState<TopicModalState>(null);
  const [indicatorModal, setIndicatorModal] = useState<IndicatorModalState>(null);
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});
  const [pendingRebalance, setPendingRebalance] = useState<IndicatorScoreSummary | null>(null);

  function isTopicOpen(topicId: string) {
    return openTopics[topicId] ?? true;
  }

  function toggleTopic(topicId: string) {
    setOpenTopics((prev) => ({ ...prev, [topicId]: !isTopicOpen(topicId) }));
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-form-template', template.id] });
  }

  const toggleTopicMutation = useMutation({
    mutationFn: (topic: FormTopic) => (topic.isActive ? deactivateFormTopic(topic.id) : activateFormTopic(topic.id)),
    onSuccess: () => {
      showToast('Status do tópico atualizado.', 'success');
      invalidate();
    },
    onError: () => showToast('Não foi possível atualizar o tópico.', 'error'),
  });

  const toggleIndicatorMutation = useMutation({
    mutationFn: (indicator: FormIndicator) =>
      indicator.isActive ? deactivateFormIndicator(indicator.id) : activateFormIndicator(indicator.id),
    onSuccess: (result) => {
      showToast('Status do indicador atualizado.', 'success');
      invalidate();
      // T085: ativar/inativar muda o conjunto ativo — o painel de pontuacao
      // precisa recalcular, e uma redistribuicao proposta pode ter voltado.
      queryClient.invalidateQueries({ queryKey: ['indicator-scores', template.id] });
      if (result.weightRebalance) {
        setPendingRebalance(result.weightRebalance);
      }
    },
    onError: () => showToast('Não foi possível atualizar o indicador.', 'error'),
  });

  const topics = template.topics ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{template.name}</h2>
          {template.description && <p className="text-sm text-ink-muted">{template.description}</p>}
        </div>
        <Button size="sm" onClick={() => setTopicModal({ type: 'create' })}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Novo tópico
        </Button>
      </div>

      {topics.length === 0 && <EmptyState title="Sem tópicos" description="Crie o primeiro tópico deste formulário." />}

      <IndicatorScorePanel templateId={template.id} />

      {topics
        .sort((a, b) => a.order - b.order)
        .map((topic) => {
          const isOpen = isTopicOpen(topic.id);
          return (
            <div key={topic.id} className="rounded-lg border border-border bg-paper-raised shadow-panel">
              <div className="flex items-center justify-between p-5">
                <button
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  aria-expanded={isOpen}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-ink-faint transition-transform duration-fast ease-out-expo',
                      !isOpen && '-rotate-90',
                    )}
                    aria-hidden="true"
                  />
                  <h3 className="font-medium text-ink">{topic.title}</h3>
                  <StatusBadge tone={topic.isActive ? 'concluido' : 'pendente'} label={topic.isActive ? 'Ativo' : 'Inativo'} />
                </button>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setIndicatorModal({ type: 'create', topicId: topic.id })}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Indicador
                  </Button>
                  <button
                    type="button"
                    title="Editar tópico"
                    onClick={() => setTopicModal({ type: 'edit', topic })}
                    className="rounded p-1.5 text-ink-faint hover:bg-paper hover:text-ink"
                  >
                    <PenSquare className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title={topic.isActive ? 'Desativar tópico' : 'Ativar tópico'}
                    onClick={() => toggleTopicMutation.mutate(topic)}
                    className="rounded p-1.5 text-ink-faint hover:bg-paper hover:text-ink"
                  >
                    {topic.isActive ? <PowerOff className="h-4 w-4" aria-hidden="true" /> : <Power className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-5 pb-5">
                  {(topic.indicators ?? []).length === 0 ? (
                    <p className="text-sm text-ink-faint">Nenhum indicador neste tópico.</p>
                  ) : (
                    <Table>
                      <THead>
                        <TR>
                          <TH>Indicador</TH>
                          <TH>Chaves</TH>
                          <TH>Fórmula</TH>
                          <TH>Meta</TH>
                          <TH>Status</TH>
                          <TH>Ações</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {[...(topic.indicators ?? [])]
                          .sort((a, b) => a.order - b.order)
                          .map((indicator) => (
                            <TR key={indicator.id}>
                              <TD className="max-w-xs">
                                <p className="font-medium text-ink">{indicator.title}</p>
                                {indicator.isResidentState && <p className="text-xs text-ink-faint">Estado residente</p>}
                              </TD>
                              <TD className="font-mono text-xs text-ink-muted">{indicator.variableKeys.join(', ')}</TD>
                              <TD className="font-mono text-xs text-ink-muted">{indicator.formulaExpression}</TD>
                              <TD className="data-figure text-sm">
                                {GOAL_OPERATOR_SYMBOL[indicator.goalOperator]} {formatNumber(indicator.goalValue)}
                              </TD>
                              <TD>
                                <StatusBadge
                                  tone={indicator.isActive ? 'concluido' : 'pendente'}
                                  label={indicator.isActive ? 'Ativo' : 'Inativo'}
                                />
                              </TD>
                              <TD>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    title="Editar indicador"
                                    onClick={() => setIndicatorModal({ type: 'edit', topicId: topic.id, indicator })}
                                    className="rounded p-1.5 text-ink-faint hover:bg-paper hover:text-ink"
                                  >
                                    <PenSquare className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    title={indicator.isActive ? 'Desativar indicador' : 'Ativar indicador'}
                                    onClick={() => toggleIndicatorMutation.mutate(indicator)}
                                    className="rounded p-1.5 text-ink-faint hover:bg-paper hover:text-ink"
                                  >
                                    {indicator.isActive ? (
                                      <PowerOff className="h-4 w-4" aria-hidden="true" />
                                    ) : (
                                      <Power className="h-4 w-4" aria-hidden="true" />
                                    )}
                                  </button>
                                </div>
                              </TD>
                            </TR>
                          ))}
                      </TBody>
                    </Table>
                  )}
                </div>
              )}
            </div>
          );
        })}

      <TopicFormModal
        isOpen={topicModal?.type === 'create'}
        onClose={() => setTopicModal(null)}
        templateId={template.id}
      />
      {topicModal?.type === 'edit' && (
        <TopicFormModal isOpen onClose={() => setTopicModal(null)} templateId={template.id} topic={topicModal.topic} />
      )}

      {indicatorModal?.type === 'create' && (
        <IndicatorFormModal
          isOpen
          onClose={() => setIndicatorModal(null)}
          templateId={template.id}
          topicId={indicatorModal.topicId}
          onRebalanceProposed={setPendingRebalance}
        />
      )}
      {indicatorModal?.type === 'edit' && (
        <IndicatorFormModal
          isOpen
          onClose={() => setIndicatorModal(null)}
          templateId={template.id}
          topicId={indicatorModal.topicId}
          indicator={indicatorModal.indicator}
          onRebalanceProposed={setPendingRebalance}
        />
      )}

      {pendingRebalance && (
        <WeightRebalanceModal
          templateId={template.id}
          rebalance={pendingRebalance}
          onClose={() => setPendingRebalance(null)}
        />
      )}
    </div>
  );
}
