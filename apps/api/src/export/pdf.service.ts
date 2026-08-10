import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

export interface PdfFooterInfo {
  verificationCode: string;
  contentDigest: string;
  signature: string;
  keyId: string;
}

export interface PdfIndicatorLine {
  titulo: string;
  valor: string;
  conforme: boolean | null;
}

export interface PdfReportContent {
  title: string;
  unitSigla: string;
  unitNome: string;
  referencePeriod: string;
  status: string;
  indicators: PdfIndicatorLine[];
  veredictoFinal: string;
  aprovador: { nome: string; sobrenome: string; cargo?: string; unidade: string } | null;
}

// FR-108: gerado server-side a partir do acervo, jamais do DOM renderizado.
// O rodape estampa QR code + digests em texto legivel para a verificacao
// offline (FR-104, cenario US7-11) — footer e conhecido ANTES desta
// chamada (SealService.prepareSeal roda antes de renderizar, ver
// seal.service.ts) porque o artifactDigest so pode ser calculado DEPOIS,
// sobre os bytes finais deste PDF.
@Injectable()
export class PdfService {
  async render(content: PdfReportContent, footer: PdfFooterInfo): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(16).text(content.title);
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Unidade: ${content.unitSigla} — ${content.unitNome}`);
    doc.text(`Período de referência: ${content.referencePeriod}`);
    doc.text(`Status: ${content.status}`);
    doc.moveDown();

    doc.fontSize(12).text('Indicadores');
    doc.fontSize(10);
    for (const indicator of content.indicators) {
      const conformidade = indicator.conforme === null ? 'sem apuração' : indicator.conforme ? 'conforme' : 'não conforme';
      doc.text(`${indicator.titulo}: ${indicator.valor} (${conformidade})`);
    }
    doc.moveDown();

    doc.fontSize(12).text('Veredito final');
    doc.fontSize(10).text(content.veredictoFinal);

    if (content.aprovador) {
      doc.moveDown(0.5);
      const cargo = content.aprovador.cargo ? ` — ${content.aprovador.cargo}` : '';
      doc.text(`Assinatura eletrônica: ${content.aprovador.nome} ${content.aprovador.sobrenome}${cargo} (${content.aprovador.unidade})`);
    }

    const qrPayload = JSON.stringify({ verificationCode: footer.verificationCode, keyId: footer.keyId });
    const qrBuffer = await QRCode.toBuffer(qrPayload, { margin: 1, width: 120 });
    doc.moveDown();
    doc.image(qrBuffer, { width: 100 });

    doc.moveDown(0.5).fontSize(7);
    doc.text(`Código de verificação: ${footer.verificationCode}`);
    doc.text(`contentDigest (SHA-256): ${footer.contentDigest}`);
    doc.text(`Assinatura (Ed25519, base64): ${footer.signature}`);
    doc.text(`Chave de selagem: ${footer.keyId}`);

    doc.end();
    return finished;
  }
}
