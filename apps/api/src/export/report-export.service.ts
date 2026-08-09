import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildCsv } from './csv.util';
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

export interface ExportFile {
  filename: string;
  contentType: string;
  body: string;
}

@Injectable()
export class ReportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitAccessService: UnitAccessService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  async export(id: string, format: 'csv' | 'json', user: AuthenticatedUser): Promise<ExportFile> {
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

    if (format === 'json') {
      return {
        filename: `${baseName}.json`,
        contentType: 'application/json',
        body: JSON.stringify(payload, null, 2),
      };
    }
    return {
      filename: `${baseName}.csv`,
      contentType: 'text/csv',
      body: this.buildCsvBody(payload),
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

  private buildCsvBody(payload: ReturnType<ReportExportService['buildPayload']>): string {
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
    ];
    return buildCsv(rows);
  }
}
