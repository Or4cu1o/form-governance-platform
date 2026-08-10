import { ConfigService } from '@nestjs/config';
import { PrismaClient, UnitLevel, GoalOperator, ReportStatus, EvidenceScanStatus } from '@prisma/client';
import { AccessLogService } from '../audit/access-log.service';
import { AuditContextService } from '../common/services/audit-context.service';
import { AUDIT_ORIGIN_SEED, runAsSystemActor } from '../common/services/system-actor';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { EvidenceResolverService } from './evidence-resolver.service';

const noopAccessLogService = { record: async () => undefined } as unknown as AccessLogService;

// Teste de integracao contra um Postgres real (T148a, FR-119, SC-006) — mesmo
// padrao dos demais *.spec.ts desta pasta: nao roda neste sandbox, mas e o
// teste correto contra o Postgres/MinIO reais de CI/dev.
//
// Prova que a cadeia de drill-down do contrato e percorrivel em no maximo 3
// passos a partir de v_report_fact.calculated_value:
//   1. decomposicao do calculo (variaveis + formula congeladas, mesma linha
//      de indicator_responses)
//   2. historico de autoria/alteracao (indicator_response_version)
//   3. v_evidence_link → resolver → arquivo
describe('drill-down: calculated_value ate a evidencia (integration)', () => {
  const appPrisma = new PrismaClient({ datasources: { db: { url: process.env.APP_DATABASE_URL as string } } }) as unknown as PrismaService;
  const tableauRo = new PrismaClient({ datasources: { db: { url: process.env.TABLEAU_RO_DATABASE_URL as string } } });
  const ownerPrisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL as string } } });
  const auditContextService = new AuditContextService(appPrisma);

  const suffix = `DRILL${Date.now()}`;
  const fixture = { unitId: '', formTemplateId: '', formIndicatorId: '', catalogId: '', reportId: '', responseId: '', evidenceFileId: '', authorId: '' };

  beforeAll(async () => {
    await appPrisma.$connect();
    await tableauRo.$connect();
    await ownerPrisma.$connect();

    await runAsSystemActor(auditContextService, 'Teste de integracao — drill-down', AUDIT_ORIGIN_SEED, () =>
      auditContextService.runWithAuditContext(async (tx) => {
        const unit = await tx.unit.create({ data: { sigla: `${suffix}`, nome: 'Unidade Drill-down', level: UnitLevel.A } });
        const author = await tx.user.create({
          data: { matricula: suffix, nome: 'Autor', sobrenome: 'Teste', email: `${suffix}@teste.dev`, passwordHash: 'x', role: 'ELABORADOR', primaryUnitId: unit.id },
        });
        const formTemplate = await tx.formTemplate.create({ data: { name: `Formulario ${suffix}`, units: { connect: [{ id: unit.id }] } } });
        const formTopic = await tx.formTopic.create({ data: { formTemplateId: formTemplate.id, title: 'Topico' } });
        const catalogEntry = await tx.indicatorCatalog.create({ data: { code: `IND-${suffix}`, name: 'Indicador Drill-down', measurementUnit: 'unidade' } });
        const formIndicator = await tx.formIndicator.create({
          data: {
            formTopicId: formTopic.id,
            title: 'Indicador Drill-down',
            objective: 'Objetivo',
            variableKeys: ['x', 'y'],
            formulaExpression: 'x + y',
            goalOperator: GoalOperator.GTE,
            goalValue: 5,
            scoreWeight: 10,
            catalogEntryId: catalogEntry.id,
          },
        });
        const dueDates = { elaborationDueDate: new Date('2026-01-06'), reviewDueDate: new Date('2026-01-08'), approvalDueDate: new Date('2026-01-10') };
        const report = await tx.reportInstance.create({
          data: { unitId: unit.id, formTemplateId: formTemplate.id, referenceMonth: new Date('2026-01-01'), status: ReportStatus.CONCLUIDO, totalScore: 9, ...dueDates },
        });
        const response = await tx.indicatorResponse.create({
          data: {
            reportInstanceId: report.id,
            formIndicatorId: formIndicator.id,
            snapshotTitle: formIndicator.title,
            snapshotObjective: formIndicator.objective,
            snapshotVariableKeys: formIndicator.variableKeys,
            snapshotFormulaExpression: formIndicator.formulaExpression,
            snapshotGoalOperator: formIndicator.goalOperator,
            snapshotGoalValue: formIndicator.goalValue,
            snapshotScoreWeight: formIndicator.scoreWeight,
            variableValues: { x: 5, y: 7 },
            calculatedValue: 12,
            updatedByUserId: author.id,
            updatedAt: new Date(),
          },
        });
        // Passo 2 da cadeia: historico de autoria/alteracao.
        const version = await tx.indicatorResponseVersion.create({
          data: { indicatorResponseId: response.id, variableValues: { x: 5, y: 7 }, calculatedValue: 12, authoredByUserId: author.id },
        });
        await tx.indicatorResponse.update({ where: { id: response.id }, data: { currentVersionId: version.id } });

        const evidenceFile = await tx.evidenceFile.create({
          data: {
            indicatorResponseId: response.id,
            fileKey: `evidencias/${suffix}.pdf`,
            fileName: 'comprovante.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            uploadedByUserId: author.id,
            bucket: 'formops-evidencias-imutavel',
            scanStatus: EvidenceScanStatus.LIBERADO,
            scannedAt: new Date(),
          },
        });

        fixture.unitId = unit.id;
        fixture.authorId = author.id;
        fixture.formTemplateId = formTemplate.id;
        fixture.formIndicatorId = formIndicator.id;
        fixture.catalogId = catalogEntry.id;
        fixture.reportId = report.id;
        fixture.responseId = response.id;
        fixture.evidenceFileId = evidenceFile.id;
      }),
    );

    // Passo 3: emite o token vigente que a view devera expor — mesma acao
    // que AnalyticsReloadService executa periodicamente.
    const evidenceResolverService = new EvidenceResolverService(
      appPrisma,
      new S3Service(new ConfigService(process.env)),
      new ConfigService(process.env),
      noopAccessLogService,
    );
    await evidenceResolverService.issueToken(fixture.evidenceFileId);
  });

  afterAll(async () => {
    await ownerPrisma.evidenceAccessToken.deleteMany({ where: { evidenceFileId: fixture.evidenceFileId } });
    await ownerPrisma.evidenceFile.deleteMany({ where: { id: fixture.evidenceFileId } });
    await ownerPrisma.indicatorResponseVersion.deleteMany({ where: { indicatorResponseId: fixture.responseId } });
    await ownerPrisma.indicatorResponse.deleteMany({ where: { id: fixture.responseId } });
    await ownerPrisma.formIndicator.deleteMany({ where: { id: fixture.formIndicatorId } });
    await ownerPrisma.reportInstance.deleteMany({ where: { id: fixture.reportId } });
    await ownerPrisma.formTopic.deleteMany({ where: { formTemplateId: fixture.formTemplateId } });
    await ownerPrisma.formTemplate.deleteMany({ where: { id: fixture.formTemplateId } });
    await ownerPrisma.indicatorCatalog.deleteMany({ where: { id: fixture.catalogId } });
    await ownerPrisma.user.deleteMany({ where: { id: fixture.authorId } });
    await ownerPrisma.unit.deleteMany({ where: { id: fixture.unitId } });
    await appPrisma.$disconnect();
    await tableauRo.$disconnect();
    await ownerPrisma.$disconnect();
  });

  test('a cadeia inteira e percorrivel a partir de v_report_fact.calculated_value em ate 3 passos', async () => {
    // Passo 0: o fato em si.
    const [fact] = await tableauRo.$queryRaw<Array<{ response_id: string; calculated_value: string }>>`
      SELECT "response_id", "calculated_value" FROM "analytics"."v_report_fact" WHERE "response_id" = ${fixture.responseId}
    `;
    expect(Number(fact.calculated_value)).toBe(12);

    // Passo 1: decomposicao do calculo — variaveis e expressao congeladas.
    const [decomposition] = await ownerPrisma.$queryRaw<Array<{ variable_values: unknown; snapshot_formula_expression: string }>>`
      SELECT "variable_values", "snapshot_formula_expression" FROM "public"."indicator_responses" WHERE "id" = ${fact.response_id}
    `;
    expect(decomposition.variable_values).toEqual({ x: 5, y: 7 });
    expect(decomposition.snapshot_formula_expression).toBe('x + y');

    // Passo 2: historico de autoria e alteracao.
    const versions = await ownerPrisma.$queryRaw<Array<{ authored_by_user_id: string | null }>>`
      SELECT "authored_by_user_id" FROM "public"."indicator_response_version" WHERE "indicator_response_id" = ${fact.response_id}
    `;
    expect(versions.length).toBeGreaterThan(0);
    expect(versions[0].authored_by_user_id).toBe(fixture.authorId);

    // Passo 3: v_evidence_link → resolver → arquivo.
    const [link] = await tableauRo.$queryRaw<Array<{ evidence_file_name: string; resolver_token: string | null }>>`
      SELECT "evidence_file_name", "resolver_token" FROM "analytics"."v_evidence_link" WHERE "response_id" = ${fact.response_id}
    `;
    expect(link.evidence_file_name).toBe('comprovante.pdf');
    expect(link.resolver_token).not.toBeNull();

    const evidenceResolverService = new EvidenceResolverService(
      appPrisma,
      new S3Service(new ConfigService(process.env)),
      new ConfigService(process.env),
      noopAccessLogService,
    );
    const resolution = await evidenceResolverService.resolve(link.resolver_token as string, { sourceIp: null, userAgent: null });
    expect(resolution.status).toBe('OK');
  });
});
