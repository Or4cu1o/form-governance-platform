import { BadRequestException } from '@nestjs/common';

// Fase 12 — achado HIGH da revisao de seguranca: FileInterceptor sem
// fileFilter aceitava qualquer mimetype informado pelo cliente, gravado sem
// validacao como ContentType no S3/MinIO e depois exposto via URL
// pre-assinada (risco de XSS armazenado / distribuicao de malware
// disfarcado de evidencia). Restringe a formatos plausiveis de evidencia
// documental.
export const MAX_EVIDENCE_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

// T168 — o mimetype acima e o header enviado pelo cliente, trivialmente
// forjavel, e serve so para rejeitar cedo (antes de ler o arquivo inteiro
// ou de gastar uma chamada ao S3). A checagem que realmente nao pode ser
// forjada e ler os primeiros bytes do arquivo (assinatura binaria / magic
// numbers) e compara-los contra o que o mimetype declarado promete.
//
// O validador embutido do Nest (FileTypeValidator) faria isso via pacote
// `file-type`, mas esse pacote e ESM-only e so importavel atraves de
// `import()` dinamico — o que funciona em runtime real, porem falha
// silenciosamente sob o sandbox `vm` do Jest sem a flag experimental
// --experimental-vm-modules (confirmado empiricamente: a promise rejeita
// com ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG, engolida pelo
// try/catch do proprio Nest, fazendo o validador sempre devolver `false`
// em teste). Mudar a config global do Jest para contornar isso arriscaria
// as ~53 suites existentes por uma checagem de exatamente 4 assinaturas
// conhecidas — a checagem manual abaixo e mais simples, determinística e
// testavel sem esse atrito.
const EVIDENCE_SIGNATURE_CHECKS: Record<string, (buffer: Buffer) => boolean> = {
  'application/pdf': (buf) => buf.length >= 4 && buf.subarray(0, 4).toString('latin1') === '%PDF',
  'image/png': (buf) =>
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a,
  'image/jpeg': (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  'image/webp': (buf) =>
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP',
};

// T044/FR-035: "exigindo coerencia entre extensao, tipo declarado e
// conteudo" — as tres pontas tem que combinar, nao so mimetype-vs-bytes.
const EVIDENCE_ALLOWED_EXTENSIONS_BY_MIME_TYPE: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

function extensionOf(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.slice(lastDot).toLowerCase();
}

// T168/T044 — chamado pelo service (EvidenceService/ValidationService) antes
// de qualquer escrita no S3/banco, com o buffer completo ja em memoria
// (multer.memoryStorage, o default do FileInterceptor sem `storage`
// explicito). O mimetype filter acima ja rejeitou tipos fora da lista
// permitida; aqui a divergencia entre extensao, tipo declarado e o que os
// bytes realmente sao vira 400, sem gravar nada (FR-035, cenario US1-7).
export function assertEvidenceFileSignatureMatches(file: Express.Multer.File): void {
  const signatureCheck = EVIDENCE_SIGNATURE_CHECKS[file.mimetype];
  if (!signatureCheck || !signatureCheck(file.buffer)) {
    throw new BadRequestException(
      `O conteudo do arquivo nao corresponde ao tipo declarado (${file.mimetype}).`,
    );
  }

  const allowedExtensions = EVIDENCE_ALLOWED_EXTENSIONS_BY_MIME_TYPE[file.mimetype] ?? [];
  if (!allowedExtensions.includes(extensionOf(file.originalname))) {
    throw new BadRequestException(
      `A extensao do arquivo nao corresponde ao tipo declarado (${file.mimetype}).`,
    );
  }
}

export function EVIDENCE_MIME_TYPE_FILTER(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.mimetype)) {
    callback(new BadRequestException(`Tipo de arquivo nao permitido: ${file.mimetype}`), false);
    return;
  }
  callback(null, true);
}
