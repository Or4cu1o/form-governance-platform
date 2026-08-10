import { BadRequestException, Injectable } from '@nestjs/common';
import { ActorKind, AccessLogEventType, AuditAction, Prisma, ReportInstance, ValidationVerdict } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UnitAccessService } from '../common/services/unit-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../export/platform-settings.service';
import { classifyIndicatorCell, IndicatorCellState } from '../reports/absence.util';
import { flagOutliers } from './outlier.util';
import { AccessLogService } from './access-log.service';
import { AuditFiltersQueryDto } from './dto/audit-filters-query.dto';
import { AuditQueryDto, AuditQueryMode, ComplianceFilter, PunctualityFilter } from './dto/audit-query.dto';

// Traduz o vocabulario interno de absence.util.ts (fonte unica da semantica
// de ausencia — T110/tasks.md:318) para os codigos do contrato publico
// GET /api/audit/query (contracts/api-rest.md:99).
const CELL_KIND_BY_STATE: Record<IndicatorCellState, string> = {
  [IndicatorCellState.VALOR_APURADO]: 'VALOR',
  [IndicatorCellState.ZERO_MEDIDO]: 'ZERO_MEDIDO',
  [IndicatorCellState.NAO_APLICAVEL_FORA_DO_NIVEL]: 'NA_FORA_DO_NIVEL',
  [IndicatorCellState.NAO_APLICAVEL_INDICADOR_INATIVO]: 'NA_INATIVO_NO_PERIODO',
  [IndicatorCellState.NAO_PREENCHIDO]: 'NAO_PREENCHIDO',
};

const ABSENCE_LEGEND = {
  NA_FORA_DO_NIVEL: 'Fora do nivel — a unidade nao tinha este indicador em seu formulario no periodo.',
  NA_INATIVO_NO_PERIODO: 'Indicador inativo no periodo — existia resposta, mas o indicador estava desativado a epoca.',
  NAO_PREENCHIDO: 'Nao preenchido — a unidade tinha o indicador, mas nao enviou o valor.',
};

const DEFAULT_PAGE_SIZE = 50;
const AGGREGATION_SCALE = 2;

interface CursorPayload {
  referenceMonth: string;
  unitId: string;
  reportInstanceId: string;
}

type ReportInstanceWithResponses = ReportInstance & {
  indicatorResponses: Array<{
    calculatedValue: Prisma.Decimal | null;
    formIndicator: { catalogEntry: { code: string; measurementUnit: string; name: string } };
  }>;
};

