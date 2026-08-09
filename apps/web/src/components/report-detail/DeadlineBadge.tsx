import { StatusBadge } from '../ui';
import type { RelevantDeadline } from '../../lib/report-deadline';

const NEAR_DEADLINE_THRESHOLD_DAYS = 2;

// T077/US3-9: mostra proximidade do prazo da fase corrente, nao so o
// binario atrasado/no prazo — um relatorio a 1 dia do vencimento merece um
// alerta diferente de um que ainda tem 20 dias pela frente.
export function DeadlineBadge({ deadline }: { deadline: RelevantDeadline }) {
  if (deadline.daysRemaining === null) {
    return null;
  }

  if (deadline.isOverdue) {
    const daysLate = Math.abs(deadline.daysRemaining);
    return (
      <StatusBadge
        tone="reprovado"
        label={daysLate === 0 ? 'Vence hoje' : `Atrasado há ${daysLate} dia${daysLate === 1 ? '' : 's'}`}
      />
    );
  }

  if (deadline.daysRemaining <= NEAR_DEADLINE_THRESHOLD_DAYS) {
    return (
      <StatusBadge
        tone="pendente"
        label={deadline.daysRemaining === 0 ? 'Vence hoje' : `Vence em ${deadline.daysRemaining} dia${deadline.daysRemaining === 1 ? '' : 's'}`}
      />
    );
  }

  return <StatusBadge tone="concluido" label={`Vence em ${deadline.daysRemaining} dias`} />;
}
