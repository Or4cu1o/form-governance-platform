import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessLogEventType, ActorKind, ExportArtifactFormat, ExportArtifactKind, Prisma, ReportStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLogService } from '../audit/access-log.service';
import { absenceValue, buildCanonicalEnvelope, formatCanonicalDate, formatCanonicalDecimal } from '../sealing/canonical-serialization';
import { SealService } from '../sealing/seal.service';
import { buildCsv } from './csv.util';
import { PdfService } from './pdf.service';
import { PlatformSettingsService } from './platform-settings.service';
import { interpolateNamingPattern } from './naming-pattern.util';

const REPORT_EXPORT_INCLUDE = {
  unit: true,
  indicatorResponses: {
    include: {
      validationRecords: {
        orderBy: { createdAt: 'desc' },
        include: { aprovadorUser: { include: { primaryUnit: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ReportInstanceInclude;

type ReportForExport = Prisma.ReportInstanceGetPayload<{ include: typeof REPORT_EXPORT_INCLUDE }>;

const VEREDICTO_BY_STATUS: Record<ReportStatus, string> = {
  PENDENTE: 'Pendente de elaboracao',
  EM_REVISAO: 'Em revisao',
  PENDENTE_APROVACAO: 'Pendente de aprovacao',
  CONCLUIDO: 'Aprovado',
};

const CONTENT_TYPE_BY_FORMAT: Record<'csv' | 'json' | 'pdf', string> = {
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
};

const ARTIFACT_FORMAT_BY_FORMAT: Record<'csv' | 'json' | 'pdf', ExportArtifactFormat> = {
  csv: ExportArtifactFormat.CSV,
  json: ExportArtifactFormat.JSON,
  pdf: ExportArtifactFormat.PDF,
};

export interface ExportSealInfo {
  verificationCode: string;
  contentDigest: string;
  artifactDigest: string;
  keyId: string;
}

export interface ExportFile {
  filename: string;
  contentType: string;
  body: string | Buffer;
  seal: ExportSealInfo;
}

@Injectable()
export class ReportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitAccessService: UnitAccessService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly sealService: SealService,
    private readonly pdfService: PdfService,
    private readonly accessLogService: AccessLogService,
  ) {}

  async export(id: string, format: 'csv' | 'json' | 'pdf', user: AuthenticatedUser): Promise<ExportFile> {
    const report = await this.prisma.reportInstance.findUnique({
      where: { id },
      include: REPORT_EXPORT_INCLUDE,
    });
    if (!report) {
      throw new NotFoundException('Relatorio nao encontrado');
    }
    await this.unitAccessService.assertReadAccess(report.unitId, user);

    const payload = this.buildPayload(report);
    const settings = await this.platformSettingsService.getSettings();
    const baseName = interpolateNamingPattern(settings.exportNamingPattern, {
      SIGLA_UNIDADE: report.unit.sigla,
      DATA_ISO: new Date().toISOString().slice(0, 10),
    });

    // Pipeline de selo (FR-097/FR-098/FR-108): prepara contentDigest/
    // assinatura/codigo ANTES de renderizar, porque o rodape do PDF os
    // estampa em texto legivel — o artifactDigest so vem depois, sobre os
    // bytes finais (ver comentario em seal.service.ts).
    const isEmptyResult = report.indicatorResponses.length === 0;
    const isPartial = report.status !== ReportStatus.CONCLUIDO;
    const envelope = buildCanonicalEnvelope({
      issuedAt: new Date(),
      kind: 'RELATORIO',
      payload: this.buildCanonicalPayload(report),
      filters: { reportInstanceId: id },
      requesterScopeUnitIds: [report.unitId],
      isEmptyResult,
      isPartial,
    });
    const prepared = this.sealService.prepareSeal(envelope);

    const artifactBytes = await this.renderArtifact(format, report, payload, prepared);

    const { artifactDigest } = await this.sealService.persistSeal(prepared, {
      artifactBytes,
      artifactKind: ExportArtifactKind.RELATORIO,
      artifactFormat: ARTIFACT_FORMAT_BY_FORMAT[format],
      scopeDescriptor: { reportInstanceId: id, unitId: report.unitId } satisfies Prisma.InputJsonValue,
      issuedByUserId: user.id,
      isEmptyResult,
      isPartial,
    });

    await this.accessLogService.record({
      eventType: AccessLogEventType.EXPORTACAO,
      userId: user.id,
      actorKind: ActorKind.USUARIO,
      filtersApplied: { reportInstanceId: id, format } satisfies Prisma.InputJsonValue,
      scopeUnitIds: [report.unitId],
      resultVolume: 1,
    });

    return {
      filename: `${baseName}.${format}`,
      contentType: CONTENT_TYPE_BY_FORMAT[format],
      body: artifactBytes,
      seal: {
        verificationCode: prepared.verificationCode,
        contentDigest: prepared.contentDigest,
        artifactDigest,
        keyId: prepared.keyId,
      },
    };
  }

  private async renderArtifact(
    format: 'csv' | 'json' | 'pdf',
    report: ReportForExport,
    payload: ReturnType<ReportExportService['buildPayload']>,
    footer: { verificationCode: string; contentDigest: string; signature: string; keyId: string },
  ): Promise<string | Buffer> {
    if (format === 'json') {
      return JSON.stringify({ ...payload, rodape: { ...payload.rodape, selo: footer } }, null, 2);
    }
    if (format === 'pdf') {
      return this.pdfService.render(this.buildPdfContent(report, payload), footer);
    }
    return this.buildCsvBody(payload, footer);
  }

  private buildPdfContent(report: ReportForExport, payload: ReturnType<ReportExportService['buildPayload']>) {
    return {
      title: 'Relatório Operacional de Tecnologia da Informação',
      unitSigla: report.unit.sigla,
      unitNome: report.unit.nome,
      referencePeriod: payload.report.periodoReferencia,
      status: payload.report.status,
      indicators: payload.indicadores.map((ind) => ({
        titulo: ind.titulo,
        valor: ind.valorCalculado ?? 'não preenchido',
        conforme: ind.conforme,
      })),
      veredictoFinal: payload.rodape.veredictoFinal,
      aprovador: payload.rodape.aprovadorResponsavel
        ? {
            nome: payload.rodape.aprovadorResponsavel.nome,
            sobrenome: payload.rodape.aprovadorResponsavel.sobrenome,
            cargo: payload.rodape.aprovadorResponsavel.cargo,
            unidade: payload.rodape.aprovadorResponsavel.unidade,
          }
        : null,
    };
  }

  private buildPayload(report: ReportForExport) {
    const allValidationRecords = report.indicatorResponses.flatMap((ir) => ir.validationRecords);
    const mostRecent = allValidationRecords.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    const reprovadoPendenteCorrecao = report.status === ReportStatus.EM_REVISAO && report.reprovalCount > 0;

    return {
      report: {
        id: report.id,
        unidadeSigla: report.unit.sigla,
        unidadeNome: report.unit.nome,
        periodoReferencia: report.referenceMonth.toISOString().slice(0, 10),
        status: report.status,
        reprovalCount: report.reprovalCount,
        slaExtensionDueDate: report.slaExtensionDueDate?.toISOString().slice(0, 10) ?? null,
        submittedForReviewAt: report.submittedForReviewAt?.toISOString() ?? null,
        submittedForApprovalAt: report.submittedForApprovalAt?.toISOString() ?? null,
        concludedAt: report.concludedAt?.toISOString() ?? null,
      },
      indicadores: report.indicatorResponses.map((ir) => ({
        titulo: ir.snapshotTitle,
        objetivo: ir.snapshotObjective,
        valores: ir.variableValues,
        valorCalculado: ir.calculatedValue?.toString() ?? null,
        operadorMeta: ir.snapshotGoalOperator,
        valorMeta: ir.snapshotGoalValue.toString(),
        conforme: ir.isCompliant,
        statusValidacao: ir.validationStatus,
      })),
      rodape: {
        veredictoFinal:
          VEREDICTO_BY_STATUS[report.status] + (reprovadoPendenteCorrecao ? ' (reprovado pela Matriz)' : ''),
        // T169/T095 — cargo funcional (User.jobTitle), nao o papel de acesso
        // (User.role). DTO exige jobTitle para novos usuarios com role
        // Aprovador, mas registros anteriores a T095 podem nao te-lo — o
        // campo fica ausente nesse caso: um documento selado que declara
        // cargo errado e pior que um que nao declara cargo.
        aprovadorResponsavel: mostRecent
          ? {
              nome: mostRecent.aprovadorUser.nome,
              sobrenome: mostRecent.aprovadorUser.sobrenome,
              ...(mostRecent.aprovadorUser.jobTitle ? { cargo: mostRecent.aprovadorUser.jobTitle } : {}),
              unidade: mostRecent.aprovadorUser.primaryUnit.sigla,
            }
          : null,
        geradoEm: new Date().toISOString(),
      },
    };
  }

  // Payload de PROVA (contracts/canonical-serialization.md) — deliberadamente
  // separado de buildPayload() (payload de APRESENTACAO): o contrato exige
  // que o selo seja "independente de qualquer DTO de apresentacao", entao
  // mudanca cosmetica no JSON/CSV/PDF entregue nao pode invalidar selo
  // ja emitido. Decimais na escala declarada; ausencia como objeto
  // explicito quando o indicador nao foi preenchido (FR-081: a resposta so
  // existe se o indicador era elegivel — o unico estado possivel aqui e
  // NAO_PREENCHIDO, nunca NA_FORA_DO_NIVEL/NA_INATIVO_NO_PERIODO).
  private buildCanonicalPayload(report: ReportForExport) {
    const allValidationRecords = report.indicatorResponses.flatMap((ir) => ir.validationRecords);
    const mostRecent = allValidationRecords.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    return {
      reportId: report.id,
      unitId: report.unitId,
      unitSigla: report.unit.sigla,
      referencePeriod: formatCanonicalDate(report.referenceMonth),
      status: report.status,
      totalScore: report.totalScore !== null ? formatCanonicalDecimal(report.totalScore, 2) : null,
      indicatorScore: report.indicatorScore !== null ? formatCanonicalDecimal(report.indicatorScore, 2) : null,
      slaDeflatorApplied: report.slaDeflatorApplied !== null ? formatCanonicalDecimal(report.slaDeflatorApplied, 2) : null,
      indicators: report.indicatorResponses.map((ir) => ({
        formIndicatorId: ir.formIndicatorId,
        title: ir.snapshotTitle,
        goalValue: formatCanonicalDecimal(ir.snapshotGoalValue, 4),
        scoreWeight: formatCanonicalDecimal(ir.snapshotScoreWeight, 2),
        value: ir.calculatedValue !== null ? formatCanonicalDecimal(ir.calculatedValue, 4) : absenceValue('NAO_PREENCHIDO'),
        isCompliant: ir.isCompliant,
        validationStatus: ir.validationStatus,
      })),
      approver: mostRecent
        ? {
            name: mostRecent.aprovadorUser.nome,
            surname: mostRecent.aprovadorUser.sobrenome,
            jobTitle: mostRecent.aprovadorUser.jobTitle ?? null,
            unit: mostRecent.aprovadorUser.primaryUnit.sigla,
          }
        : null,
    };
  }

  private buildCsvBody(
    payload: ReturnType<ReportExportService['buildPayload']>,
    footer: { verificationCode: string; contentDigest: string; signature: string; keyId: string },
  ): string {
    const rows: (string | number | boolean | null)[][] = [
      ['Unidade', 'Periodo de Referencia', 'Status do Relatorio'],
      [payload.report.unidadeSigla, payload.report.periodoReferencia, payload.report.status],
      [],
      ['Indicador', 'Objetivo', 'Valor Calculado', 'Operador Meta', 'Valor Meta', 'Conforme', 'Status de Validacao'],
      ...payload.indicadores.map((ind) => [
        ind.titulo,
        ind.objetivo,
        ind.valorCalculado,
        ind.operadorMeta,
        ind.valorMeta,
        ind.conforme,
        ind.statusValidacao,
      ]),
      [],
      ['Veredito Final', payload.rodape.veredictoFinal],
      [
        'Aprovador Responsavel',
        payload.rodape.aprovadorResponsavel
          ? `${payload.rodape.aprovadorResponsavel.nome} ${payload.rodape.aprovadorResponsavel.sobrenome} (${payload.rodape.aprovadorResponsavel.cargo ?? 'cargo nao informado'} - ${payload.rodape.aprovadorResponsavel.unidade})`
          : 'N/A',
      ],
      ['Gerado em', payload.rodape.geradoEm],
      [],
      ['Codigo de Verificacao', footer.verificationCode],
      ['Content Digest (SHA-256)', footer.contentDigest],
      ['Assinatura (Ed25519, base64)', footer.signature],
      ['Chave de Selagem', footer.keyId],
    ];
    return buildCsv(rows);
  }
}
