import { randomBytes } from 'crypto';

// FR-100: codigo unico, legivel por humano, nao sequencial e nao
// enumeravel. Alfabeto Base32 sem os caracteres ambiguos '0'/'O' e '1'/'I'
// (32 simbolos: digitos 2-9 + A-Z exceto I e O) — 256 e divisivel por 32,
// entao amostrar cada byte com modulo nao introduz vies de distribuicao.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const BODY_LENGTH = 16;
const GROUP_SIZE = 4;

function randomBodyFromAlphabet(length: number): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

// Digito verificador: soma dos indices no alfabeto, modulo o tamanho do
// alfabeto — detecta erro de transcricao de um unico caractere ao digitar
// o codigo a partir de uma via impressa.
function computeCheckDigit(body: string): string {
  let sum = 0;
  for (const char of body) {
    sum += ALPHABET.indexOf(char);
  }
  return ALPHABET[sum % ALPHABET.length];
}

function groupWithDashes(raw: string): string {
  const groups: string[] = [];
  for (let i = 0; i < raw.length; i += GROUP_SIZE) {
    groups.push(raw.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}

export function generateVerificationCode(): string {
  const body = randomBodyFromAlphabet(BODY_LENGTH);
  const checkDigit = computeCheckDigit(body);
  return groupWithDashes(body + checkDigit);
}

function normalize(code: string): string {
  return code.replace(/-/g, '').toUpperCase();
}

// FR-105: codigo malformado deve ser reconhecivel ANTES de qualquer
// consulta ao banco, para que a resposta a codigo malformado e a codigo
// inexistente sigam o mesmo caminho de latencia constante no controller.
export function isValidVerificationCodeFormat(code: string): boolean {
  const normalized = normalize(code);
  if (normalized.length !== BODY_LENGTH + 1) return false;
  for (const char of normalized) {
    if (!ALPHABET.includes(char)) return false;
  }
  const body = normalized.slice(0, BODY_LENGTH);
  const checkDigit = normalized.slice(BODY_LENGTH);
  return computeCheckDigit(body) === checkDigit;
}

// Chave de consulta canonica (sem dashes, maiuscula) — a mesma usada para
// gravar em ExportSeal.verificationCode.
export function canonicalizeVerificationCode(code: string): string {
  return normalize(code);
}
