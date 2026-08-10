import { useMemo } from 'react';
import { cn } from '../lib/cn';
import { Table, TBody, TD, TH, THead, TR } from './ui';
import type { AuditAggregation, AuditColumn, AuditRow } from '../api/audit';

export interface SparseMatrixProps {
  columns: AuditColumn[];
  rows: AuditRow[];
  aggregations: AuditAggregation[];
  columnOrder: string[];
  hiddenColumns: string[];
  onMoveColumn: (indicatorCode: string, direction: 'left' | 'right') => void;
  onToggleColumnVisibility: (indicatorCode: string) => void;
}

const CELL_KIND_LABEL: Record<string, string> = {
  VALOR: '',
  ZERO_MEDIDO: '',
  NA_FORA_DO_NIVEL: 'N/A — fora do nível',
  NA_INATIVO_NO_PERIODO: 'N/A — indicador inativo',
  NAO_PREENCHIDO: 'Não preenchido',
};

function formatCellValue(kind: string, value: number | null): string {
  if (value !== null && (kind === 'VALOR' || kind === 'ZERO_MEDIDO')) {
    return String(value);
  }
  return CELL_KIND_LABEL[kind] ?? '—';
}

// US6-12/FR-090: ordenacao e visibilidade de coluna sao APRESENTACAO —
// derivadas aqui em runtime a partir de columns/rows/aggregations
// recebidos intactos da API. Mudar columnOrder/hiddenColumns nunca reduz
// `rows.length` nem recalcula um unico numero de `aggregations`.
export function SparseMatrix({
  columns,
  rows,
  aggregations,
  columnOrder,
  hiddenColumns,
  onMoveColumn,
  onToggleColumnVisibility,
}: SparseMatrixProps) {
  const orderedColumns = useMemo(() => {
    const byCode = new Map(columns.map((c) => [c.indicatorCode, c]));
    const ordered = columnOrder.map((code) => byCode.get(code)).filter((c): c is AuditColumn => Boolean(c));
    const remaining = columns.filter((c) => !columnOrder.includes(c.indicatorCode));
    return [...ordered, ...remaining];
  }, [columns, columnOrder]);

  const visibleColumns = orderedColumns.filter((c) => !hiddenColumns.includes(c.indicatorCode));

  if (columns.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <span className="font-medium text-ink-faint">Colunas:</span>
        {orderedColumns.map((column) => {
          const isHidden = hiddenColumns.includes(column.indicatorCode);
          return (
            <span key={column.indicatorCode} className="inline-flex items-center gap-1 rounded border border-border bg-paper-raised px-2 py-1">
              <button
                type="button"
                onClick={() => onToggleColumnVisibility(column.indicatorCode)}
                aria-pressed={!isHidden}
                className={cn('font-mono', isHidden ? 'text-ink-faint line-through' : 'text-ink')}
              >
                {column.indicatorCode}
              </button>
              <button type="button" aria-label={`Mover ${column.indicatorCode} para a esquerda`} onClick={() => onMoveColumn(column.indicatorCode, 'left')} className="text-ink-faint hover:text-ink">
                ←
              </button>
              <button type="button" aria-label={`Mover ${column.indicatorCode} para a direita`} onClick={() => onMoveColumn(column.indicatorCode, 'right')} className="text-ink-faint hover:text-ink">
                →
              </button>
            </span>
          );
        })}
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Unidade</TH>
            <TH>Período</TH>
            {visibleColumns.map((column) => (
              <TH key={column.indicatorCode} className="font-mono">
                {column.indicatorCode}
                <span className="ml-1 font-sans font-normal normal-case text-ink-faint">({column.measurementUnit})</span>
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={`${row.unitId}:${row.referencePeriod}`}>
              <TD className="font-mono text-xs">{row.unitId}</TD>
              <TD className="data-figure">{row.referencePeriod}</TD>
              {visibleColumns.map((column) => {
                const cell = row.cells[column.indicatorCode];
                if (!cell) {
                  return (
                    <TD key={column.indicatorCode} className="text-ink-faint">
                      —
                    </TD>
                  );
                }
                return (
                  <TD
                    key={column.indicatorCode}
                    className={cn('data-figure', cell.kind !== 'VALOR' && cell.kind !== 'ZERO_MEDIDO' && 'text-ink-faint')}
                  >
                    {formatCellValue(cell.kind, cell.value)}
                    {cell.isOutlier && (
                      <span className="ml-1 text-status-reprovado" title="Sinalizado como atípico — apenas indicação, não altera conformidade, nota ou estado">
                        ▲
                      </span>
                    )}
                  </TD>
                );
              })}
            </TR>
          ))}
        </TBody>
      </Table>

      {aggregations.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded border border-border bg-paper-sunken px-4 py-3 text-xs">
          {aggregations
            .filter((agg) => !hiddenColumns.includes(agg.label))
            .map((agg) => (
              <div key={agg.label} className="flex flex-col">
                <span className="font-mono font-semibold text-ink">{agg.label}</span>
                <span className="data-figure text-ink-muted">
                  {agg.value !== null ? agg.value.toFixed(agg.scale) : '—'} {agg.measurementUnit}
                </span>
                {/* US6-6: n de observacoes validas e a diferenca para o total de celulas SEMPRE visiveis junto a media/taxa. */}
                <span className="text-ink-faint">
                  n={agg.n} de {agg.totalCells} ({agg.totalCells - agg.n} ausente{agg.totalCells - agg.n === 1 ? '' : 's'})
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
