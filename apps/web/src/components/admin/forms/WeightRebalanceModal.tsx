import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateIndicatorScores } from '../../../api/forms';
import { Button, Modal, useToast } from '../../ui';
import type { IndicatorScoreSummary } from '../../../types/api';

type Props = {
  templateId: string;
  rebalance: IndicatorScoreSummary;
  onClose: () => void;
};

// US4-4/T085: ativar, inativar ou criar um indicador muda o conjunto ativo e
// pode desbalancear a soma dos pesos — a redistribuicao proposta e
// apresentada aqui e exige confirmacao explicita antes de ser aplicada.
export function WeightRebalanceModal({ templateId, rebalance, onClose }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const applyMutation = useMutation({
    mutationFn: () =>
      updateIndicatorScores(
        templateId,
        rebalance.items.map((item) => ({ indicatorId: item.id, scoreWeight: item.scoreWeight })),
      ),
    onSuccess: () => {
      showToast('Pontuação redistribuída.', 'success');
      queryClient.invalidateQueries({ queryKey: ['indicator-scores', templateId] });
      onClose();
    },
    onError: () => showToast('Não foi possível aplicar a redistribuição.', 'error'),
  });

  return (
    <Modal isOpen onClose={onClose} title="Confirmar redistribuição de pesos">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          Essa alteração mudou o conjunto de indicadores ativos deste formulário, desbalanceando a soma dos pesos.
          Confirme a redistribuição proposta abaixo, ou ajuste manualmente depois no painel de pontuação.
        </p>
        <div className="flex flex-col gap-2 rounded-md bg-paper-sunken p-3">
          {rebalance.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-ink">{item.title}</span>
              <span className="data-figure font-medium text-ink">{item.scoreWeight.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Ajustar depois
          </Button>
          <Button type="button" isLoading={applyMutation.isPending} onClick={() => applyMutation.mutate()}>
            Confirmar redistribuição
          </Button>
        </div>
      </div>
    </Modal>
  );
}
