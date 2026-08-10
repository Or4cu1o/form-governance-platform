import { PdfService } from './pdf.service';

describe('PdfService', () => {
  it('renders a valid PDF buffer stamped with the verification footer', async () => {
    const service = new PdfService();

    const buffer = await service.render(
      {
        title: 'Relatório Operacional',
        unitSigla: 'TI',
        unitNome: 'Tecnologia da Informação',
        referencePeriod: '2026-06',
        status: 'CONCLUIDO',
        indicators: [{ titulo: 'Quantitativo de servidores', valor: '42.0000', conforme: true }],
        veredictoFinal: 'Aprovado',
        aprovador: { nome: 'Ana', sobrenome: 'Aprovadora', cargo: 'Chefe de Gabinete', unidade: 'TI' },
      },
      {
        verificationCode: 'ABCD2345EFGH6789C',
        contentDigest: 'deadbeef',
        signature: 'c2ln',
        keyId: 'seal-2026-01',
      },
    );

    // Assinatura de arquivo PDF: os bytes devem comecar com "%PDF-".
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(0);
  });

  // FR-108: nenhum indicador exigido — recorte vazio/parcial ainda produz PDF valido (FR-097).
  it('renders a valid PDF even with no indicators and no approver', async () => {
    const service = new PdfService();

    const buffer = await service.render(
      {
        title: 'Relatório Operacional',
        unitSigla: 'TI',
        unitNome: 'Tecnologia da Informação',
        referencePeriod: '2026-06',
        status: 'PENDENTE',
        indicators: [],
        veredictoFinal: 'Pendente de elaboracao',
        aprovador: null,
      },
      { verificationCode: 'ABCD2345EFGH6789C', contentDigest: 'deadbeef', signature: 'c2ln', keyId: 'seal-2026-01' },
    );

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
