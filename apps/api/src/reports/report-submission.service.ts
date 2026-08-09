import { Injectable } from '@nestjs/common';
import { Prisma, ReportSubmissionStage } from '@prisma/client';
import { toUtcMidnight } from '../lifecycle/business-days.util';

export interface RecordSubmissionParams {
  reportInstanceId: string;
  stage: ReportSubmissionStage;
  submittedByUserId: string;
  // Prazo original da etapa (elaborationDueDate/reviewDueDate/approvalDueDate).
  dueDate: Date;
  // slaExtensionDueDate do relatorio — so vale quando ja houve reprova
  // (reprovalCount > 0); a extensao perdoa o ciclo novo, nunca o anterior
  // (FR-057), entao nunca se aplica a primeira submissao do ciclo.
  extensionDueDate: Date | null;
  reprovalCount: number;
  submittedAt?: Date;
}

// B3/FR-058: uma linha por envio, nunca sobrescrita — a verdade historica
// de pontualidade por etapa. O prazo vigente aferido (FR-056) e o
// estendido apenas quando a submissao pertence a um ciclo pos-reprova.
@Injectable()
export class ReportSubmissionService {
  async recordSubmission(tx: Prisma.TransactionClient, params: RecordSubmissionParams) {
    const submittedAt = params.submittedAt ?? new Date();
    const effectiveDueDate =
      params.reprovalCount > 0 && params.extensionDueDate ? params.extensionDueDate : params.dueDate;
    const wasOnTime = toUtcMidnight(submittedAt).getTime() <= effectiveDueDate.getTime();

    return tx.reportSubmission.create({
      data: {
        reportInstanceId: params.reportInstanceId,
        stage: params.stage,
        submittedByUserId: params.submittedByUserId,
        submittedAt,
        effectiveDueDate,
        wasOnTime,
        reprovalCountAtSubmission: params.reprovalCount,
      },
    });
  }
}
