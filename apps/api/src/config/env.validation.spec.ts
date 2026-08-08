import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validConfig = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'secret',
    INITIAL_ADMIN_MATRICULA: '00001',
    INITIAL_ADMIN_EMAIL: 'admin@formops.local',
    INITIAL_ADMIN_PASSWORD: 'strong-password',
    SEALING_PRIVATE_KEY_PATH: '/run/secrets/sealing-ed25519.pem',
    SEALING_KEY_ID: 'seal-2026-01',
    EVIDENCE_RESOLVER_HMAC_SECRET: 'resolver-secret',
    S3_BUCKET_QUARANTINE: 'formops-quarentena',
    S3_BUCKET_IMMUTABLE: 'formops-imutavel',
    CLAMAV_HOST: 'clamav',
    CLAMAV_PORT: '3310',
  };

  test('returns the config unchanged when every required variable is present', () => {
    expect(validateEnv(validConfig)).toBe(validConfig);
  });

  test('throws when a single required variable is missing', () => {
    const withoutJwtSecret: Record<string, string> = { ...validConfig };
    delete withoutJwtSecret.JWT_SECRET;

    expect(() => validateEnv(withoutJwtSecret)).toThrow('JWT_SECRET');
  });

  test('lists every missing variable in the error message', () => {
    expect(() => validateEnv({ DATABASE_URL: validConfig.DATABASE_URL })).toThrow(
      [
        'JWT_SECRET',
        'INITIAL_ADMIN_MATRICULA',
        'INITIAL_ADMIN_EMAIL',
        'INITIAL_ADMIN_PASSWORD',
        'SEALING_PRIVATE_KEY_PATH',
        'SEALING_KEY_ID',
        'EVIDENCE_RESOLVER_HMAC_SECRET',
        'S3_BUCKET_QUARANTINE',
        'S3_BUCKET_IMMUTABLE',
        'CLAMAV_HOST',
        'CLAMAV_PORT',
      ].join(', '),
    );
  });

  test('treats an empty-string value as missing', () => {
    expect(() => validateEnv({ ...validConfig, JWT_SECRET: '' })).toThrow('JWT_SECRET');
  });

  test.each([
    'SEALING_PRIVATE_KEY_PATH',
    'SEALING_KEY_ID',
    'EVIDENCE_RESOLVER_HMAC_SECRET',
    'S3_BUCKET_QUARANTINE',
    'S3_BUCKET_IMMUTABLE',
    'CLAMAV_HOST',
    'CLAMAV_PORT',
  ] as const)('throws when %s is missing', (key) => {
    const withoutKey: Record<string, string> = { ...validConfig };
    delete withoutKey[key];

    expect(() => validateEnv(withoutKey)).toThrow(key);
  });
});
