import { memo, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, History, Paperclip, ShieldAlert, UploadCloud, XCircle } from 'lucide-react';
import { updateIndicatorResponseValues, uploadIndicatorEvidence } from '../../api/indicator-responses';
import { getEvidenceDownloadUrl } from '../../api/evidence';
import { ApiError } from '../../lib/api-error';
import { Button, Input, StatusBadge, Textarea, useToast } from '../ui';
import { formatBytes, formatDateTime, formatNumber } from '../../lib/format';
import { GOAL_OPERATOR_SYMBOL, INDICATOR_VALIDATION_LABEL, INDICATOR_VALIDATION_TONE, VALIDATION_VERDICT_LABEL, VARIABLE_LABELS } from '../../lib/status';
import { cn } from '../../lib/cn';
import type { IndicatorResponse, ReportInstance } from '../../types/api';

const EVIDENCE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';

type Props = {
  response: IndicatorResponse;
  reportInstanceId: string;
  isEditable: boolean;
};

// FR-127: salvar um indicador nao pode reavaliar a tela inteira nem os
// demais cards. queryClient.setQueryData substitui SO o elemento afetado
// no array (as demais referencias do array permanecem identicas), e o
// memo() abaixo faz o React pular o re-render de todo card cuja prop
// `response` nao mudou de referencia — sem isso, invalidateQueries()
// refetchava o relatorio inteiro e recriava todos os objetos.
function patchIndicatorResponseInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  reportInstanceId: string,
  updated: IndicatorResponse,
) {
  queryClient.setQueryData<ReportInstance>(['report-instance', reportInstanceId], (current) => {
    if (!current) return current;
    return {
      ...current,
      indicatorResponses: (current.indicatorResponses ?? []).map((existing) =>
        // O PATCH devolve so os campos escalares (T047) — preserva
        // relacoes ja carregadas (evidenceFiles, validationRecords,
        // formIndicator) que a resposta da mutacao nao inclui.
        existing.id === updated.id ? { ...existing, ...updated } : existing,
      ),
    };
  });
}

