import { Injectable } from '@nestjs/common';
import { AccessLogEventType, ActorKind, ExportArtifactFormat, ExportArtifactKind, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AccessLogService } from '../audit/access-log.service';
import { AuditQueryService } from '../audit/audit-query.service';
import { AuditExportDto } from '../audit/dto/audit-export.dto';
import { AbsenceKind, absenceValue, buildCanonicalEnvelope, formatCanonicalDecimal } from '../sealing/canonical-serialization';
import { SealService } from '../sealing/seal.service';
import { buildCsv } from './csv.util';
import { interpolateNamingPattern } from './naming-pattern.util';
import { PlatformSettingsService } from './platform-settings.service';

type AuditQueryResult = Awaited<ReturnType<AuditQueryService['query']>>;
type AuditRow = AuditQueryResult['rows'][number];
type AuditColumn = AuditQueryResult['columns'][number];
type AuditAggregation = AuditQueryResult['aggregations'][number];

const EXPORT_PAGE_SIZE = 200;
const AGGREGATION_SCALE = 2;

export interface AuditExportFile {
  filename: string;
  contentType: string;
  body: string;
  seal: { verificationCode: string; contentDigest: string; artifactDigest: string; keyId: string };
}

// T135/FR-107: a exportacao de consulta de auditoria carrega os filtros
// aplicados na integra — INCLUSIVE os que nao retornaram dado —, modo,
// colunas, escopo do solicitante, legenda de ausencia, autoria e o n de
// cada agregacao. Diferente do report-export, o recorte pode ter varias
// paginas: percorre TODAS antes de selar, com colunas fixadas a partir do
// catalogo elegivel (nunca variando pagina a pagina).
@Injectable()
export class AuditExportService {
  constructor(
    private readonly auditQueryService: AuditQueryService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly sealService: SealService,
    private readonly accessLogService: AccessLogService,
  ) {}

  async export(dto: AuditExportDto, user: AuthenticatedUser): Promise<AuditExportFile> {
    const filterOptions = await this.auditQueryService.getFilters(
      { unitIds: dto.unitIds, levels: dto.levels },
      user as never,
    );
    // Colunas fixas para o arquivo inteiro (T113a/FR-092 nao se aplica
    // aqui, mas a mesma logica de nao depender da pagina renderizada sim):
    // se o chamador nao restringiu indicatorCodes, usa TODOS os elegiveis
    // ao escopo, para nenhuma pagina ficar com colunas diferentes de outra.
    const fixedIndicatorCodes = dto.indicatorCodes?.length
      ? dto.indicatorCodes
      : filterOptions.indicatorCodes.map((entry) => entry.code);

    const { rows, columns, absenceLegend, isEmptyResult, countMode, count } = await this.fetchAllPages(
      dto,
      fixedIndicatorCodes,
      user,
    );
    const aggregations = this.recomputeAggregations(columns, rows);

    const settings = await this.platformSettingsService.getSettings();
    const baseName = interpolateNamingPattern(settings.exportNamingPattern, {
      SIGLA_UNIDADE: 'AUDITORIA',
      DATA_ISO: new Date().toISOString().slice(0, 10),
    });

    const envelope = buildCanonicalEnvelope({
      issuedAt: new Date(),
      kind: 'CONSULTA_AUDITORIA',
      payload: this.buildCanonicalPayload(columns, rows, aggregations),
      filters: dto,
      requesterScopeUnitIds: dto.unitIds ?? [],
      isEmptyResult,
      isPartial: countMode !== 'EXATA',
    });
    const prepared = this.sealService.prepareSeal(envelope);

    const body = this.buildExportBody(dto, user, columns, rows, aggregations, absenceLegend, countMode, count, prepared);

    const { artifactDigest } = await this.sealService.persistSeal(prepared, {
      artifactBytes: body,
      artifactKind: ExportArtifactKind.CONSULTA_AUDITORIA,
      artifactFormat: dto.format === 'CSV' ? ExportArtifactFormat.CSV : ExportArtifactFormat.JSON,
      scopeDescriptor: { filters: dto } as unknown as Prisma.InputJsonValue,
      issuedByUserId: user.id,
      isEmptyResult,
      isPartial: countMode !== 'EXATA',
    });

    await this.accessLogService.record({
      eventType: AccessLogEventType.EXPORTACAO,
      userId: user.id,
      actorKind: ActorKind.USUARIO,
      filtersApplied: dto as unknown as Prisma.InputJsonValue,
      scopeUnitIds: dto.unitIds ?? [],
      resultVolume: rows.length,
    });

    return {
      filename: `${baseName}.${dto.format.toLowerCase()}`,
      contentType: dto.format === 'CSV' ? 'text/csv' : 'application/json',
      body,
      seal: { verificationCode: prepared.verificationCode, contentDigest: prepared.contentDigest, artifactDigest, keyId: prepared.keyId },
    };
  }

