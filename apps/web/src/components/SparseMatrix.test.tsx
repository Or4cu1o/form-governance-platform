import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SparseMatrix } from './SparseMatrix';
import type { AuditAggregation, AuditColumn, AuditRow } from '../api/audit';

const columns: AuditColumn[] = [
  { indicatorCode: 'IND-01', measurementUnit: 'unidades' },
  { indicatorCode: 'IND-02', measurementUnit: 'R$' },
];

const rows: AuditRow[] = [
  {
    unitId: 'unit-A',
    referencePeriod: '2026-06',
    cells: {
      'IND-01': { kind: 'VALOR', value: 10, isOutlier: false },
      'IND-02': { kind: 'NA_FORA_DO_NIVEL', value: null, isOutlier: false },
    },
  },
];

const aggregations: AuditAggregation[] = [
  { label: 'IND-01', measurementUnit: 'unidades', value: 10, n: 1, totalCells: 2, scale: 2 },
  { label: 'IND-02', measurementUnit: 'R$', value: null, n: 0, totalCells: 2, scale: 2 },
];

describe('SparseMatrix', () => {
  // US6-6: toda media/taxa exibe n de observacoes validas e a diferenca
  // para o total de celulas junto a ela.
  it('always shows n and the gap to totalCells next to every aggregation', () => {
    render(
      <SparseMatrix
        columns={columns}
        rows={rows}
        aggregations={aggregations}
        columnOrder={[]}
        hiddenColumns={[]}
        onMoveColumn={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
      />,
    );

    expect(screen.getByText(/n=1 de 2/)).toBeInTheDocument();
  });

  // US6-12/FR-090: hiding a column is presentation only — it never removes
  // a row from the table nor changes any aggregation number underneath.
  it('hiding a column removes it from view without dropping any row or changing aggregation numbers', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <SparseMatrix
        columns={columns}
        rows={rows}
        aggregations={aggregations}
        columnOrder={[]}
        hiddenColumns={[]}
        onMoveColumn={vi.fn()}
        onToggleColumnVisibility={onToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'IND-02' }));
    expect(onToggle).toHaveBeenCalledWith('IND-02');

    rerender(
      <SparseMatrix
        columns={columns}
        rows={rows}
        aggregations={aggregations}
        columnOrder={[]}
        hiddenColumns={['IND-02']}
        onMoveColumn={vi.fn()}
        onToggleColumnVisibility={onToggle}
      />,
    );

    // A linha continua existindo — so a coluna some da visao.
    expect(screen.getAllByRole('row')).toHaveLength(2); // header + 1 data row
    expect(screen.queryByRole('columnheader', { name: /IND-02/ })).not.toBeInTheDocument();
    // A agregacao de IND-01, que ainda esta visivel, continua com o mesmo n.
    expect(screen.getByText(/n=1 de 2/)).toBeInTheDocument();
  });

  it('reordering a column calls the callback instead of mutating anything locally', () => {
    const onMove = vi.fn();
    render(
      <SparseMatrix
        columns={columns}
        rows={rows}
        aggregations={aggregations}
        columnOrder={[]}
        hiddenColumns={[]}
        onMoveColumn={onMove}
        onToggleColumnVisibility={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mover IND-02 para a esquerda' }));

    expect(onMove).toHaveBeenCalledWith('IND-02', 'left');
  });

  it('marks an absent cell with the exact absence label, never as a blank or a zero', () => {
    render(
      <SparseMatrix
        columns={columns}
        rows={rows}
        aggregations={aggregations}
        columnOrder={[]}
        hiddenColumns={[]}
        onMoveColumn={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
      />,
    );

    expect(screen.getByText('N/A — fora do nível')).toBeInTheDocument();
  });
});
