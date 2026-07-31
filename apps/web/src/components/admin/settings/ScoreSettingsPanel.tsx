import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlatformSettings, updatePlatformSettings } from '../../../api/settings';
import { Button, Field, Input, useToast } from '../../ui';
import type { SystemSetting } from '../../../types/api';

export function ScoreSettingsPanel() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: settings } = useQuery({ queryKey: ['platform-settings'], queryFn: getPlatformSettings });
  const [deflatorScore, setDeflatorScore] = useState('');
  const [syncedSettings, setSyncedSettings] = useState<SystemSetting | undefined>(undefined);

  // Ajusta o estado durante o render (padrao recomendado pelo React) em vez
  // de useEffect com setState sincrono, que dispara um render em cascata.
  if (settings && settings !== syncedSettings) {
    setSyncedSettings(settings);
    setDeflatorScore(String(settings.slaDeflatorScore));
  }

  const mutation = useMutation({
    mutationFn: () => updatePlatformSettings({ slaDeflatorScore: Number(deflatorScore) }),
    onSuccess: () => {
      showToast('Nota de deflator atualizada.', 'success');
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    },
    onError: () => showToast('Não foi possível atualizar a nota de deflator.', 'error'),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-paper-raised p-5 shadow-panel">
      <p className="text-sm text-ink-muted">
        A nota do relatório soma o peso de cada indicador com meta batida e aprovado na Mesa de Validação — a soma
        dos pesos de um formulário é sempre 10 (configure os pesos em Formulários). O valor abaixo é <strong>subtraído</strong> da nota final uma vez para cada etapa (elaboração e revisão) que ultrapassar o prazo de SLA.
      </p>
      <Field label="Nota de deflator por atraso" htmlFor="deflator-score" hint="Padrão: 2 pontos por etapa fora do prazo.">
        <Input
          id="deflator-score"
          type="number"
          step="0.01"
          min={0}
          max={10}
          value={deflatorScore}
          onChange={(event) => setDeflatorScore(event.target.value)}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" isLoading={mutation.isPending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
