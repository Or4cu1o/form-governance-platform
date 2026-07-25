import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { getReportInstancesOverview } from '../api/reports';
import { exportReportInstance } from '../api/export';
import { formatNumber, formatReferenceMonth } from '../lib/format';
import { REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from '../lib/status';
import { cn } from '../lib/cn';
import { Button, EmptyState, Input, Select, Spinner, StatusBadge, Table, TBody, TD, TH, THead, TR, useToast } from '../components/ui';
import type { ReportInstanceOverview, ReportStatus, UnitSummary } from '../types/api';

const SEARCH_DEBOUNCE_MS = 350;

type SortBy = 'referenceMonth' | 'status';
type SortOrder = 'asc' | 'desc';

function monthInputToIsoDate(value: string): string | undefined {
  return value ? `${value}-01` : undefined;
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string;
  column: SortBy;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSort: (column: SortBy) => void;
}) {
  const isActive = sortBy === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        'flex items-center gap-1 uppercase tracking-wide transition-colors duration-fast ease-out-expo hover:text-ink',
        isActive ? 'text-ink' : 'text-ink-faint',
      )}
    >
      {label}
      {isActive &&
        (sortOrder === 'asc' ? (
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        ))}
    </button>
  );
}

function StatusOverview({ reports }: { reports: ReportInstanceOverview[] }) {
  const counts = useMemo(() => {
    const byStatus = new Map<ReportStatus, number>();
    for (const report of reports) {
      byStatus.set(report.status, (byStatus.get(report.status) ?? 0) + 1);
    }
    return byStatus;
  }, [reports]);

  const statuses = Object.keys(REPORT_STATUS_LABEL) as ReportStatus[];

  return (
    <div className="flex flex-wrap items-stretch gap-x-10 gap-y-4 border-b border-border bg-paper-raised px-8 py-6">
      <div className="pr-10">
        <p className="font-display text-display font-semibold text-ink">{reports.length}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Relatórios no período</p>
      </div>
      {statuses.map((statusKey, index) => (
        <div key={statusKey} className={cn('pl-0', index > 0 && 'border-l border-border pl-10')}>
          <p className={cn('data-figure text-3xl font-medium', `text-status-${REPORT_STATUS_TONE[statusKey]}`)}>
            {counts.get(statusKey) ?? 0}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
            {REPORT_STATUS_LABEL[statusKey]}
          </p>
        </div>
      ))}
    </div>
  );
}

function ScoreCell({ totalScore }: { totalScore: string | null }) {
  if (totalScore === null) {
    return <span className="text-ink-faint">—</span>;
  }
  const value = Number(totalScore);
  const tone = value >= 7 ? 'text-emerald-600' : value >= 5 ? 'text-amber-600' : 'text-status-reprovado';
  return (
    <span className={cn('data-figure font-semibold', tone)}>
      {formatNumber(totalScore)} <span className="font-normal text-ink-faint">/ 10</span>
    </span>
  );
}

