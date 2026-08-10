import { ConfigService } from '@nestjs/config';
import { createPublicKey, generateKeyPairSync } from 'crypto';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { KeyCustodyService } from '../sealing/key-custody.service';
import { SignatureService } from '../sealing/signature.service';

// T143/FR-104/cenario US7-11: com o documento impresso, a chave publica
// publicada e o keyId estampado, o auditor confere a assinatura SEM
// contatar a plataforma. Este teste simula exatamente isso: assina com
// uma instancia (o "servidor"), depois verifica com uma instancia NOVA e
// isolada que so conhece a chave PUBLICA exportada (o "auditor offline")
// — nunca reaproveita o KeyCustodyService nem o banco do lado que assinou.
describe('offline verification (no contact with the platform)', () => {
  function buildKeyCustodyService(privatePath: string, keyId: string): KeyCustodyService {
    const configService = {
      getOrThrow: (key: string) => (key === 'SEALING_PRIVATE_KEY_PATH' ? privatePath : keyId),
    } as unknown as ConfigService;
    const service = new KeyCustodyService(configService);
    service.onModuleInit();
    return service;
  }

  it('verifies a signature offline using only the exported public key, the contentDigest and the keyId — no shared state with the signer', () => {
    const keyDir = mkdtempSync(join(tmpdir(), 'offline-verify-'));
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    writeFileSync(join(keyDir, 'active.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));

    // Lado que assina — "o servidor".
    const serverKeyCustody = buildKeyCustodyService(join(keyDir, 'active.pem'), 'seal-2026-01');
    const serverSignature = new SignatureService(serverKeyCustody);
    const contentDigest = 'sha256-of-the-canonical-envelope';
    const { signature, keyId } = serverSignature.signContentDigest(contentDigest);

    // O que o QR code/rodape do documento realmente carrega: contentDigest,
    // signature (base64) e keyId — mais a chave publica, publicada
    // separadamente em GET /api/public/keys (aqui simulada exportando o
    // DER/base64 da chave publica, exatamente como VerificationController
    // faz em describeKey()).
    const exportedPublicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

    // Lado que verifica — "o auditor offline": reconstroi a chave publica
    // APENAS a partir do que foi publicado, numa instancia isolada que
    // nunca teve acesso a chave privada nem ao KeyCustodyService do servidor.
    const reconstructedPublicKey = createPublicKey({
      key: Buffer.from(exportedPublicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const offlineKeyCustody = {
      getPublicKey: (candidateKeyId: string) => (candidateKeyId === keyId ? reconstructedPublicKey : undefined),
    } as unknown as KeyCustodyService;
    const offlineSignature = new SignatureService(offlineKeyCustody);

    expect(offlineSignature.verify(contentDigest, signature, keyId)).toBe(true);
  });

  it('rejects offline verification when even one character of the printed contentDigest is mistyped', () => {
    const keyDir = mkdtempSync(join(tmpdir(), 'offline-verify-'));
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    writeFileSync(join(keyDir, 'active.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));

    const serverKeyCustody = buildKeyCustodyService(join(keyDir, 'active.pem'), 'seal-2026-01');
    const serverSignature = new SignatureService(serverKeyCustody);
    const { signature, keyId } = serverSignature.signContentDigest('sha256-of-the-canonical-envelope');

    const offlineKeyCustody = { getPublicKey: () => publicKey } as unknown as KeyCustodyService;
    const offlineSignature = new SignatureService(offlineKeyCustody);

    const mistyped = 'sha256-of-the-canonical-envelop3';
    expect(offlineSignature.verify(mistyped, signature, keyId)).toBe(false);
  });

  // FR-104: um selo emitido sob uma chave ja aposentada no servidor
  // continua verificavel offline, desde que a chave publica correta (a
  // antiga) tenha sido publicada — o auditor nunca precisa saber se a
  // chave esta ativa ou aposentada, so precisa da chave certa para o keyId.
  it('verifies offline a signature made under what is now a retired key, given only that key’s public half', () => {
    const keyDir = mkdtempSync(join(tmpdir(), 'offline-verify-'));
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    writeFileSync(join(keyDir, 'active.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));

    const retiredKeyCustody = buildKeyCustodyService(join(keyDir, 'active.pem'), 'seal-2025-06-retired');
    const retiredSignature = new SignatureService(retiredKeyCustody);
    const { signature, keyId } = retiredSignature.signContentDigest('digest-assinado-ha-um-ano');

    const offlineKeyCustody = { getPublicKey: () => publicKey } as unknown as KeyCustodyService;
    const offlineSignature = new SignatureService(offlineKeyCustody);

    expect(offlineSignature.verify('digest-assinado-ha-um-ano', signature, keyId)).toBe(true);
  });
});
