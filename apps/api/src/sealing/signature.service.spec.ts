import { generateKeyPairSync, KeyObject } from 'crypto';
import { KeyCustodyService } from './key-custody.service';
import { SignatureService } from './signature.service';

describe('SignatureService', () => {
  let service: SignatureService;
  let activeKeyPair: { keyId: string; privateKey: KeyObject; publicKey: KeyObject };
  let getPublicKeyMock: jest.Mock;

  beforeEach(() => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    activeKeyPair = { keyId: 'seal-2026-01', privateKey, publicKey };
    getPublicKeyMock = jest.fn((keyId: string) => (keyId === activeKeyPair.keyId ? publicKey : undefined));
    const keyCustodyService = {
      getActiveKeyPair: () => activeKeyPair,
      getPublicKey: getPublicKeyMock,
    } as unknown as KeyCustodyService;
    service = new SignatureService(keyCustodyService);
  });

  it('signs the contentDigest with the active key and reports which keyId signed it', () => {
    const { signature, keyId } = service.signContentDigest('abc123');

    expect(keyId).toBe('seal-2026-01');
    expect(service.verify('abc123', signature, keyId)).toBe(true);
  });

  it('rejects a signature when the content digest was altered after signing', () => {
    const { signature, keyId } = service.signContentDigest('abc123');

    expect(service.verify('abc124', signature, keyId)).toBe(false);
  });

  it('returns false instead of throwing for an unknown keyId', () => {
    expect(service.verify('abc123', 'not-a-real-signature', 'keyId-que-nao-existe')).toBe(false);
  });
});
