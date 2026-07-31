import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/layout/PageHeader';
import { ValidationIndicatorCard } from '../components/validation/ValidationIndicatorCard';
import { useAuth } from '../context/AuthContext';
import { finalizeReportInstance, getReportInstance } from '../api/reports';
import { formatReferenceMonth } from '../lib/format';
import { REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from '../lib/status';
import { Button, EmptyState, ProgressMeter, Spinner, StatusBadge, useToast } from '../components/ui';
import type { ProgressMeterSegment } from '../components/ui';
import type { IndicatorResponse } from '../types/api';

export function ValidationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['report-instance', id],
    queryFn: () => getReportInstance(id!),
    enabled: Boolean(id),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeReportInstance(id!),
    onSuccess: (updated) => {
      showToast(
        updated.status === 'CONCLUIDO' ? 'Relatório concluído.' : 'Relatório reprovado e devolvido para revisão.',
        updated.status === 'CONCLUIDO' ? 'success' : 'info',
      );
      queryClient.invalidateQueries({ queryKey: ['report-instance', id] });
    },
    onError: () => showToast('Não foi possível finalizar o relatório.', 'error'),
  });

  const responses = report?.indicatorResponses ?? [];

  const groupedResponses = useMemo(() => {
    const map = new Map<string, { title: string; order: number; responses: IndicatorResponse[] }>();
    const noTopicResponses: IndicatorResponse[] = [];

    if (!report) return [];

    for (const res of responses) {
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
  }, [responses, report]);

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
        <EmptyState title="Relatório não encontrado" description="Verifique se o link está correto ou volte à mesa de validação." />
      </div>
    );
  }

  const isValidatable = report.status === 'PENDENTE_APROVACAO' && user.role === 'APROVADOR';
  const hasPendingValidation = responses.some((response) => response.validationStatus === 'PENDENTE_VALIDACAO');
  const canFinalize = isValidatable && responses.length > 0 && !hasPendingValidation;
  const aprovadoCount = responses.filter((response) => response.validationStatus === 'APROVADO').length;
  const reprovadoCount = responses.filter((response) => response.validationStatus === 'REPROVADO').length;
  const emRevisaoCount = responses.filter((response) => response.validationStatus === 'EM_REVISAO').length;
  const progressSegments: ProgressMeterSegment[] = [
    { key: 'aprovado', count: aprovadoCount, label: 'aprovados', toneClassName: 'bg-status-concluido' },
    { key: 'reprovado', count: reprovadoCount, label: 'reprovados', toneClassName: 'bg-status-reprovado' },
    { key: 'em-revisao', count: emRevisaoCount, label: 'em revisão', toneClassName: 'bg-status-revisao' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Mesa de validação técnica"
        title={`${report.unit.sigla} · ${formatReferenceMonth(report.referenceMonth)}`}
        description={report.unit.nome}
        actions={
          <div className="flex items-center gap-4">
            <ProgressMeter segments={progressSegments} total={responses.length} label="indicadores validados" />
            <StatusBadge tone={REPORT_STATUS_TONE[report.status]} label={REPORT_STATUS_LABEL[report.status]} />
            {isValidatable && (
              <Button
                isLoading={finalizeMutation.isPending}
                disabled={!canFinalize}
                onClick={() => finalizeMutation.mutate()}
                title={!canFinalize ? 'Valide todos os indicadores antes de finalizar' : undefined}
              >
                Finalizar relatório
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-8 p-8">
        {groupedResponses.map((group) => (
          <div key={group.title} className="flex flex-col gap-5">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold text-ink">{group.title}</h2>
            </div>
            <div className="flex flex-col gap-5">
              {group.responses.map((response) => (
                <ValidationIndicatorCard key={response.id} response={response} reportInstanceId={report.id} isValidatable={isValidatable} />
              ))}
            </div>
          </div>
        ))}

        {responses.length === 0 && (
          <EmptyState title="Sem indicadores" description="Este relatório ainda não possui indicadores associados." />
        )}
      </div>
    </>
  );
}
