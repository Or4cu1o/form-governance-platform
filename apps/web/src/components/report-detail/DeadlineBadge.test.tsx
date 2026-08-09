import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeadlineBadge } from './DeadlineBadge';
import type { RelevantDeadline } from '../../lib/report-deadline';

function makeDeadline(overrides: Partial<RelevantDeadline> = {}): RelevantDeadline {
  return {
    label: 'Prazo de elaboração (A prazo)',
    value: '05/04/2026',
    isOverdue: false,
    daysRemaining: 10,
    ...overrides,
  };
}

describe('DeadlineBadge', () => {
  it('shows how many days late when the deadline is overdue', () => {
    render(<DeadlineBadge deadline={makeDeadline({ isOverdue: true, daysRemaining: -3 })} />);
    expect(screen.getByText('Atrasado há 3 dias')).toBeInTheDocument();
  });

  it('shows a near-deadline warning when 2 or fewer days remain', () => {
    render(<DeadlineBadge deadline={makeDeadline({ isOverdue: false, daysRemaining: 1 })} />);
    expect(screen.getByText('Vence em 1 dia')).toBeInTheDocument();
  });

  it('shows a comfortable badge when the deadline is far away', () => {
    render(<DeadlineBadge deadline={makeDeadline({ isOverdue: false, daysRemaining: 15 })} />);
    expect(screen.getByText('Vence em 15 dias')).toBeInTheDocument();
  });

  it('renders nothing when there is no pending deadline (CONCLUIDO)', () => {
    const { container } = render(<DeadlineBadge deadline={makeDeadline({ daysRemaining: null })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