@Injectable()
export class AuditQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitAccessService: UnitAccessService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly accessLogService: AccessLogService,
  ) {}

  async query(dto: AuditQueryDto, user: AuthenticatedUser) {
    const mode = dto.mode ?? AuditQueryMode.BASICO;
    if ((dto.authorIds?.length || dto.eventTypes?.length) && mode !== AuditQueryMode.DETALHADO) {
      throw new BadRequestException('authorIds e eventTypes so sao aceitos no modo DETALHADO');
    }

    const settings = await this.platformSettingsService.getSettings();
    this.assertRangeWithinLimit(dto, mode, settings.auditMaxRangeMonths, settings.auditDetailedMaxRangeMonths);

    const unitIds = await this.resolveUnitScope(dto, user);
    const emptyScope = unitIds !== null && unitIds.length === 0;

    const where = emptyScope ? null : await this.buildWhere(dto, mode, unitIds);

    const pageSize = dto.pageSize ?? DEFAULT_PAGE_SIZE;
    const cursor = dto.cursor ? this.decodeCursor(dto.cursor) : null;

    const totalCount = where ? await this.prisma.reportInstance.count({ where }) : 0;
    const countMode = totalCount <= settings.auditExactCountThreshold ? 'EXATA' : 'TETO';
    const count = countMode === 'EXATA' ? totalCount : settings.auditExactCountThreshold;

    const rawRows = where
      ? ((await this.prisma.reportInstance.findMany({
          where: cursor ? { AND: [where, this.buildCursorWhere(cursor)] } : where,
          orderBy: [{ referenceMonth: 'desc' }, { unitId: 'asc' }, { id: 'asc' }],
          take: pageSize + 1,
          include: {
            indicatorResponses: {
              include: { formIndicator: { include: { catalogEntry: true } } },
            },
          },
        })) as ReportInstanceWithResponses[])
      : [];

    const hasMore = rawRows.length > pageSize;
    const page = rawRows.slice(0, pageSize);
    const nextCursor = hasMore ? this.encodeCursor(page[page.length - 1]) : null;

    const columns = this.resolveColumns(dto, page);
    const rows = this.applyOutlierFlags(columns, this.buildRows(page, columns));
    const aggregations = this.buildAggregations(columns, rows);

    await this.accessLogService.record({
      eventType: AccessLogEventType.CONSULTA_AUDITORIA,
      userId: user.id,
      actorKind: ActorKind.USUARIO,
      filtersApplied: dto as unknown as Prisma.InputJsonValue,
      scopeUnitIds: unitIds ?? [],
      resultVolume: rows.length,
    });

    return {
      columns,
      rows,
      aggregations,
      absenceLegend: ABSENCE_LEGEND,
      isEmptyResult: rows.length === 0,
      nextCursor,
      countMode,
      count,
      outlierRule: settings.outlierRule,
    };
  }

  async getFilters(dto: AuditFiltersQueryDto, user: AuthenticatedUser) {
    const unitIds = await this.resolveUnitScope(dto, user);
    const units = await this.prisma.unit.findMany({
      where: {
        ...(unitIds !== null && { id: { in: unitIds } }),
        ...(dto.levels?.length && { level: { in: dto.levels } }),
      },
      select: { id: true, sigla: true, nome: true, level: true },
      orderBy: { sigla: 'asc' },
    });

    const catalogEntries =
      units.length === 0
        ? []
        : await this.prisma.indicatorCatalog.findMany({
            where: {
              indicators: {
                some: { formTopic: { formTemplate: { units: { some: { id: { in: units.map((unit) => unit.id) } } } } } },
              },
            },
            select: { code: true, name: true, measurementUnit: true },
            orderBy: { code: 'asc' },
          });

    return {
      units,
      levels: [...new Set(units.map((unit) => unit.level))],
      indicatorCodes: catalogEntries,
    };
  }

  private assertRangeWithinLimit(dto: AuditQueryDto, mode: AuditQueryMode, maxRangeMonths: number, detailedMaxRangeMonths: number) {
    const limit = mode === AuditQueryMode.DETALHADO ? detailedMaxRangeMonths : maxRangeMonths;
    const monthsSpan = this.monthsBetween(dto.periodFrom, dto.periodTo);
    if (monthsSpan < 0) {
      throw new BadRequestException('periodFrom nao pode ser posterior a periodTo');
    }
    if (monthsSpan > limit) {
      throw new BadRequestException(
        `Amplitude de ${monthsSpan + 1} meses excede o limite de ${limit} meses do modo ${mode}. Reduza o intervalo entre periodFrom e periodTo.`,
      );
    }
  }

  private monthsBetween(periodFrom: string, periodTo: string): number {
    const [fromYear, fromMonth] = periodFrom.split('-').map(Number);
    const [toYear, toMonth] = periodTo.split('-').map(Number);
    return (toYear - fromYear) * 12 + (toMonth - fromMonth);
  }

  // Nunca alarga o escopo do usuario (US6-10): unitIds pedido na consulta e
  // sempre interseccionado com o que ele ja enxerga nas demais telas — jamais
  // usado isoladamente quando o acesso e restrito.
  private async resolveUnitScope(dto: { unitIds?: string[] }, user: AuthenticatedUser): Promise<string[] | null> {
    if (this.unitAccessService.hasOrgWideReadAccess(user)) {
      return dto.unitIds ?? null;
    }
    const accessibleUnitIds = await this.unitAccessService.getAccessibleUnitIds(user);
    if (!dto.unitIds?.length) {
      return accessibleUnitIds;
    }
    return dto.unitIds.filter((id) => accessibleUnitIds.includes(id));
  }

  private async buildWhere(dto: AuditQueryDto, mode: AuditQueryMode, unitIds: string[] | null): Promise<Prisma.ReportInstanceWhereInput> {
    const [fromYear, fromMonth] = dto.periodFrom.split('-').map(Number);
    const [toYear, toMonth] = dto.periodTo.split('-').map(Number);
    const fromDate = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
    const toDate = new Date(Date.UTC(toYear, toMonth - 1, 1));

    const indicatorResponseSome: Prisma.IndicatorResponseWhereInput = {};
    if (dto.indicatorCodes?.length) {
      indicatorResponseSome.formIndicator = { catalogEntry: { code: { in: dto.indicatorCodes } } };
    }
    if (dto.compliance?.length) {
      const wantedValues = dto.compliance.map((c) => c === ComplianceFilter.CONFORME);
      indicatorResponseSome.OR = wantedValues.map((isCompliant) => ({ isCompliant }));
    }
    if (dto.verdicts?.length) {
      indicatorResponseSome.validationRecords = { some: { verdict: { in: dto.verdicts as ValidationVerdict[] } } };
    }
    if (mode === AuditQueryMode.DETALHADO && dto.authorIds?.length) {
      indicatorResponseSome.updatedByUserId = { in: dto.authorIds };
    }
    if (mode === AuditQueryMode.DETALHADO && dto.eventTypes?.length) {
      const recordIds = await this.resolveEventTypeRecordIds(dto.eventTypes);
      indicatorResponseSome.id = { in: recordIds };
    }

    const where: Prisma.ReportInstanceWhereInput = {
      referenceMonth: { gte: fromDate, lte: toDate },
      ...(unitIds !== null && { unitId: { in: unitIds } }),
      ...(dto.levels?.length && { unit: { level: { in: dto.levels } } }),
      ...(dto.statuses?.length && { status: { in: dto.statuses } }),
      ...(dto.scoreFrom !== undefined || dto.scoreTo !== undefined
        ? { totalScore: { ...(dto.scoreFrom !== undefined && { gte: dto.scoreFrom }), ...(dto.scoreTo !== undefined && { lte: dto.scoreTo }) } }
        : {}),
      ...(dto.punctuality?.length && {
        AND: dto.punctuality.map((p) =>
          p === PunctualityFilter.NO_PRAZO
            ? { isElaborationOnTime: true, isReviewOnTime: true }
            : { OR: [{ isElaborationOnTime: false }, { isReviewOnTime: false }] },
        ),
      }),
      ...(Object.keys(indicatorResponseSome).length > 0 && { indicatorResponses: { some: indicatorResponseSome } }),
    };

    if (dto.search) {
      where.OR = [
        { unit: { OR: [{ sigla: { contains: dto.search, mode: 'insensitive' } }, { nome: { contains: dto.search, mode: 'insensitive' } }] } },
        {
          indicatorResponses: {
            some: {
              formIndicator: {
                OR: [
                  { title: { contains: dto.search, mode: 'insensitive' } },
                  { catalogEntry: { OR: [{ code: { contains: dto.search, mode: 'insensitive' } }, { name: { contains: dto.search, mode: 'insensitive' } }] } },
                ],
              },
            },
          },
        },
      ];
    }

    return where;
  }

  // FR-091/DETALHADO: eventTypes casa contra o rastro de auditoria do
  // gatilho de banco (AuditLog, generico por tableName+recordId), nao
  // contra AccessLog (que registra CONSULTAS, nao edicoes).
  private async resolveEventTypeRecordIds(eventTypes: string[]): Promise<string[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { tableName: 'indicator_responses', action: { in: eventTypes as AuditAction[] } },
      select: { recordId: true },
      distinct: ['recordId'],
    });
    return logs.map((log) => log.recordId);
  }

  private buildCursorWhere(cursor: CursorPayload): Prisma.ReportInstanceWhereInput {
    const referenceMonth = new Date(cursor.referenceMonth);
    return {
      OR: [
        { referenceMonth: { lt: referenceMonth } },
        { referenceMonth, unitId: { gt: cursor.unitId } },
        { referenceMonth, unitId: cursor.unitId, id: { gt: cursor.reportInstanceId } },
      ],
    };
  }

  private encodeCursor(row: ReportInstanceWithResponses): string {
    const payload: CursorPayload = {
      referenceMonth: row.referenceMonth.toISOString(),
      unitId: row.unitId,
      reportInstanceId: row.id,
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
    } catch {
      throw new BadRequestException('cursor invalido');
    }
  }

  private resolveColumns(dto: AuditQueryDto, page: ReportInstanceWithResponses[]) {
    const columnMap = new Map<string, { indicatorCode: string; measurementUnit: string }>();
    if (dto.indicatorCodes?.length) {
      for (const code of dto.indicatorCodes) {
        const response = page.flatMap((row) => row.indicatorResponses).find((r) => r.formIndicator.catalogEntry.code === code);
        columnMap.set(code, { indicatorCode: code, measurementUnit: response?.formIndicator.catalogEntry.measurementUnit ?? '' });
      }
    } else {
      for (const row of page) {
        for (const response of row.indicatorResponses) {
          const { code, measurementUnit } = response.formIndicator.catalogEntry;
          if (!columnMap.has(code)) {
            columnMap.set(code, { indicatorCode: code, measurementUnit });
          }
        }
      }
    }
    return [...columnMap.values()].sort((a, b) => a.indicatorCode.localeCompare(b.indicatorCode));
  }

  private buildRows(page: ReportInstanceWithResponses[], columns: Array<{ indicatorCode: string }>) {
    return page.map((reportInstance) => {
      const responsesByCode = new Map(reportInstance.indicatorResponses.map((response) => [response.formIndicator.catalogEntry.code, response]));
      const cells: Record<string, { kind: string; value: number | null; isOutlier: boolean }> = {};
      for (const column of columns) {
        const response = responsesByCode.get(column.indicatorCode);
        const calculatedValue = response?.calculatedValue != null ? Number(response.calculatedValue) : null;
        // A resposta so existe se o indicador estava elegivel/ativo quando o
        // periodo foi aberto (ReportLifecycleService.openPeriodForUnit filtra
        // por isActive antes de instanciar) — a existencia em si ja certifica
        // "ativo a epoca" sem reconsultar o cadastro corrente (FR-081).
        const state = classifyIndicatorCell({
          responseExists: !!response,
          indicatorActiveAtPeriod: true,
          calculatedValue,
        });
        cells[column.indicatorCode] = { kind: CELL_KIND_BY_STATE[state], value: calculatedValue, isOutlier: false };
      }
      return {
        unitId: reportInstance.unitId,
        referencePeriod: reportInstance.referenceMonth.toISOString().slice(0, 7),
        cells,
      };
    });
  }

  // US6-8/FR-087: a sinalizacao de outlier e calculada por coluna (mesma
  // grandeza) e devolvida por celula so como indicacao — nunca influencia
  // kind, value nem entra em nenhuma agregacao (buildAggregations le o
  // mesmo cells.value/kind de sempre, cego a isOutlier).
  private applyOutlierFlags<
    TRow extends { cells: Record<string, { kind: string; value: number | null; isOutlier: boolean }> },
  >(columns: Array<{ indicatorCode: string }>, rows: TRow[]): TRow[] {
    const flagsByColumnAndRow = new Map<string, boolean>();
    for (const column of columns) {
      const numericRowIndices: number[] = [];
      const values: number[] = [];
      rows.forEach((row, rowIndex) => {
        const cell = row.cells[column.indicatorCode];
        if (cell.value !== null && (cell.kind === 'VALOR' || cell.kind === 'ZERO_MEDIDO')) {
          numericRowIndices.push(rowIndex);
          values.push(cell.value);
        }
      });
      const flags = flagOutliers(values);
      numericRowIndices.forEach((rowIndex, position) => {
        flagsByColumnAndRow.set(`${column.indicatorCode}:${rowIndex}`, flags[position]);
      });
    }

    return rows.map((row, rowIndex) => ({
      ...row,
      cells: Object.fromEntries(
        Object.entries(row.cells).map(([code, cell]) => [
          code,
          { ...cell, isOutlier: flagsByColumnAndRow.get(`${code}:${rowIndex}`) ?? false },
        ]),
      ),
    }));
  }

  private buildAggregations(
    columns: Array<{ indicatorCode: string; measurementUnit: string }>,
    rows: Array<{ cells: Record<string, { kind: string; value: number | null }> }>,
  ) {
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
      const average = n > 0 ? Number((values.reduce((a, b) => a + b, 0) / n).toFixed(AGGREGATION_SCALE)) : null;
      return { label: column.indicatorCode, measurementUnit: column.measurementUnit, value: average, n, totalCells, scale: AGGREGATION_SCALE };
    });
  }
}