  private async fetchAllPages(dto: AuditExportDto, fixedIndicatorCodes: string[], user: AuthenticatedUser) {
    let cursor: string | undefined;
    const rows: AuditRow[] = [];
    let columns: AuditColumn[] = [];
    let absenceLegend: Record<string, string> = {};
    let isEmptyResult = true;
    let countMode: AuditQueryResult['countMode'] = 'EXATA';
    let count = 0;

    do {
      const page = await this.auditQueryService.query(
        { ...dto, indicatorCodes: fixedIndicatorCodes, pageSize: EXPORT_PAGE_SIZE, cursor },
        user,
      );
      rows.push(...page.rows);
      columns = page.columns;
      absenceLegend = page.absenceLegend;
      isEmptyResult = isEmptyResult && page.isEmptyResult;
      countMode = page.countMode;
      count = page.count;
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    return { rows, columns, absenceLegend, isEmptyResult, countMode, count };
  }

  // FR-088/T128a: toda agregacao exibida deve ser reproduzivel a partir
  // das linhas brutas do MESMO arquivo — por isso recalcula sobre o
  // conjunto completo exportado, nunca reaproveita a agregacao por pagina
  // de AuditQueryService (que so enxerga uma pagina por vez).
  private recomputeAggregations(columns: AuditColumn[], rows: AuditRow[]): AuditAggregation[] {
    return columns.map((column) => {
      const values: number[] = [];
      for (const row of rows) {
        const cell = row.cells[column.indicatorCode];
        if (cell.value !== null && (cell.kind === 'VALOR' || cell.kind === 'ZERO_MEDIDO')) {
          values.push(cell.value);
        }
      }
      const n = values.length;
      const totalCells = rows.length;
      const value = n > 0 ? Number((values.reduce((a, b) => a + b, 0) / n).toFixed(AGGREGATION_SCALE)) : null;
      return { label: column.indicatorCode, measurementUnit: column.measurementUnit, value, n, totalCells, scale: AGGREGATION_SCALE };
    });
  }

  private buildCanonicalPayload(columns: AuditColumn[], rows: AuditRow[], aggregations: AuditAggregation[]) {
    return {
      columns: columns.map((c) => ({ indicatorCode: c.indicatorCode, measurementUnit: c.measurementUnit })),
      rows: rows.map((row) => ({
        unitId: row.unitId,
        referencePeriod: row.referencePeriod,
        cells: Object.fromEntries(
          Object.entries(row.cells).map(([code, cell]) => [
            code,
            cell.value !== null && (cell.kind === 'VALOR' || cell.kind === 'ZERO_MEDIDO')
              ? formatCanonicalDecimal(cell.value, 4)
              : absenceValue(cell.kind as AbsenceKind),
          ]),
        ),
      })),
      aggregations: aggregations.map((agg) => ({
        label: agg.label,
        value: agg.value !== null ? formatCanonicalDecimal(agg.value, agg.scale) : null,
        n: agg.n,
        totalCells: agg.totalCells,
      })),
    };
  }

  private buildExportBody(
    dto: AuditExportDto,
    user: AuthenticatedUser,
    columns: AuditColumn[],
    rows: AuditRow[],
    aggregations: AuditAggregation[],
    absenceLegend: Record<string, string>,
    countMode: AuditQueryResult['countMode'],
    count: number,
    prepared: { verificationCode: string; contentDigest: string; signature: string; keyId: string },
  ): string {
    if (dto.format === 'JSON') {
      return JSON.stringify(
        {
          filtros: dto,
          modo: dto.mode ?? 'BASICO',
          escopoSolicitante: dto.unitIds ?? [],
          colunas: columns,
          linhas: rows,
          agregacoes: aggregations,
          legendaAusencia: absenceLegend,
          countMode,
          count,
          geradoPor: { userId: user.id, nome: user.nome, sobrenome: user.sobrenome },
          geradoEm: new Date().toISOString(),
          selo: prepared,
        },
        null,
        2,
      );
    }

    const rowsOut: (string | number | boolean | null)[][] = [
      ['Filtros aplicados (integra)', JSON.stringify(dto)],
      ['Modo', dto.mode ?? 'BASICO'],
      ['Escopo do solicitante', (dto.unitIds ?? []).join(', ') || 'todas as unidades acessiveis'],
      ['Gerado por', `${user.nome} ${user.sobrenome}`],
      ['Gerado em', new Date().toISOString()],
      ['Contagem', `${countMode} (${count})`],
      [],
      ['Unidade', 'Periodo', ...columns.map((c) => c.indicatorCode)],
      ...rows.map((row) => [
        row.unitId,
        row.referencePeriod,
        ...columns.map((c) => {
          const cell = row.cells[c.indicatorCode];
          return cell.value !== null && (cell.kind === 'VALOR' || cell.kind === 'ZERO_MEDIDO') ? cell.value : cell.kind;
        }),
      ]),
      [],
      ['Agregacoes'],
      ['Indicador', 'Valor', 'n', 'Total de celulas'],
      ...aggregations.map((agg) => [agg.label, agg.value, agg.n, agg.totalCells]),
      [],
      ['Legenda de ausencia'],
      ...Object.entries(absenceLegend).map(([code, description]) => [code, description]),
      [],
      ['Codigo de Verificacao', prepared.verificationCode],
      ['Content Digest (SHA-256)', prepared.contentDigest],
      ['Assinatura (Ed25519, base64)', prepared.signature],
      ['Chave de Selagem', prepared.keyId],
    ];
    return buildCsv(rowsOut);
  }
}
