import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { IndicatorResponseCard } from '../components/report-detail/IndicatorResponseCard';
import { useAuth } from '../context/AuthContext';
import { getReportInstance, submitForApproval, submitForReview } from '../api/reports';
import { formatDateTime, formatNumber, formatReferenceMonth } from '../lib/format';
import { REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from '../lib/status';
import { Button, EmptyState, ProgressMeter, Spinner, StatusBadge, useToast } from '../components/ui';
import type { ProgressMeterSegment } from '../components/ui';
import type { IndicatorResponse } from '../types/api';

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['report-instance', id],
    queryFn: () => getReportInstance(id!),
    enabled: Boolean(id),
  });

  const submitReviewMutation = useMutation({
    mutationFn: () => submitForReview(id!),
    onSuccess: () => {
      showToast('Relatório enviado para revisão.', 'success');
      queryClient.invalidateQueries({ queryKey: ['report-instance', id] });
    },
    onError: () => showToast('Não foi possível enviar para revisão.', 'error'),
  });

  const submitApprovalMutation = useMutation({
    mutationFn: () => submitForApproval(id!),
    onSuccess: () => {
      showToast('Relatório enviado para aprovação.', 'success');
      queryClient.invalidateQueries({ queryKey: ['report-instance', id] });
    },
    onError: () => showToast('Não foi possível enviar para aprovação.', 'error'),
  });

  const groupedResponses = useMemo(() => {
    const map = new Map<string, { title: string; order: number; responses: IndicatorResponse[] }>();
    const noTopicResponses: IndicatorResponse[] = [];

    if (!report) return [];

    for (const res of report.indicatorResponses ?? []) {
      const topic = res.formIndicator?.formTopic;
      if (topic) {
        const key = topic.id;
        if (!map.has(key)) {
          map.set(key, { title: topic.title, order: topic.order, responses: [] });
        }
        map.get(key)!.responses.push(res);
      } else {
        noTopicResponses.push(res);
      }
    }

    const sortedGroups = Array.from(map.values()).sort((a, b) => a.order - b.order);
    if (noTopicResponses.length > 0) {
      sortedGroups.push({ title: 'Geral', order: 999, responses: noTopicResponses });
    }
    return sortedGroups;
  }, [report?.indicatorResponses]);

  if (isLoading) {
    return (
      <div className="p-8">
        <Spinner label="Carregando relatório..." />
      </div>
    );
  }

  if (isError || !report || !user) {
    return (
      <div className="p-8">
        <EmptyState title="Relatório não encontrado" description="Verifique se o link está correto ou volte ao painel." />
      </div>
    );
  }

  const sameUnit = user.primaryUnitId === report.unitId;
  const canSubmitForReview = sameUnit && report.status === 'PENDENTE' && user.role === 'ELABORADOR';
  const canSubmitForApproval = sameUnit && report.status === 'EM_REVISAO' && user.role === 'REVISOR';
  const isEditable = canSubmitForReview || canSubmitForApproval;
  const wasReproved = report.status === 'EM_REVISAO' && report.reprovalCount > 0;

  const allResponses = report.indicatorResponses ?? [];
  const filledResponses = allResponses.filter((response) => response.calculatedValue !== null);
  const compliantCount = filledResponses.filter((response) => response.isCompliant === true).length;
  const nonCompliantCount = filledResponses.filter((response) => response.isCompliant === false).length;
  const neutralFilledCount = filledResponses.length - compliantCount - nonCompliantCount;
  const progressSegments: ProgressMeterSegment[] = [
    { key: 'conforme', count: compliantCount, label: 'dentro da meta', toneClassName: 'bg-status-concluido' },
    { key: 'fora-meta', count: nonCompliantCount, label: 'fora da meta', toneClassName: 'bg-status-reprovado' },
    { key: 'preenchido', count: neutralFilledCount, label: 'preenchidos', toneClassName: 'bg-accent' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Elaboração e revisão"
        title={`${report.unit.sigla} · ${formatReferenceMonth(report.referenceMonth)}`}
        description={report.unit.nome}
        actions={
          <div className="flex items-center gap-4">
            <ProgressMeter segments={progressSegments} total={allResponses.length} label="indicadores preenchidos" />
            <StatusBadge tone={REPORT_STATUS_TONE[report.status]} label={REPORT_STATUS_LABEL[report.status]} />
            {canSubmitForReview && (
              <Button isLoading={submitReviewMutation.isPending} onClick={() => submitReviewMutation.mutate()}>
                Enviar para revisão
              </Button>
            )}
            {canSubmitForApproval && (
              <Button isLoading={submitApprovalMutation.isPending} onClick={() => submitApprovalMutation.mutate()}>
                Enviar para aprovação
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-8 p-8">
        {report.status === 'CONCLUIDO' && report.totalScore !== null && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-paper-raised px-5 py-4 shadow-panel">
            <div>
              <p className="text-sm font-semibold text-ink">Nota final do relatório</p>
              <p className="text-xs text-ink-muted">
                Indicadores: {formatNumber(report.indicatorScore ?? '0')} · Deflator de SLA: -
                {formatNumber(report.slaDeflatorApplied ?? '0')}
              </p>
            </div>
            <p className="data-figure text-2xl font-semibold text-ink">{formatNumber(report.totalScore)} / 10</p>
          </div>
        )}

        {wasReproved && (
          <div className="flex items-start gap-3 rounded border-l-4 border-status-reprovado bg-status-reprovado/5 px-4 py-3 text-sm text-ink shadow-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-reprovado" aria-hidden="true" />
            <p>
              Este relatório foi reprovado pela Matriz e retornou para revisão colaborativa.
              {report.slaExtensionDueDate && (
                <> Prazo prorrogado até <span className="data-figure font-medium">{formatDateTime(report.slaExtensionDueDate)}</span>.</>
              )}
            </p>
          </div>
        )}

        {groupedResponses.map((group) => (
          <div key={group.title} className="flex flex-col gap-5">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold text-ink">{group.title}</h2>
            </div>
            <div className="flex flex-col gap-5">
              {group.responses.map((response) => (
                <IndicatorResponseCard key={response.id} response={response} reportInstanceId={report.id} isEditable={isEditable} />
              ))}
            </div>
          </div>
        ))}

        {(report.indicatorResponses ?? []).length === 0 && (
          <EmptyState title="Sem indicadores" description="Este relatório ainda não possui indicadores associados." />
        )}
      </div>
    </>
  );
}