function IndicatorResponseCardImpl({ response, reportInstanceId, isEditable }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const initialValues = useMemo(() => {
    const entries = response.snapshotVariableKeys.map((key) => [key, response.variableValues?.[key]?.toString() ?? '']);
    return Object.fromEntries(entries) as Record<string, string>;
  }, [response.snapshotVariableKeys, response.variableValues]);

  const [draftValues, setDraftValues] = useState<Record<string, string>>(initialValues);
  const [draftCriticalAnalysis, setDraftCriticalAnalysis] = useState<string>(response.criticalAnalysis ?? '');
  const [draftActionPlan, setDraftActionPlan] = useState<string>(response.actionPlan ?? '');
  const [syncedResponse, setSyncedResponse] = useState(response);

  // Ajusta o estado durante o render (padrao recomendado pelo React) em vez
  // de useEffect com setState sincrono, que dispara um render em cascata.
  if (response !== syncedResponse) {
    setSyncedResponse(response);
    setDraftValues(initialValues);
    setDraftCriticalAnalysis(response.criticalAnalysis ?? '');
    setDraftActionPlan(response.actionPlan ?? '');
  }

  const isDirty =
    response.snapshotVariableKeys.some((key) => draftValues[key] !== initialValues[key]) ||
    draftCriticalAnalysis !== (response.criticalAnalysis ?? '') ||
    draftActionPlan !== (response.actionPlan ?? '');

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['report-instance', reportInstanceId] });
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const changed: Record<string, number> = {};
      for (const key of response.snapshotVariableKeys) {
        const raw = draftValues[key];
        if (raw === '' || raw === undefined) continue;
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) changed[key] = parsed;
      }
      return updateIndicatorResponseValues(response.id, changed, draftCriticalAnalysis, draftActionPlan);
    },
    // FR-127: patch pontual no cache (so este indicador) em vez de
    // invalidateQueries — evitar refetch e re-render da tela inteira e dos
    // demais indicadores. Os totais do cabecalho (ProgressMeter em
    // ReportDetailPage) continuam corretos porque sao derivados de
    // report.indicatorResponses, que reflete o patch.
    onSuccess: (updatedResponse) => {
      showToast('Valores salvos.', 'success');
      patchIndicatorResponseInCache(queryClient, reportInstanceId, updatedResponse);
    },
    onError: () => showToast('Não foi possível salvar os valores.', 'error'),
  });

  async function handleEvidenceChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadIndicatorEvidence(response.id, file);
      showToast('Evidência enviada.', 'success');
      invalidate();
    } catch (error) {
      // T054 (FR-035): a recusa por tipo (extensao/mimetype/assinatura
      // binaria divergentes) tem motivo especifico devolvido pelo backend
      // em pt-BR (T039) — mostrar esse texto em vez de um erro generico.
      const message = error instanceof ApiError ? error.message : 'Não foi possível enviar a evidência.';
      showToast(message, 'error');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(evidenceFileId: string) {
    try {
      const { url } = await getEvidenceDownloadUrl(evidenceFileId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('Não foi possível gerar o link de download.', 'error');
    }
  }

  const goalLabel = `${GOAL_OPERATOR_SYMBOL[response.snapshotGoalOperator]} ${formatNumber(response.snapshotGoalValue)}`;

  return (
    <div className="rounded-lg border border-border bg-paper-raised p-7 shadow-panel transition-shadow duration-normal ease-out-expo hover:shadow-raised">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-semibold text-ink">{response.snapshotTitle}</h3>
            {/* FR-024/FR-025: todo valor herdado fica visualmente distinguivel
                como herdado e ainda nao conferido — rotulo textual, nunca so cor
                (FR-125). HERDADO_PARCIAL usa o tom de alerta: ha chave sem
                correspondencia no periodo anterior, exige atencao maior. */}
            {response.inheritanceState !== 'NAO_HERDADO' && (
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                  response.inheritanceState === 'HERDADO_PARCIAL'
                    ? 'border-status-reprovado/40 bg-status-reprovado/5 text-status-reprovado'
                    : 'border-accent/40 bg-accent-50 text-accent',
                )}
              >
                <History className="h-3 w-3" aria-hidden="true" />
                {response.inheritanceState === 'HERDADO_PARCIAL' ? 'Herdado parcialmente — confira' : 'Herdado — confira'}
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{response.snapshotObjective}</p>
        </div>
        <StatusBadge
          tone={INDICATOR_VALIDATION_TONE[response.validationStatus]}
          label={INDICATOR_VALIDATION_LABEL[response.validationStatus]}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-7 rounded border border-border bg-paper-sunken px-4 py-3 text-sm">
        <div>
          <p className="text-xs text-ink-faint">Meta</p>
          <p className="data-figure font-medium text-ink">{goalLabel}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Valor calculado</p>
          <p className="data-figure font-medium text-ink">{formatNumber(response.calculatedValue)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {response.isCompliant === true && (
            <span className="flex items-center gap-1 text-status-concluido">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Dentro da meta
            </span>
          )}
          {response.isCompliant === false && (
            <span className="flex items-center gap-1 text-status-reprovado">
              <XCircle className="h-4 w-4" aria-hidden="true" /> Fora da meta
            </span>
          )}
          {/* FR-028: ausencia de resultado sempre exibe o motivo exato na
              propria linha do indicador — nunca so "aguardando", quando ha
              uma causa registrada (variavel ausente, divisao por zero etc). */}
          {response.isCompliant === null && (
            <span className="text-ink-faint">{response.calculationFailureReason ?? 'Aguardando valores'}</span>
          )}
        </div>
      </div>

      <div className="mt-7 flex max-w-2xl flex-col gap-7">
        {response.snapshotVariableKeys.map((key) => (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={`${response.id}-${key}`} className="text-sm font-semibold text-ink">
              {VARIABLE_LABELS[key] ?? key}
            </label>
            <Input
              id={`${response.id}-${key}`}
              type="number"
              inputMode="decimal"
              className="data-figure max-w-xs"
              value={draftValues[key] ?? ''}
              disabled={!isEditable}
              onChange={(event) => setDraftValues((current) => ({ ...current, [key]: event.target.value }))}
            />
          </div>
        ))}

        <div className="flex flex-col gap-2 border-t border-border pt-6">
          <label htmlFor={`${response.id}-criticalAnalysis`} className="text-sm font-semibold text-ink">
            Análise Crítica
          </label>
          <p className="-mt-1 text-xs text-ink-muted">
            Descreva as causas, justificativas ou fatores que influenciaram o resultado deste indicador no mês.
          </p>
          <Textarea
            id={`${response.id}-criticalAnalysis`}
            value={draftCriticalAnalysis}
            disabled={!isEditable}
            onChange={(event) => setDraftCriticalAnalysis(event.target.value)}
            placeholder="Preencher análise crítica..."
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${response.id}-actionPlan`} className="text-sm font-semibold text-ink">
            Plano de ação para alcançar a meta
          </label>
          <p className="-mt-1 text-xs text-ink-muted">
            Caso o resultado esteja fora da meta, detalhe o plano de ação corretivo.
          </p>
          <Textarea
            id={`${response.id}-actionPlan`}
            value={draftActionPlan}
            disabled={!isEditable}
            onChange={(event) => setDraftActionPlan(event.target.value)}
            placeholder="Preencher plano de ação..."
          />
        </div>
      </div>

      {isEditable && (
        <div className="mt-5">
          <Button size="sm" onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending} disabled={!isDirty}>
            Salvar valores
          </Button>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Evidências</p>
        <div className="flex flex-wrap gap-2">
          {/* T054 (FR-037/FR-040): o estado de verificacao de seguranca
              (PENDENTE/BLOQUEADO) fica visivel na propria lista — nunca so
              a cor decide (FR-125), sempre com rotulo textual. Arquivo
              BLOQUEADO nem tenta gerar link — o backend recusaria com 403
              de qualquer forma (T049a), mas a UI ja deixa claro o motivo. */}
          {(response.evidenceFiles ?? []).map((evidence) => {
            const isBlocked = evidence.scanStatus === 'BLOQUEADO';
            const isPending = evidence.scanStatus === 'PENDENTE';
            return (
              <button
                key={evidence.id}
                type="button"
                disabled={isBlocked}
                onClick={() => handleDownload(evidence.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition-colors duration-fast ease-out-expo',
                  isBlocked
                    ? 'cursor-not-allowed border-status-reprovado/40 bg-status-reprovado/5 text-status-reprovado'
                    : 'border-border-strong bg-paper text-ink-muted hover:border-accent/40 hover:bg-accent-50 hover:text-accent',
                )}
                title={
                  isBlocked
                    ? 'Arquivo bloqueado pela verificação de segurança'
                    : isPending
                      ? 'Verificação de segurança pendente'
                      : undefined
                }
              >
                {isBlocked ? (
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {evidence.fileName}
                <span className="text-ink-faint">({formatBytes(evidence.sizeBytes)})</span>
                {isPending && (
                  <span className="flex items-center gap-1 text-ink-faint">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    verificação pendente
                  </span>
                )}
                {isBlocked && <span>bloqueado</span>}
              </button>
            );
          })}
          {(response.evidenceFiles ?? []).length === 0 && <p className="text-xs text-ink-faint">Nenhuma evidência enviada.</p>}
        </div>

        {isEditable && (
          <div className="mt-3">
            <input ref={fileInputRef} type="file" accept={EVIDENCE_ACCEPT} className="hidden" onChange={handleEvidenceChange} />
            <Button variant="secondary" size="sm" isLoading={isUploading} onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              Enviar evidência
            </Button>
          </div>
        )}
      </div>

      {(response.validationRecords ?? []).length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Histórico de validação</p>
          <div className="flex flex-col gap-2">
            {response.validationRecords!.map((record) => (
              <div key={record.id} className={cn('rounded border px-3 py-2 text-sm', 'border-border bg-paper')}>
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'font-medium',
                      record.verdict === 'APROVADO' ? 'text-status-concluido' : 'text-status-reprovado',
                    )}
                  >
                    {VALIDATION_VERDICT_LABEL[record.verdict]}
                  </span>
                  <span className="text-xs text-ink-faint">{formatDateTime(record.createdAt)}</span>
                </div>
                <p className="mt-1 text-ink-muted">{record.justification}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// FR-127: sem memo(), ReportDetailPage re-renderizando (ex.: totais do
// cabecalho mudando) forcaria todo card a re-renderizar mesmo com a mesma
// referencia de `response` — o patch pontual do cache so tem efeito prático
// combinado com este memo.
export const IndicatorResponseCard = memo(IndicatorResponseCardImpl);
