import { BadRequestException } from '@nestjs/common';
import { assertEvidenceFileSignatureMatches, EVIDENCE_MIME_TYPE_FILTER } from './evidence-upload.constants';

describe('EVIDENCE_MIME_TYPE_FILTER', () => {
  function buildFile(mimetype: string): Express.Multer.File {
    return { mimetype } as Express.Multer.File;
  }

  test.each(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])(
    'accepts %s',
    (mimetype) => {
      const callback = jest.fn();

      EVIDENCE_MIME_TYPE_FILTER({}, buildFile(mimetype), callback);

      expect(callback).toHaveBeenCalledWith(null, true);
    },
  );

  test.each(['application/x-msdownload', 'text/html', 'image/svg+xml', 'application/javascript'])(
    'rejects %s with a BadRequestException',
    (mimetype) => {
      const callback = jest.fn();

      EVIDENCE_MIME_TYPE_FILTER({}, buildFile(mimetype), callback);

      expect(callback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    },
  );
});

// T168/T044 — o teste acima cobre apenas o header `mimetype`, forjavel pelo
// cliente. Estes testes exercitam assertEvidenceFileSignatureMatches com a
// assinatura binaria REAL de cada arquivo (bytes confirmados contra o
// detector da biblioteca file-type antes de serem fixados aqui) e com a
// extensao do nome original, provando que a divergencia entre extensao,
// tipo declarado e conteudo real (FR-035, cenario US1-7) e detectada e
// recusada com BadRequestException.
describe('assertEvidenceFileSignatureMatches (assinatura binaria + extensao, T168/T044)', () => {
  const REAL_SIGNATURE_BASE64: Record<string, string> = {
    'application/pdf': 'JVBERi0xLjQKJSVFT0Y=', // "%PDF-1.4\n%%EOF"
    'image/jpeg': '/9j/4AAQSkY=', // FF D8 FF ...
    'image/webp': 'UklGRgAAAABXRUJQ', // "RIFF"...."WEBP"
    'image/png': 'iVBORw0KGgoAAAANSUhEUgAAAAAAAAAAAAAAAAAAAAAAAAAAAElEQVQ=', // assinatura PNG + chunk IHDR/IDAT minimo
  };
  const MATCHING_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
    'application/pdf': 'evidencia.pdf',
    'image/jpeg': 'evidencia.jpg',
    'image/webp': 'evidencia.webp',
    'image/png': 'evidencia.png',
  };
  const WINDOWS_EXECUTABLE_BASE64 = 'TVqQAAMAAAA='; // cabecalho MZ (PE/EXE)

  function buildFileWithBuffer(mimetype: string, base64: string, originalname: string): Express.Multer.File {
    return { mimetype, buffer: Buffer.from(base64, 'base64'), originalname } as Express.Multer.File;
  }

  test.each(Object.entries(REAL_SIGNATURE_BASE64))(
    'accepts %s when signature, mimetype and extension all agree',
    (mimetype, base64) => {
      const file = buildFileWithBuffer(mimetype, base64, MATCHING_EXTENSION_BY_MIME_TYPE[mimetype]);

      expect(() => assertEvidenceFileSignatureMatches(file)).not.toThrow();
    },
  );

  test('accepts the alternate .jpeg extension for image/jpeg', () => {
    const file = buildFileWithBuffer('image/jpeg', REAL_SIGNATURE_BASE64['image/jpeg'], 'evidencia.jpeg');

    expect(() => assertEvidenceFileSignatureMatches(file)).not.toThrow();
  });

  test('rejects a file declared as PDF whose binary signature is actually a JPEG', () => {
    const forged = buildFileWithBuffer('application/pdf', REAL_SIGNATURE_BASE64['image/jpeg'], 'evidencia.pdf');

    expect(() => assertEvidenceFileSignatureMatches(forged)).toThrow(BadRequestException);
  });

  test('rejects a Windows executable disguised with an allowed image mimetype', () => {
    const disguised = buildFileWithBuffer('image/png', WINDOWS_EXECUTABLE_BASE64, 'evidencia.png');

    expect(() => assertEvidenceFileSignatureMatches(disguised)).toThrow(BadRequestException);
  });

  test('rejects an empty buffer for every allowed mimetype', () => {
    for (const mimetype of Object.keys(REAL_SIGNATURE_BASE64)) {
      expect(() =>
        assertEvidenceFileSignatureMatches({
          mimetype,
          buffer: Buffer.alloc(0),
          originalname: MATCHING_EXTENSION_BY_MIME_TYPE[mimetype],
        } as Express.Multer.File),
      ).toThrow(BadRequestException);
    }
  });

  // T044 (FR-035): assinatura e mimetype corretos, mas a extensao do nome
  // original diverge — a evidencia real de que "extensao" e checada de
  // fato, nao so mimetype-vs-bytes.
  test('rejects when the file extension does not match the declared mimetype, even with a valid signature', () => {
    const mismatchedExtension = buildFileWithBuffer(
      'application/pdf',
      REAL_SIGNATURE_BASE64['application/pdf'],
      'evidencia.png',
    );

    expect(() => assertEvidenceFileSignatureMatches(mismatchedExtension)).toThrow(BadRequestException);
  });

  test('rejects a file with no extension at all', () => {
    const noExtension = buildFileWithBuffer('application/pdf', REAL_SIGNATURE_BASE64['application/pdf'], 'evidencia');

    expect(() => assertEvidenceFileSignatureMatches(noExtension)).toThrow(BadRequestException);
  });
});
