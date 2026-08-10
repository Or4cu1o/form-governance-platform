import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/layout/PageHeader';
import { AbsenceLegend } from '../components/AbsenceLegend';
import { SparseMatrix } from '../components/SparseMatrix';
import { Button, EmptyState, Input, Select, Spinner } from '../components/ui';
import { getAuditFilters, getTablePreference, queryAudit, saveTablePreference } from '../api/audit';
import type { AuditQueryMode } from '../api/audit';
import type { UnitLevel } from '../types/api';

const TABLE_KEY = 'audit-query';

function defaultPeriodRange(): { from: string; to: string } {
  const now = new Date();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const past = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1));
  const from = `${past.getUTCFullYear()}-${String(past.getUTCMonth() + 1).padStart(2, '0')}`;
  return { from, to };
}

export function AuditPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuditQueryMode>('BASICO');
  const defaultRange = useMemo(() => defaultPeriodRange(), []);
  const [periodFrom, setPeriodFrom] = useState(defaultRange.from);
  const [periodTo, setPeriodTo] = useState(defaultRange.to);
  const [levels, setLevels] = useState<UnitLevel[]>([]);
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  // T118/US6-11: navegacao continua ou anterior/proxima, nunca conjunto
  // ilimitado — pilha de cursores ja vistos para permitir "anterior". Toda
  // troca de filtro reseta a pilha explicitamente no proprio handler (nao
  // num useEffect) para nao encadear um segundo render por mudanca.
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const currentCursor = cursorStack[cursorStack.length - 1];

  function updateFilters(apply: () => void) {
    apply();
    setCursorStack([]);
  }

  // FR-076: os filtros sao encadeados e reativos — a selecao corrente de
  // unidade/nivel restringe as opcoes de indicador subsequentes.
  const { data: filterOptions } = useQuery({
    queryKey: ['audit-filters', unitIds, levels],
    queryFn: () => getAuditFilters({ unitIds: unitIds.length ? unitIds : undefined, levels: levels.length ? levels : undefined }),
  });

  const { data: preference } = useQuery({
    queryKey: ['audit-table-preference', TABLE_KEY],
    queryFn: () => getTablePreference(TABLE_KEY),
  });
  const columnOrder = preference?.columnOrder ?? [];
  const hiddenColumns = preference?.hiddenColumns ?? [];

  const savePreferenceMutation = useMutation({
    mutationFn: (next: { columnOrder: string[]; hiddenColumns: string[] }) => saveTablePreference(TABLE_KEY, next),
    onSuccess: (saved) => queryClient.setQueryData(['audit-table-preference', TABLE_KEY], saved),
  });

  const {
    data: result,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ['audit-query', mode, periodFrom, periodTo, unitIds, levels, search, currentCursor],
    queryFn: () =>
      queryAudit({
        mode,
        periodFrom,
        periodTo,
        unitIds: unitIds.length ? unitIds : undefined,
        levels: levels.length ? levels : undefined,
        search: search.trim() || undefined,
        cursor: currentCursor,
      }),
    enabled: Boolean(periodFrom && periodTo),
  });

  function handleMoveColumn(indicatorCode: string, direction: 'left' | 'right') {
    const base = columnOrder.length > 0 ? columnOrder : (result?.columns.map((c) => c.indicatorCode) ?? []);
    const index = base.indexOf(indicatorCode);
    const currentOrder = index === -1 ? [...base, indicatorCode] : base;
    const from = currentOrder.indexOf(indicatorCode);
    const to = direction === 'left' ? from - 1 : from + 1;
    if (to < 0 || to >= currentOrder.length) return;
    const next = [...currentOrder];
    [next[from], next[to]] = [next[to], next[from]];
    savePreferenceMutation.mutate({ columnOrder: next, hiddenColumns });
  }

  function handleToggleColumnVisibility(indicatorCode: string) {
    const next = hiddenColumns.includes(indicatorCode)
      ? hiddenColumns.filter((code) => code !== indicatorCode)
      : [...hiddenColumns, indicatorCode];
    savePreferenceMutation.mutate({ columnOrder, hiddenColumns: next });
  }

  return (
    <>
      <PageHeader
        eyebrow="Base de auditoria"
        title="Área de Auditoria"
        description="Consulta multi-eixo sobre o acervo vivo — unidade, período e indicador, com a semântica de ausência declarada em toda célula."
      />

      <div className="flex flex-col gap-6 p-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mode" className="text-xs font-medium text-ink-muted">
              Modo
            </label>
            <Select
              id="mode"
              value={mode}
              onChange={(event) => updateFilters(() => setMode(event.target.value as AuditQueryMode))}
            >
              <option value="BASICO">Básico</option>
              <option value="DETALHADO">Detalhado</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="periodFrom" className="text-xs font-medium text-ink-muted">
              Período de (mês)
            </label>
            <Input
              id="periodFrom"
              type="month"
              value={periodFrom}
              onChange={(event) => updateFilters(() => setPeriodFrom(event.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="periodTo" className="text-xs font-medium text-ink-muted">
              Período até (mês)
            </label>
            <Input
              id="periodTo"
              type="month"
              value={periodTo}
              onChange={(event) => updateFilters(() => setPeriodTo(event.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="level" className="text-xs font-medium text-ink-muted">
              Nível
            </label>
            <Select
              id="level"
              multiple
              value={levels}
              onChange={(event) =>
                updateFilters(() =>
                  setLevels(Array.from(event.target.selectedOptions, (option) => option.value as UnitLevel)),
                )
              }
              className="h-auto min-h-11"
            >
              {(filterOptions?.levels ?? ['A', 'B', 'C']).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex min-w-[200px] flex-col gap-1.5">
            <label htmlFor="unit" className="text-xs font-medium text-ink-muted">
              Unidade
            </label>
            <Select
              id="unit"
              multiple
              value={unitIds}
              onChange={(event) =>
                updateFilters(() => setUnitIds(Array.from(event.target.selectedOptions, (option) => option.value)))
              }
              className="h-auto min-h-11"
            >
              {(filterOptions?.units ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.sigla} — {unit.nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <label htmlFor="search" className="text-xs font-medium text-ink-muted">
              Buscar (unidade ou indicador)
            </label>
            {/* FR-092: a busca alcanca o conjunto inteiro na propria
                consulta ao servidor — nunca um filtro sobre a pagina
                corrente ja carregada (ver AuditQueryService.buildWhere). */}
            <Input
              id="search"
              type="search"
              value={search}
              onChange={(event) => updateFilters(() => setSearch(event.target.value))}
            />
          </div>
        </div>

        {isLoading && <Spinner label="Consultando o acervo..." />}
        {isError && <EmptyState title="Falha ao consultar" description="Não foi possível executar a consulta de auditoria." />}

        {!isLoading && !isError && result && (
          <>
            <AbsenceLegend legend={result.absenceLegend} />

            {result.isEmptyResult ? (
              <EmptyState
                title="Nenhum registro para esta combinação de filtros"
                description="O conjunto está vazio — o período, a unidade e o recorte não foram alterados automaticamente."
              />
            ) : (
              <SparseMatrix
                columns={result.columns}
                rows={result.rows}
                aggregations={result.aggregations}
                columnOrder={columnOrder}
                hiddenColumns={hiddenColumns}
                onMoveColumn={handleMoveColumn}
                onToggleColumnVisibility={handleToggleColumnVisibility}
              />
            )}

            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>
                {result.countMode === 'EXATA'
                  ? `${result.count} registro(s) no total.`
                  : `Mais de ${result.count} registros — contagem em teto, nunca exata acima do limite configurado.`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={cursorStack.length === 0 || isFetching}
                  onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!result.nextCursor || isFetching}
                  onClick={() => result.nextCursor && setCursorStack((stack) => [...stack, result.nextCursor as string])}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
