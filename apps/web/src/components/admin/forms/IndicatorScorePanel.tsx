import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target } from 'lucide-react';
import { distributeIndicatorScores, getIndicatorScores, updateIndicatorScores } from '../../../api/forms';
import { Button, Spinner, useToast } from '../../ui';
import { cn } from '../../../lib/cn';
import type { IndicatorScoreSummary } from '../../../types/api';

const SCORE_TARGET = 10;
const SCORE_SUM_TOLERANCE = 0.01;

type Props = {
  templateId: string;
};

export function IndicatorScorePanel({ templateId }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [syncedSummary, setSyncedSummary] = useState<IndicatorScoreSummary | undefined>(undefined);

  const queryKey = ['indicator-scores', templateId];
  const { data: summary, isLoading } = useQuery({
    queryKey,
    queryFn: () => getIndicatorScores(templateId),
  });

  // Ajusta o estado durante o render (padrao recomendado pelo React para
  // resincronizar estado derivado de dados assincronos) em vez de um
  // useEffect com setState sincrono, que dispara um render em cascata.
  if (summary && summary !== syncedSummary) {
    setSyncedSummary(summary);
    setWeights(Object.fromEntries(summary.items.map((item) => [item.id, String(item.scoreWeight)])));
  }

  const saveMutation = useMutation({
    mutationFn: (payload: Array<{ indicatorId: string; scoreWeight: number }>) =>
      updateIndicatorScores(templateId, payload),
    onSuccess: () => {
      showToast('Pontuação dos indicadores salva.', 'success');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => showToast('Não foi possível salvar a pontuação.', 'error'),
  });

  const distributeMutation = useMutation({
    mutationFn: () => distributeIndicatorScores(templateId),
    onSuccess: () => {
      showToast('Pontuação distribuída igualmente.', 'success');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => showToast('Não foi possível distribuir a pontuação.', 'error'),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border-2 border-accent/30 bg-accent-50 p-5 shadow-panel">
        <Spinner label="Carregando pontuação..." />
      </div>
    );
  }
  if (!summary || summary.items.length === 0) {
    return null;
  }

  const sum = summary.items.reduce((total, item) => total + (Number(weights[item.id]) || 0), 0);
  const isBalanced = Math.abs(sum - SCORE_TARGET) <= SCORE_SUM_TOLERANCE;

  function handleWeightChange(indicatorId: string, value: string) {
    setWeights((prev) => ({ ...prev, [indicatorId]: value }));
  }

  function handleSave() {
    const payload = summary!.items.map((item) => ({
      indicatorId: item.id,
      scoreWeight: Number(weights[item.id]) || 0,
    }));
    saveMutation.mutate(payload);
  }

  return (
    <div className="rounded-lg border-2 border-accent/30 bg-accent-50 p-5 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"
            aria-hidden="true"
          >
            <Target className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-700">
              Pontuação por relatório
            </p>
            <h3 className="font-display text-base font-semibold text-ink">Peso dos indicadores</h3>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded px-2.5 py-1 text-xs font-semibold data-figure',
            isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
          )}
        >
          Soma: {sum.toFixed(2)} / {SCORE_TARGET}
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Cada indicador soma este peso à nota do relatório quando sua meta é batida e aprovada. A soma dos pesos
        ativos deve totalizar {SCORE_TARGET}.
      </p>

      <div className="mt-4 flex flex-col gap-2 rounded-md bg-paper-raised p-3">
        {summary.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex-1 truncate text-ink">{item.title}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={SCORE_TARGET}
              value={weights[item.id] ?? ''}
              onChange={(event) => handleWeightChange(item.id, event.target.value)}
              className="w-24 rounded border border-border bg-paper px-2 py-1 text-right data-figure text-ink"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => distributeMutation.mutate()} isLoading={distributeMutation.isPending}>
          Distribuir igualmente
        </Button>
        <Button size="sm" onClick={handleSave} isLoading={saveMutation.isPending} disabled={!isBalanced}>
          Salvar pontuação
        </Button>
      </div>
    </div>
  );
}
