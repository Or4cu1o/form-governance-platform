import { describe, expect, it } from 'vitest';
import { getRelevantDeadline } from './report-deadline';
import { makeReportInstance } from '../test/fixtures';

describe('getRelevantDeadline', () => {
  it('returns the elaboration due date for a PENDENTE report', () => {
    const report = makeReportInstance({ status: 'PENDENTE', elaborationDueDate: '2026-04-05T00:00:00.000Z' });
    const deadline = getRelevantDeadline(report);
    expect(deadline.label).toContain('Prazo de elaboração');
  });

  it('returns the extended due date for a reproved EM_REVISAO report', () => {
    const report = makeReportInstance({
      status: 'EM_REVISAO',
      slaExtensionDueDate: '2026-04-12T00:00:00.000Z',
      reviewDueDate: '2026-04-10T00:00:00.000Z',
    });
    const deadline = getRelevantDeadline(report);
    expect(deadline.label).toContain('Prazo prorrogado');
  });

  it('returns the review due date for a normal EM_REVISAO report', () => {
    const report = makeReportInstance({ status: 'EM_REVISAO', slaExtensionDueDate: null });
    const deadline = getRelevantDeadline(report);
    expect(deadline.label).toContain('Prazo de revisão');
  });

  it('returns the approval due date for a PENDENTE_APROVACAO report', () => {
    const report = makeReportInstance({ status: 'PENDENTE_APROVACAO' });
    const deadline = getRelevantDeadline(report);
    expect(deadline.label).toContain('Prazo de aprovação');
  });

  it('returns the conclusion date for a CONCLUIDO report', () => {
    const report = makeReportInstance({ status: 'CONCLUIDO', concludedAt: '2026-04-09T00:00:00.000Z' });
    const deadline = getRelevantDeadline(report);
    expect(deadline.label).toBe('Concluído em');
  });
});
