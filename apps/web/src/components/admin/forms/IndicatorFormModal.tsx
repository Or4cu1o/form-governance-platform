import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFormIndicator, updateFormIndicator } from '../../../api/forms';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../../ui';
import { GOAL_OPERATOR_SYMBOL } from '../../../lib/status';
import { CatalogEntryPicker } from './CatalogEntryPicker';
import type {
  CatalogEntry,
  FormIndicator,
  GoalOperator,
  IndicatorMutationResult,
  IndicatorScoreSummary,
} from '../../../types/api';

const GOAL_OPERATORS = Object.keys(GOAL_OPERATOR_SYMBOL) as GoalOperator[];
const VARIABLE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  topicId: string;
  indicator?: FormIndicator;
  onRebalanceProposed?: (rebalance: IndicatorScoreSummary) => void;
};

export function IndicatorFormModal({ isOpen, onClose, templateId, topicId, indicator, onRebalanceProposed }: Props) {
  const isEditing = Boolean(indicator);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [title, setTitle] = useState(indicator?.title ?? '');
  const [objective, setObjective] = useState(indicator?.objective ?? '');
  const [variableKeysInput, setVariableKeysInput] = useState((indicator?.variableKeys ?? []).join(', '));
  const [formulaExpression, setFormulaExpression] = useState(indicator?.formulaExpression ?? '');
  const [goalOperator, setGoalOperator] = useState<GoalOperator>(indicator?.goalOperator ?? 'GTE');
  const [goalValue, setGoalValue] = useState(indicator?.goalValue ?? '0');
  const [isResidentState, setIsResidentState] = useState(indicator?.isResidentState ?? false);
  const [order, setOrder] = useState(String(indicator?.order ?? 0));
  const [catalogEntryId, setCatalogEntryId] = useState(indicator?.catalogEntryId ?? '');
  const [selectedCatalogEntry, setSelectedCatalogEntry] = useState<CatalogEntry | undefined>(indicator?.catalogEntry);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (): Promise<FormIndicator | IndicatorMutationResult> => {
      const variableKeys = variableKeysInput
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      const input = {
        title,
        objective,
        variableKeys,
        formulaExpression,
        goalOperator,
        goalValue: Number(goalValue),
        catalogEntryId,
        isResidentState,
        order: Number(order),
      };
      return isEditing ? updateFormIndicator(indicator!.id, input) : createFormIndicator(topicId, input);
    },
    onSuccess: (result) => {
      showToast(isEditing ? 'Indicador atualizado.' : 'Indicador criado.', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-form-template', templateId] });
      queryClient.invalidateQueries({ queryKey: ['indicator-scores', templateId] });
      if ('weightRebalance' in result && result.weightRebalance) {
        onRebalanceProposed?.(result.weightRebalance);
      }
      onClose();
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o indicador.'),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const variableKeys = variableKeysInput
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);

    if (!title.trim() || !objective.trim() || !formulaExpression.trim()) {
      setError('Preencha título, objetivo e fórmula.');
      return;
    }
    if (variableKeys.length === 0) {
      setError('Informe ao menos uma chave de variável.');
      return;
    }
    if (variableKeys.some((key) => !VARIABLE_KEY_PATTERN.test(key))) {
      setError('Chaves devem começar com letra e conter apenas letras, números e "_".');
      return;
    }
    if (!catalogEntryId) {
      setError('Selecione ou crie um código de catálogo (FR-062).');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Editar indicador' : 'Novo indicador'} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Field label="Título" htmlFor="title" required>
          <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>

        <Field label="Objetivo" htmlFor="objective" required>
          <Textarea id="objective" rows={2} value={objective} onChange={(event) => setObjective(event.target.value)} />
        </Field>

        <Field
          label="Chaves de variáveis"
          htmlFor="variableKeys"
          required
          hint='Separadas por vírgula. Ex.: "Key_A, Key_B". Apenas letras, números e "_", iniciando com letra.'
        >
          <Input
            id="variableKeys"
            value={variableKeysInput}
            onChange={(event) => setVariableKeysInput(event.target.value)}
            className="font-mono"
          />
        </Field>

        <Field
          label="Fórmula"
          htmlFor="formulaExpression"
          required
          hint="Operadores + - * / e parênteses, usando as chaves acima como identificadores."
        >
          <Input
            id="formulaExpression"
            value={formulaExpression}
            onChange={(event) => setFormulaExpression(event.target.value)}
            className="font-mono"
            placeholder="(Key_A / (Key_B + Key_A)) * 100"
          />
        </Field>

        <Field label="Código de catálogo" htmlFor="catalogEntrySearch" required hint="Identidade estável da métrica entre formulários distintos (FR-062).">
          <CatalogEntryPicker
            value={catalogEntryId}
            selectedEntry={selectedCatalogEntry}
            onChange={(entry) => {
              setCatalogEntryId(entry.id);
              setSelectedCatalogEntry(entry);
            }}
          />
        </Field>

        <Field label="Operador da meta" htmlFor="goalOperator" required>
          <Select id="goalOperator" value={goalOperator} onChange={(event) => setGoalOperator(event.target.value as GoalOperator)}>
            {GOAL_OPERATORS.map((value) => (
              <option key={value} value={value}>
                {GOAL_OPERATOR_SYMBOL[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Valor da meta" htmlFor="goalValue" required>
          <Input id="goalValue" type="number" step="any" value={goalValue} onChange={(event) => setGoalValue(event.target.value)} className="data-figure max-w-xs" />
        </Field>

        <Field label="Ordem" htmlFor="order" hint="Posição do indicador dentro do tópico (menor aparece primeiro).">
          <Input id="order" type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} className="max-w-xs" />
        </Field>

        <label className="flex items-center gap-2.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={isResidentState}
            onChange={(event) => setIsResidentState(event.target.checked)}
            className="h-4 w-4 rounded border-border-strong accent-accent"
          />
          Estado residente (clona automaticamente do período anterior)
        </label>

        {error && (
          <p role="alert" className="text-sm text-status-reprovado">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEditing ? 'Salvar' : 'Criar indicador'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
