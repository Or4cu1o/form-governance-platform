import { ReportSubmissionStage } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ReportSubmissionService } from './report-submission.service';

// T057/B3/FR-058: uma linha por envio, nenhuma sobrescrita; atraso pretérito
// permanece registrado apos extensao de prazo (cenarios US2-6, US3-6,
// quickstart V7).
describe('ReportSubmissionService', () => {
  let service: ReportSubmissionService;
  let createMock: jest.Mock;
  let tx: Prisma.TransactionClient;

  beforeEach(() => {
    service = new ReportSubmissionService();
    createMock = jest.fn().mockResolvedValue({ id: 'submission-1' });
    tx = { reportSubmission: { create: createMock } } as unknown as Prisma.TransactionClient;
  });

  test('creates one row per submission with the stage, author, due date and outcome', async () => {
    const submittedAt = new Date('2026-07-05T10:00:00.000Z');

    await service.recordSubmission(tx, {
      reportInstanceId: 'report-1',
      stage: ReportSubmissionStage.ELABORACAO,
      submittedByUserId: 'elaborador-1',
      dueDate: new Date('2026-07-08T00:00:00.000Z'),
      extensionDueDate: null,
      reprovalCount: 0,
      submittedAt,
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        reportInstanceId: 'report-1',
        stage: ReportSubmissionStage.ELABORACAO,
        submittedByUserId: 'elaborador-1',
        submittedAt,
        effectiveDueDate: new Date('2026-07-08T00:00:00.000Z'),
        wasOnTime: true,
        reprovalCountAtSubmission: 0,
      },
    });
  });

  test('marks a submission after the due date as late', async () => {
    await service.recordSubmission(tx, {
      reportInstanceId: 'report-1',
      stage: ReportSubmissionStage.ELABORACAO,
      submittedByUserId: 'elaborador-1',
      dueDate: new Date('2026-07-08T00:00:00.000Z'),
      extensionDueDate: null,
      reprovalCount: 0,
      submittedAt: new Date('2026-07-09T10:00:00.000Z'),
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ wasOnTime: false }) }),
    );
  });

  // US2-6/US3-5 (FR-056): a extensao SO vale quando ja houve reprova — a
  // primeira submissao do ciclo nunca e aferida contra ela.
  test('ignores the extension date for the first submission of the cycle (reprovalCount = 0)', async () => {
    await service.recordSubmission(tx, {
      reportInstanceId: 'report-1',
      stage: ReportSubmissionStage.REVISAO,
      submittedByUserId: 'revisor-1',
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      extensionDueDate: new Date('2026-07-20T00:00:00.000Z'),
      reprovalCount: 0,
      submittedAt: new Date('2026-07-15T00:00:00.000Z'),
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          effectiveDueDate: new Date('2026-07-10T00:00:00.000Z'),
          wasOnTime: false,
        }),
      }),
    );
  });

  // US3-5/FR-056: reenvio pos-reprova e aferido contra o prazo ESTENDIDO,
  // nao o original.
  test('measures a post-reprova resubmission against the extended due date', async () => {
    await service.recordSubmission(tx, {
      reportInstanceId: 'report-1',
      stage: ReportSubmissionStage.REVISAO,
      submittedByUserId: 'revisor-1',
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      extensionDueDate: new Date('2026-07-20T00:00:00.000Z'),
      reprovalCount: 1,
      submittedAt: new Date('2026-07-15T00:00:00.000Z'),
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          effectiveDueDate: new Date('2026-07-20T00:00:00.000Z'),
          wasOnTime: true,
        }),
      }),
    );
  });

  // US3-6/FR-057: a extensao perdoa o ciclo NOVO, nunca o atraso pretérito —
  // uma submissao tardia dentro do MESMO reprovalCount continua tardia
  // mesmo que exista extensionDueDate futura (ela so se aplica ao proximo
  // ciclo, apos nova reprova).
  test('does not retroactively forgive a late submission that already belongs to a past cycle', async () => {
    await service.recordSubmission(tx, {
      reportInstanceId: 'report-1',
      stage: ReportSubmissionStage.REVISAO,
      submittedByUserId: 'revisor-1',
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      extensionDueDate: new Date('2026-07-12T00:00:00.000Z'),
      reprovalCount: 1,
      submittedAt: new Date('2026-07-13T00:00:00.000Z'),
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ wasOnTime: false }) }),
    );
  });

  test('records the reprovalCountAtSubmission to pin the submission to its cycle', async () => {
    await service.recordSubmission(tx, {
      reportInstanceId: 'report-1',
      stage: ReportSubmissionStage.REVISAO,
      submittedByUserId: 'revisor-1',
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      extensionDueDate: null,
      reprovalCount: 2,
      submittedAt: new Date('2026-07-09T00:00:00.000Z'),
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reprovalCountAtSubmission: 2 }) }),
    );
  });

  test('defaults submittedAt to now when not provided', async () => {
    const before = Date.now();

    await service.recordSubmission(tx, {
      reportInstanceId: 'report-1',
      stage: ReportSubmissionStage.APROVACAO,
      submittedByUserId: 'aprovador-1',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      extensionDueDate: null,
      reprovalCount: 0,
    });

    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.data.submittedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
