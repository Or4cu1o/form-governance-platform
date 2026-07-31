import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlatformSettings, updatePlatformSettings } from '../../../api/settings';
import { Button, Field, Input, useToast } from '../../ui';
import type { SystemSetting } from '../../../types/api';

export function SlaSettingsPanel() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: settings } = useQuery({ queryKey: ['platform-settings'], queryFn: getPlatformSettings });

  const [elaborationDay, setElaborationDay] = useState('');
  const [reviewDay, setReviewDay] = useState('');
  const [approvalDay, setApprovalDay] = useState('');
  const [reprovalExtensionDays, setReprovalExtensionDays] = useState('');
  const [syncedSettings, setSyncedSettings] = useState<SystemSetting | undefined>(undefined);

  // Ajusta o estado durante o render (padrao recomendado pelo React) em vez
  // de useEffect com setState sincrono, que dispara um render em cascata.
  if (settings && settings !== syncedSettings) {
    setSyncedSettings(settings);
    setElaborationDay(String(settings.slaElaborationBusinessDay));
    setReviewDay(String(settings.slaReviewBusinessDay));
    setApprovalDay(String(settings.slaApprovalBusinessDay));
    setReprovalExtensionDays(String(settings.slaReprovalExtensionDays));
  }

  const mutation = useMutation({
    mutationFn: () =>
      updatePlatformSettings({
        slaElaborationBusinessDay: Number(elaborationDay),
        slaReviewBusinessDay: Number(reviewDay),
        slaApprovalBusinessDay: Number(approvalDay),
        slaReprovalExtensionDays: Number(reprovalExtensionDays),
      }),
    onSuccess: () => {
      showToast('Prazos de SLA atualizados.', 'success');
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    },
    onError: () => showToast('Não foi possível atualizar os prazos.', 'error'),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-paper-raised p-5 shadow-panel">
      <p className="text-sm text-ink-muted">
        Dia útil do mês em que cada fase do relatório vence. A elaboração deve vencer antes da revisão, que deve
        vencer antes da aprovação.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Elaboração (dia útil)" htmlFor="elaboration-day">
          <Input
            id="elaboration-day"
            type="number"
            min={1}
            max={28}
            value={elaborationDay}
            onChange={(event) => setElaborationDay(event.target.value)}
          />
        </Field>
        <Field label="Revisão (dia útil)" htmlFor="review-day">
          <Input
            id="review-day"
            type="number"
            min={1}
            max={28}
            value={reviewDay}
            onChange={(event) => setReviewDay(event.target.value)}
          />
        </Field>
        <Field label="Aprovação (dia útil)" htmlFor="approval-day">
          <Input
            id="approval-day"
            type="number"
            min={1}
            max={28}
            value={approvalDay}
            onChange={(event) => setApprovalDay(event.target.value)}
          />
        </Field>
        <Field
          label="Extensão por reprovação (dias úteis)"
          htmlFor="reproval-extension"
          hint="Prazo extra concedido quando algum indicador é reprovado na validação."
        >
          <Input
            id="reproval-extension"
            type="number"
            min={0}
            max={30}
            value={reprovalExtensionDays}
            onChange={(event) => setReprovalExtensionDays(event.target.value)}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" isLoading={mutation.isPending}>
          Salvar prazos
        </Button>
      </div>
    </form>
  );
}