export function DashboardPage() {
  const { showToast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const [unitId, setUnitId] = useState('');
  const [referenceMonthFrom, setReferenceMonthFrom] = useState('');
  const [referenceMonthTo, setReferenceMonthTo] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('referenceMonth');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'report-instances-overview',
      { status, search, referenceMonthFrom, referenceMonthTo, sortBy, sortOrder },
    ],
    queryFn: () =>
      getReportInstancesOverview({
        status: status || undefined,
        search: search || undefined,
        referenceMonthFrom: monthInputToIsoDate(referenceMonthFrom),
        referenceMonthTo: monthInputToIsoDate(referenceMonthTo),
        sortBy,
        sortOrder,
      }),
  });

  const reports = useMemo(() => data ?? [], [data]);

  const units = useMemo<UnitSummary[]>(() => {
    const byId = new Map<string, UnitSummary>();
    for (const report of reports) {
      byId.set(report.unit.id, { id: report.unit.id, sigla: report.unit.sigla, nome: report.unit.nome });
    }
    return Array.from(byId.values()).sort((a, b) => a.sigla.localeCompare(b.sigla));
  }, [reports]);

  const visibleReports = useMemo(
    () => (unitId ? reports.filter((report) => report.unitId === unitId) : reports),
    [reports, unitId],
  );

  function handleSort(column: SortBy) {
    if (sortBy === column) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }

  async function handleExport(id: string, format: 'csv' | 'json') {
    const exportKey = `${id}-${format}`;
    setExportingId(exportKey);
    try {
      const { blob, filename } = await exportReportInstance(id, format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `relatorio-${id}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Relatório exportado em ${format.toUpperCase()} com sucesso!`, 'success');
    } catch {
      showToast('Não foi possível exportar o relatório.', 'error');
    } finally {
      setExportingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Painel Central"
        description="Panorama informativo de todas as unidades: acompanhamento de status, notas operacionais e exportação oficial dos relatórios."
      />

      <StatusOverview reports={reports} />

      <div className="flex flex-wrap items-end gap-3 border-b border-border bg-paper-raised px-8 py-4">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="search" className="text-xs font-medium text-ink-muted">
            Busca por unidade
          </label>
          <Input
            id="search"
            placeholder="Sigla ou nome da unidade"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="unit" className="text-xs font-medium text-ink-muted">
            Unidade
          </label>
          <Select id="unit" value={unitId} onChange={(event) => setUnitId(event.target.value)}>
            <option value="">Todas</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.sigla}
              </option>
            ))}
          </Select>
        </div>

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
          <label htmlFor="from" className="text-xs font-medium text-ink-muted">
            Período de
          </label>
          <Input
            id="from"
            type="month"
            value={referenceMonthFrom}
            onChange={(event) => setReferenceMonthFrom(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-xs font-medium text-ink-muted">
            até
          </label>
          <Input
            id="to"
            type="month"
            value={referenceMonthTo}
            onChange={(event) => setReferenceMonthTo(event.target.value)}
          />
        </div>
      </div>

      <div className="p-8 pt-6">
        {isLoading && <Spinner label="Carregando relatórios..." />}

        {isError && (
          <EmptyState title="Falha ao carregar" description="Não foi possível carregar os relatórios. Tente novamente." />
        )}

        {!isLoading && !isError && visibleReports.length === 0 && (
          <EmptyState title="Nenhum relatório encontrado" description="Ajuste os filtros para ver outros períodos ou unidades." />
        )}

        {!isLoading && !isError && visibleReports.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>Unidade</TH>
                <TH>
                  <SortableHeader label="Período" column="referenceMonth" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                </TH>
                <TH>
                  <SortableHeader label="Status" column="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                </TH>
                <TH>Nota</TH>
                <TH className="text-right">Ações & Exportação</TH>
              </TR>
            </THead>
            <TBody>
              {visibleReports.map((report) => (
                <TR key={report.id}>
                  <TD>
                    <p className="font-medium text-ink">{report.unit.sigla}</p>
                    <p className="text-xs text-ink-faint">{report.unit.nome}</p>
                  </TD>
                  <TD className="data-figure">{formatReferenceMonth(report.referenceMonth)}</TD>
                  <TD>
                    <StatusBadge tone={REPORT_STATUS_TONE[report.status]} label={REPORT_STATUS_LABEL[report.status]} />
                  </TD>
                  <TD>
                    <ScoreCell totalScore={report.totalScore} />
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link to={`/relatorios/${report.id}`}>
                        <Button size="sm" variant="ghost" title="Visualizar relatório">
                          <Eye className="mr-1 h-3.5 w-3.5 text-accent" />
                          Visualizar
                        </Button>
                      </Link>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => showToast('Exportação em PDF será disponibilizada em breve.', 'info')}
                        title="Exportar dados em formato PDF"
                      >
                        <FileText className="mr-1 h-3.5 w-3.5 text-rose-600" />
                        PDF
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={exportingId === `${report.id}-csv`}
                        onClick={() => handleExport(report.id, 'csv')}
                        title="Exportar dados em formato CSV"
                      >
                        <FileSpreadsheet className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                        CSV
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={exportingId === `${report.id}-json`}
                        onClick={() => handleExport(report.id, 'json')}
                        title="Exportar dados em formato JSON"
                      >
                        <FileJson className="mr-1 h-3.5 w-3.5 text-amber-600" />
                        JSON
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </>
  );
}
