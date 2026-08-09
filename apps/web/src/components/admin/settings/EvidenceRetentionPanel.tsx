import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { getPlatformSettings, updatePlatformSettings } from '../../../api/settings';
import { Button, Field, Input, Modal, useToast } from '../../ui';
import type { SystemSetting } from '../../../types/api';

const INDETERMINATE = -1;

export function EvidenceRetentionPanel() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: settings } = useQuery({ queryKey: ['platform-settings'], queryFn: getPlatformSettings });
  const [years, setYears] = useState('');
  const [syncedSettings, setSyncedSettings] = useState<SystemSetting | undefined>(undefined);
  const [showIndeterminateConfirm, setShowIndeterminateConfirm] = useState(false);

  if (settings && settings !== syncedSettings) {
    setSyncedSettings(settings);
    setYears(String(settings.evidenceRetentionYears));
  }

  const mutation = useMutation({
    mutationFn: (value: number) => updatePlatformSettings({ evidenceRetentionYears: value }),
    onSuccess: () => {
      showToast('Janela de retenção de evidências atualizada.', 'success');
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      setShowIndeterminateConfirm(false);
    },
    onError: () => showToast('Não foi possível atualizar a retenção de evidências.', 'error'),
  });

  const isCurrentlyIndeterminate = settings?.evidenceRetentionYears === INDETERMINATE;
  const requestedValue = Number(years);
  const isRequestingIndeterminate = years.trim() === String(INDETERMINATE);
  const isReducing =
    !isRequestingIndeterminate &&
    !isCurrentlyIndeterminate &&
    settings !== undefined &&
    requestedValue < settings.evidenceRetentionYears;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // US4-10: retencao indeterminada exige dialogo dedicado, distinto do
    // salvamento comum, com a irreversibilidade explicitada antes da
    // confirmacao — nunca aplicada por um simples "Salvar".
    if (isRequestingIndeterminate && !isCurrentlyIndeterminate) {
      setShowIndeterminateConfirm(true);
      return;
    }
    mutation.mutate(requestedValue);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-paper-raised p-5 shadow-panel">
      <p className="text-sm text-ink-muted">
        Janela mínima de retenção aplicada a toda evidência enviada, em anos. Use <strong>-1</strong> para retenção
        indeterminada (FR-043). O valor vale apenas para gravações <strong>futuras</strong> — evidências já
        registradas mantêm a data de expurgo carimbada no momento do envio, mesmo que este parâmetro mude depois.
      </p>

      <Field
        label="Retenção de evidências (anos)"
        htmlFor="evidenceRetentionYears"
        hint={isCurrentlyIndeterminate ? 'Atualmente: indeterminada.' : undefined}
      >
        <Input
          id="evidenceRetentionYears"
          type="number"
          step={1}
          value={years}
          onChange={(event) => setYears(event.target.value)}
          className="data-figure max-w-xs"
        />
      </Field>

      {isReducing && (
        <p className="flex items-start gap-2 text-xs text-status-reprovado">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Reduzir a janela vale só para evidências enviadas a partir de agora — o acervo já gravado sob a janela
          anterior não é liberado antecipadamente.
        </p>
      )}

      <Button type="submit" size="sm" isLoading={mutation.isPending && !showIndeterminateConfirm} className="self-start">
        Salvar
      </Button>

      {showIndeterminateConfirm && (
        <Modal isOpen onClose={() => setShowIndeterminateConfirm(false)} title="Confirmar retenção indeterminada">
          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 text-sm text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-reprovado" aria-hidden="true" />
              Toda evidência enviada a partir de agora será gravada com retenção <strong>indeterminada</strong>: nada
              registrado sob ela poderá ser removido por ninguém, em nenhum momento futuro. Esta decisão não é
              reversível para as evidências já gravadas sob esse regime.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowIndeterminateConfirm(false)}>
                Cancelar
              </Button>
              <Button type="button" isLoading={mutation.isPending} onClick={() => mutation.mutate(INDETERMINATE)}>
                Confirmar retenção indeterminada
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </form>
  );
}
