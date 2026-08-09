import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { ScoreTrendChart } from '../components/reports/ScoreTrendChart';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { listReportInstances, startCurrentReportInstance } from '../api/reports';
import { formatDateTime, formatNumber, formatReferenceMonth } from '../lib/format';
import { getRelevantDeadline } from '../lib/report-deadline';
import { buildLastSixMonthsScoreTrend } from '../lib/score-trend';
import { REPORT_STATUS_LABEL, REPORT_STATUS_TONE, REPORT_SUBMISSION_STAGE_LABEL } from '../lib/status';
import { Button, EmptyState, Input, Select, Spinner, StatusBadge, Table, TBody, TD, TH, THead, TR, useToast } from '../components/ui';
import type { ReportStatus } from '../types/api';

export function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const [search, setSearch] = useState('');
  const [referenceMonthFrom, setReferenceMonthFrom] = useState('');
  const [referenceMonthTo, setReferenceMonthTo] = useState('');

  const startMutation = useMutation({
    mutationFn: startCurrentReportInstance,
    onSuccess: (newReport) => {
      showToast('Relatório do mês atual iniciado com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: ['my-report-instances'] });
      navigate(`/relatorios/${newReport.id}`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Não foi possível iniciar o relatório do mês atual.';
      showToast(msg, 'error');
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-report-instances', user?.primaryUnitId, status, search, referenceMonthFrom, referenceMonthTo],
    queryFn: () =>
      listReportInstances({
        unitId: user!.primaryUnitId,
        status: status || undefined,
        search: search.trim() || undefined,
        referenceMonthFrom: referenceMonthFrom ? `${referenceMonthFrom}-01` : undefined,
        referenceMonthTo: referenceMonthTo ? `${referenceMonthTo}-01` : undefined,
        sortBy: 'referenceMonth',
        sortOrder: 'desc',
      }),
    enabled: Boolean(user),
  });

  const reports = useMemo(() => data ?? [], [data]);

  const actionableReport = useMemo(() => {
    if (!user) return undefined;
    return reports.find(
      (report) =>
        (report.status === 'PENDENTE' && user.role === 'ELABORADOR') ||
        (report.status === 'EM_REVISAO' && user.role === 'REVISOR'),
    );
  }, [reports, user]);

  const hasCurrentMonthReport = useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return reports.some((report) => report.referenceMonth.startsWith(currentMonthStr));
  }, [reports]);

  const scoreTrend = useMemo(() => buildLastSixMonthsScoreTrend(reports), [reports]);

  const handleStartElaboration = () => {
    if (actionableReport) {
      navigate(`/relatorios/${actionableReport.id}`);
      return;
    }
    startMutation.mutate();
  };

  return (
    <>
      <PageHeader
        eyebrow="Meu fluxo de trabalho"
        title="Elaboração e Revisão"
        description="Relatórios da sua unidade em aberto para lançamento de dados e revisão colaborativa."
        actions={
          user?.role === 'ELABORADOR' || user?.role === 'ADMINISTRADOR' ? (
            <Button
              isLoading={startMutation.isPending}
              onClick={handleStartElaboration}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Iniciar elaboração
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-6 p-8">
        {!isLoading && !isError && (
          <div className="rounded-lg border border-border bg-paper-raised p-5 shadow-panel">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Desempenho — últimos 6 meses
            </p>
            <ScoreTrendChart points={scoreTrend} />
          </div>
        )}

        {actionableReport && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border-l-4 border-accent bg-accent-50 px-5 py-4 shadow-xs">
            <div>
              <p className="text-sm font-medium text-accent-900">
                Relatório de {formatReferenceMonth(actionableReport.referenceMonth)} aguarda sua ação.
              </p>
              <p className="text-xs text-ink-muted">
                Status atual: {REPORT_STATUS_LABEL[actionableReport.status]}
              </p>
            </div>
            <Link to={`/relatorios/${actionableReport.id}`}>
              <Button>
                {actionableReport.status === 'PENDENTE' && user?.role === 'ELABORADOR'
                  ? 'Iniciar elaboração'
                  : actionableReport.status === 'EM_REVISAO' && user?.role === 'REVISOR'
                  ? 'Revisar relatório'
                  : 'Abrir relatório'}
              </Button>
            </Link>
          </div>
        )}

        {!actionableReport && user?.role === 'ELABORADOR' && !hasCurrentMonthReport && !isLoading && !isError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border-l-4 border-accent bg-accent-50 px-5 py-4 shadow-xs">
            <div>
              <p className="text-sm font-medium text-accent-900">
                Nenhum relatório aberto para o mês atual.
              </p>
              <p className="text-xs text-ink-muted">
                Você pode iniciar o lançamento de dados para o período vigente agora mesmo.
              </p>
            </div>
            <Button isLoading={startMutation.isPending} onClick={() => startMutation.mutate()}>
              <Plus className="mr-1.5 h-4 w-4" />
              Iniciar elaboração do mês atual
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="status" className="text-xs font-medium text-ink-muted">
              Status
            </label>
            <Select id="status" value={status} onChange={(event) => setStatus(event.target.value as ReportStatus | '')}>
              <option value="">Todos</option>
              {(Object.keys(REPORT_STATUS_LABEL) as ReportStatus[]).map((value) => (
                <option key={value} value={value}>
                  {REPORT_STATUS_LABEL[value]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="referenceMonthFrom" className="text-xs font-medium text-ink-muted">
              Período de (mês)
            </label>
            <Input
              id="referenceMonthFrom"
              type="month"
              value={referenceMonthFrom}
              onChange={(event) => setReferenceMonthFrom(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="referenceMonthTo" className="text-xs font-medium text-ink-muted">
              Período até (mês)
            </label>
            <Input
              id="referenceMonthTo"
              type="month"
              value={referenceMonthTo}
              onChange={(event) => setReferenceMonthTo(event.target.value)}
            />
          </div>
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <label htmlFor="search" className="text-xs font-medium text-ink-muted">
              Buscar unidade
            </label>
            <Input
              id="search"
              type="search"
              placeholder="Sigla ou nome da unidade"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {isLoading && <Spinner label="Carregando relatórios..." />}
        {isError && <EmptyState title="Falha ao carregar" description="Não foi possível carregar os relatórios da sua unidade." />}
        {!isLoading && !isError && reports.length === 0 && (
          <EmptyState title="Nenhum relatório encontrado" description="Ainda não há relatórios para os filtros selecionados." />
        )}

        {!isLoading && !isError && reports.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>Período</TH>
                <TH>Status</TH>
                <TH>Prazo (SLA)</TH>
                <TH>Nota</TH>
                <TH>Histórico de submissões</TH>
                <TH>Ações</TH>
              </TR>
            </THead>
            <TBody>
              {reports.map((report) => {
                const deadline = getRelevantDeadline(report);
                return (
                <TR key={report.id}>
                  <TD className="data-figure">{formatReferenceMonth(report.referenceMonth)}</TD>
                  <TD>
                    <StatusBadge tone={REPORT_STATUS_TONE[report.status]} label={REPORT_STATUS_LABEL[report.status]} />
                  </TD>
                  <TD>
                    <p className="text-xs text-ink-faint">{deadline.label}</p>
                    <p className="data-figure text-sm">{deadline.value}</p>
                  </TD>
                  <TD className="data-figure text-sm">
                    {report.totalScore !== null ? `${formatNumber(report.totalScore)} / 10` : '—'}
                  </TD>
                  <TD className="text-xs">
                    {/* T067/FR-058: uma linha por envio, sem colapsar reenvios —
                        um relatorio reprovado e reenviado mostra as DUAS
                        submissoes da etapa REVISAO, nao so a mais recente. */}
                    {(report.submissions ?? []).length === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {report.submissions!.map((submission) => (
                          <li key={submission.id} className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'font-medium',
                                submission.wasOnTime ? 'text-status-concluido' : 'text-status-reprovado',
                              )}
                            >
                              {submission.wasOnTime ? 'No prazo' : 'Fora do prazo'}
                            </span>
                            <span className="text-ink-muted">
                              {REPORT_SUBMISSION_STAGE_LABEL[submission.stage]} · {formatDateTime(submission.submittedAt)}
                              {submission.submittedByUser
                                ? ` · ${submission.submittedByUser.nome} ${submission.submittedByUser.sobrenome}`
                                : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TD>
                  <TD>
                    {report.status === 'PENDENTE' && user?.role === 'ELABORADOR' ? (
                      <Link to={`/relatorios/${report.id}`}>
                        <Button size="sm">Iniciar elaboração</Button>
                      </Link>
                    ) : report.status === 'EM_REVISAO' && user?.role === 'REVISOR' ? (
                      <Link to={`/relatorios/${report.id}`}>
                        <Button size="sm" variant="secondary">Revisar</Button>
                      </Link>
                    ) : (
                      <Link to={`/relatorios/${report.id}`} className="text-sm font-medium text-accent hover:text-accent-hover hover:underline">
                        Ver
                      </Link>
                    )}
                  </TD>
                </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>
    </>
  );
}
