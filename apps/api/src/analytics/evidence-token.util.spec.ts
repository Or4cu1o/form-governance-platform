import { createHmac } from 'crypto';
import { signEvidenceToken, verifyEvidenceToken } from './evidence-token.util';

const SECRET = 'segredo-de-teste-nao-usar-em-producao';

describe('evidence-token.util', () => {
  it('assina e verifica um token valido, devolvendo o payload original', () => {
    const payload = { evidenceFileId: 'evidence-1', expiresAt: Date.now() + 60_000 };
    const token = signEvidenceToken(payload, SECRET);
    expect(verifyEvidenceToken(token, SECRET)).toEqual(payload);
  });

  it('rejeita token sem separador', () => {
    expect(verifyEvidenceToken('token-sem-ponto', SECRET)).toBeNull();
  });

  it('rejeita token com assinatura adulterada', () => {
    const token = signEvidenceToken({ evidenceFileId: 'evidence-1', expiresAt: Date.now() + 60_000 }, SECRET);
    const [payloadB64] = token.split('.');
    expect(verifyEvidenceToken(`${payloadB64}.assinatura-forjada`, SECRET)).toBeNull();
  });

  it('rejeita token assinado com outro segredo', () => {
    const token = signEvidenceToken({ evidenceFileId: 'evidence-1', expiresAt: Date.now() + 60_000 }, 'outro-segredo');
    expect(verifyEvidenceToken(token, SECRET)).toBeNull();
  });

  it('rejeita payload nao-JSON apos decodificar', () => {
    const bogusPayload = Buffer.from('nao e json', 'utf8').toString('base64url');
    const signature = createHmac('sha256', SECRET).update(bogusPayload).digest('base64url');
    expect(verifyEvidenceToken(`${bogusPayload}.${signature}`, SECRET)).toBeNull();
  });

  it('rejeita payload JSON sem os campos esperados', () => {
    const bogusPayload = Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf8').toString('base64url');
    const signature = createHmac('sha256', SECRET).update(bogusPayload).digest('base64url');
    expect(verifyEvidenceToken(`${bogusPayload}.${signature}`, SECRET)).toBeNull();
  });
});
