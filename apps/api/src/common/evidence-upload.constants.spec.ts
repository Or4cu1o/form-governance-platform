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

// T168 — o teste acima cobre apenas o header `mimetype`, forjavel pelo
// cliente. Estes testes exercitam assertEvidenceFileSignatureMatches com a
// assinatura binaria REAL de cada arquivo (bytes confirmados contra o
// detector da biblioteca file-type antes de serem fixados aqui), provando
// que a divergencia entre o que o cliente declara e o que o arquivo
// realmente e (FR-035) e detectada e recusada com BadRequestException.
describe('assertEvidenceFileSignatureMatches (assinatura binaria, T168)', () => {
  const REAL_SIGNATURE_BASE64: Record<string, string> = {
    'application/pdf': 'JVBERi0xLjQKJSVFT0Y=', // "%PDF-1.4\n%%EOF"
    'image/jpeg': '/9j/4AAQSkY=', // FF D8 FF ...
    'image/webp': 'UklGRgAAAABXRUJQ', // "RIFF"...."WEBP"
    'image/png': 'iVBORw0KGgoAAAANSUhEUgAAAAAAAAAAAAAAAAAAAAAAAAAAAElEQVQ=', // assinatura PNG + chunk IHDR/IDAT minimo
  };
  const WINDOWS_EXECUTABLE_BASE64 = 'TVqQAAMAAAA='; // cabecalho MZ (PE/EXE)

  function buildFileWithBuffer(mimetype: string, base64: string): Express.Multer.File {
    return { mimetype, buffer: Buffer.from(base64, 'base64') } as Express.Multer.File;
  }

  test.each(Object.entries(REAL_SIGNATURE_BASE64))(
    'accepts %s when the binary signature matches the declared mimetype',
    (mimetype, base64) => {
      expect(() => assertEvidenceFileSignatureMatches(buildFileWithBuffer(mimetype, base64))).not.toThrow();
    },
  );

  test('rejects a file declared as PDF whose binary signature is actually a JPEG', () => {
    const forged = buildFileWithBuffer('application/pdf', REAL_SIGNATURE_BASE64['image/jpeg']);

    expect(() => assertEvidenceFileSignatureMatches(forged)).toThrow(BadRequestException);
  });

  test('rejects a Windows executable disguised with an allowed image mimetype', () => {
    const disguised = buildFileWithBuffer('image/png', WINDOWS_EXECUTABLE_BASE64);

    expect(() => assertEvidenceFileSignatureMatches(disguised)).toThrow(BadRequestException);
  });

  test('rejects an empty buffer for every allowed mimetype', () => {
    for (const mimetype of Object.keys(REAL_SIGNATURE_BASE64)) {
      expect(() =>
        assertEvidenceFileSignatureMatches({ mimetype, buffer: Buffer.alloc(0) } as Express.Multer.File),
      ).toThrow(BadRequestException);
    }
  });
});
