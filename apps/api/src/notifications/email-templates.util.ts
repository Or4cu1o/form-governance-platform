import { ReportInstance, RoleName, Unit } from '@prisma/client';

export interface EmailContent {
  subject: string;
  html: string;
}

function periodoLabel(referenceMonth: Date): string {
  return referenceMonth.toISOString().slice(0, 7);
}

// unit.sigla/unit.nome sao texto livre cadastrado pelo Administrador
// (CreateUnitDto so exige @IsString @IsNotEmpty, sem whitelist de
// caracteres) e chegam aqui interpolados diretamente no HTML do e-mail —
// sem isso, um Administrador (ou uma conta comprometida) poderia gravar
// HTML/links arbitrarios que seriam enviados para toda a organizacao.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapHtml(title: string, bodyLines: string[]): string {
  const body = bodyLines.map((line) => `<p>${line}</p>`).join('\n');
  return `<h2>${title}</h2>\n${body}`;
}

function unitLabel(unit: Unit): string {
  return `${escapeHtml(unit.sigla)} - ${escapeHtml(unit.nome)}`;
}

// Defesa em profundidade contra CRLF/header injection no Assunto — remove
// quebras de linha antes de compor o subject (sigla vem de texto livre
// cadastrado pelo Administrador, sem whitelist de caracteres).
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]/g, ' ');
}

export function buildSlaOverdueEmail(report: ReportInstance, unit: Unit): EmailContent {
  return {
    subject: `[FormOps] SLA estourado — ${sanitizeHeaderValue(unit.sigla)} (${periodoLabel(report.referenceMonth)})`,
    html: wrapHtml('Estouro de SLA de elaboracao', [
      `O relatorio da unidade <strong>${unitLabel(unit)}</strong> referente a ${periodoLabel(report.referenceMonth)} continua PENDENTE apos o 5o dia util do periodo.`,
      'Regularize a elaboracao o quanto antes para evitar impacto no restante do fluxo.',
    ]),
  };
}

export function buildSubmittedForReviewEmail(report: ReportInstance, unit: Unit): EmailContent {
  return {
    subject: `[FormOps] Relatorio disponivel para revisao — ${sanitizeHeaderValue(unit.sigla)} (${periodoLabel(report.referenceMonth)})`,
    html: wrapHtml('Relatorio pronto para revisao', [
      `O Elaborador da unidade <strong>${unitLabel(unit)}</strong> submeteu o relatorio de ${periodoLabel(report.referenceMonth)} para revisao.`,
      'Acesse o FormOps para revisar os indicadores preenchidos.',
    ]),
  };
}

export function buildSubmittedForApprovalEmail(report: ReportInstance, unit: Unit): EmailContent {
  return {
    subject: `[FormOps] Relatorio pendente de aprovacao — ${sanitizeHeaderValue(unit.sigla)} (${periodoLabel(report.referenceMonth)})`,
    html: wrapHtml('Relatorio pronto para a Mesa de Validacao', [
      `O relatorio da unidade <strong>${unitLabel(unit)}</strong> referente a ${periodoLabel(report.referenceMonth)} foi revisado e aguarda contraprova do Aprovador.`,
      'Acesse a Mesa de Validacao Tecnica no FormOps para dar seguimento.',
    ]),
  };
}

export function buildReportReprovedEmail(report: ReportInstance, unit: Unit): EmailContent {
  return {
    subject: `[FormOps] Relatorio reprovado — ${sanitizeHeaderValue(unit.sigla)} (${periodoLabel(report.referenceMonth)})`,
    html: wrapHtml('Relatorio reprovado pela Mesa de Validacao', [
      `O relatorio da unidade <strong>${unitLabel(unit)}</strong> referente a ${periodoLabel(report.referenceMonth)} foi reprovado e retornou para correcao.`,
      report.slaExtensionDueDate
        ? `Novo prazo de correcao: <strong>${report.slaExtensionDueDate.toISOString().slice(0, 10)}</strong>.`
        : 'Consulte o FormOps para o novo prazo de correcao.',
    ]),
  };
}

export function buildReportConcludedEmail(report: ReportInstance, unit: Unit): EmailContent {
  return {
    subject: `[FormOps] Relatorio aprovado — ${sanitizeHeaderValue(unit.sigla)} (${periodoLabel(report.referenceMonth)})`,
    html: wrapHtml('Relatorio aprovado', [
      `O relatorio da unidade <strong>${unitLabel(unit)}</strong> referente a ${periodoLabel(report.referenceMonth)} foi aprovado pela Mesa de Validacao Tecnica.`,
      'Nenhuma acao adicional e necessaria.',
    ]),
  };
}

export function buildElevationRequestedEmail(
  user: { nome: string; sobrenome: string; matricula: string },
  requestedRole: RoleName,
): EmailContent {
  return {
    subject: '[FormOps] Solicitacao de elevacao de cargo pendente',
    html: wrapHtml('Nova solicitacao de elevacao de cargo', [
      `O usuario <strong>${escapeHtml(user.nome)} ${escapeHtml(user.sobrenome)}</strong> (matricula ${escapeHtml(user.matricula)}) foi identificado em um grupo do AD mapeado para <strong>${requestedRole}</strong>.`,
      'Acesse a fila de solicitacoes de elevacao no FormOps para aprovar ou rejeitar.',
    ]),
  };
}
