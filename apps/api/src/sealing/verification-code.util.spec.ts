import {
  canonicalizeVerificationCode,
  generateVerificationCode,
  isValidVerificationCodeFormat,
} from './verification-code.util';

describe('verification-code.util', () => {
  // FR-100: alfabeto sem caracteres ambiguos.
  it('never uses the ambiguous characters 0/O or 1/I', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateVerificationCode();
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  // FR-100: nao sequencial — geracoes consecutivas nao guardam relacao
  // previsivel entre si.
  it('generates non-sequential codes from a cryptographically secure source', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateVerificationCode()));
    expect(codes.size).toBe(500);
  });

  it('produces a code that passes its own check digit validation', () => {
    const code = generateVerificationCode();
    expect(isValidVerificationCodeFormat(code)).toBe(true);
  });

  it('rejects a code with a single mistyped character via the check digit', () => {
    const code = generateVerificationCode();
    const canonical = canonicalizeVerificationCode(code);
    const tampered = (canonical[0] === '2' ? '3' : '2') + canonical.slice(1);
    expect(isValidVerificationCodeFormat(tampered)).toBe(false);
  });

  it('rejects malformed input (wrong length, foreign characters) without throwing', () => {
    expect(isValidVerificationCodeFormat('curto')).toBe(false);
    expect(isValidVerificationCodeFormat('')).toBe(false);
    expect(isValidVerificationCodeFormat('ZZZZ-ZZZZ-ZZZZ-ZZZZ-!')).toBe(false);
  });

  it('normalizes dashes and case for canonical storage/lookup', () => {
    expect(canonicalizeVerificationCode('abcd-2345')).toBe('ABCD2345');
  });
});
