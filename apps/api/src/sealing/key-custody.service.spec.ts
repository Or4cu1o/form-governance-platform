import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { KeyCustodyService } from './key-custody.service';

function writePemPair(dir: string, fileBaseName: string) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privatePath = join(dir, `${fileBaseName}.pem`);
  writeFileSync(privatePath, privatePem);
  return { privatePath, publicPem };
}

describe('KeyCustodyService', () => {
  let keyDir: string;

  beforeEach(() => {
    keyDir = mkdtempSync(join(tmpdir(), 'sealing-keys-'));
  });

  function buildService(config: Record<string, string>): KeyCustodyService {
    const configService = {
      getOrThrow: (key: string) => {
        const value = config[key];
        if (!value) throw new Error(`Missing ${key}`);
        return value;
      },
    } as unknown as ConfigService;
    return new KeyCustodyService(configService);
  }

  test('loads the active key pair from the referenced file, never from the env value itself', () => {
    const { privatePath } = writePemPair(keyDir, 'active');
    const service = buildService({ SEALING_PRIVATE_KEY_PATH: privatePath, SEALING_KEY_ID: 'seal-2026-01' });

    service.onModuleInit();

    expect(service.getActiveKeyId()).toBe('seal-2026-01');
    expect(service.getActiveKeyPair().privateKey).toBeDefined();
    expect(service.getActiveKeyPair().publicKey).toBeDefined();
  });

  test('resolves the public key of the active keyId', () => {
    const { privatePath } = writePemPair(keyDir, 'active');
    const service = buildService({ SEALING_PRIVATE_KEY_PATH: privatePath, SEALING_KEY_ID: 'seal-2026-01' });
    service.onModuleInit();

    expect(service.getPublicKey('seal-2026-01')).toBeDefined();
    expect(service.isRetired('seal-2026-01')).toBe(false);
  });

  test('a retired keyId remains resolvable for verification after rotation', () => {
    const { privatePath } = writePemPair(keyDir, 'active');
    const retiredDir = join(keyDir, 'retired');
    mkdirSync(retiredDir);
    const { publicPem } = writePemPair(keyDir, 'scratch');
    writeFileSync(join(retiredDir, 'seal-2025-06.pub.pem'), publicPem);

    const service = buildService({ SEALING_PRIVATE_KEY_PATH: privatePath, SEALING_KEY_ID: 'seal-2026-01' });
    service.onModuleInit();

    expect(service.getPublicKey('seal-2025-06')).toBeDefined();
    expect(service.isRetired('seal-2025-06')).toBe(true);
    expect(service.listKnownKeyIds()).toEqual(['seal-2026-01', 'seal-2025-06']);
  });

  test('an unknown keyId resolves to undefined instead of throwing', () => {
    const { privatePath } = writePemPair(keyDir, 'active');
    const service = buildService({ SEALING_PRIVATE_KEY_PATH: privatePath, SEALING_KEY_ID: 'seal-2026-01' });
    service.onModuleInit();

    expect(service.getPublicKey('seal-inexistente')).toBeUndefined();
  });
});
