import { formatDateTime } from './format';
import type { ReportInstance } from '../types/api';

export interface RelevantDeadline {
  label: string;
  value: string;
  isOverdue: boolean;
  // T077/US3-9: dias corridos ate o prazo (negativo = dias em atraso), para
  // exibir proximidade (nao so o binario "atrasado/no prazo"). Nulo quando o
  // relatorio ja nao tem prazo pendente (CONCLUIDO ou status desconhecido).
  daysRemaining: number | null;
}

function daysBetween(dueDate: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay);
}

export function getRelevantDeadline(report: ReportInstance): RelevantDeadline {
  const now = new Date();
  switch (report.status) {
    case 'PENDENTE': {
      const dueDate = new Date(report.elaborationDueDate);
      const isOverdue = dueDate < now;
      return {
        label: isOverdue ? 'Prazo de elaboração (Atrasado)' : 'Prazo de elaboração (A prazo)',
        value: formatDateTime(report.elaborationDueDate),
        isOverdue,
        daysRemaining: daysBetween(dueDate, now),
      };
    }
    case 'EM_REVISAO': {
      const isExtended = Boolean(report.slaExtensionDueDate);
      const dueDate = new Date(report.slaExtensionDueDate || report.reviewDueDate);
      const isOverdue = dueDate < now;
      const baseLabel = isExtended ? 'Prazo prorrogado' : 'Prazo de revisão';
      return {
        label: isOverdue ? `${baseLabel} (Atrasado)` : `${baseLabel} (A prazo)`,
        value: formatDateTime(dueDate.toISOString()),
        isOverdue,
        daysRemaining: daysBetween(dueDate, now),
      };
    }
    case 'PENDENTE_APROVACAO': {
      const dueDate = new Date(report.approvalDueDate);
      const isOverdue = dueDate < now;
      return {
        label: isOverdue ? 'Prazo de aprovação (Atrasado)' : 'Prazo de aprovação (A prazo)',
        value: formatDateTime(report.approvalDueDate),
        isOverdue,
        daysRemaining: daysBetween(dueDate, now),
      };
    }
    case 'CONCLUIDO':
      return { label: 'Concluído em', value: formatDateTime(report.concludedAt), isOverdue: false, daysRemaining: null };
    default:
      return { label: '—', value: '—', isOverdue: false, daysRemaining: null };
  }
}
