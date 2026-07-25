import { formatDateTime } from './format';
import type { ReportInstance } from '../types/api';

export function getRelevantDeadline(report: ReportInstance): { label: string; value: string; isOverdue: boolean } {
  const now = new Date();
  switch (report.status) {
    case 'PENDENTE': {
      const isOverdue = new Date(report.elaborationDueDate) < now;
      return {
        label: isOverdue ? 'Prazo de elaboração (Atrasado)' : 'Prazo de elaboração (A prazo)',
        value: formatDateTime(report.elaborationDueDate),
        isOverdue,
      };
    }
    case 'EM_REVISAO': {
      const isExtended = Boolean(report.slaExtensionDueDate);
      const dueDate = report.slaExtensionDueDate || report.reviewDueDate;
      const isOverdue = new Date(dueDate) < now;
      const baseLabel = isExtended ? 'Prazo prorrogado' : 'Prazo de revisão';
      return {
        label: isOverdue ? `${baseLabel} (Atrasado)` : `${baseLabel} (A prazo)`,
        value: formatDateTime(dueDate),
        isOverdue,
      };
    }
    case 'PENDENTE_APROVACAO': {
      const isOverdue = new Date(report.approvalDueDate) < now;
      return {
        label: isOverdue ? 'Prazo de aprovação (Atrasado)' : 'Prazo de aprovação (A prazo)',
        value: formatDateTime(report.approvalDueDate),
        isOverdue,
      };
    }
    case 'CONCLUIDO':
      return { label: 'Concluído em', value: formatDateTime(report.concludedAt), isOverdue: false };
    default:
      return { label: '—', value: '—', isOverdue: false };
  }
}
