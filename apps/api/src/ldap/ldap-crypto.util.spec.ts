import { randomBytes } from 'crypto';
import { decryptLdapBindPassword, encryptLdapBindPassword, parseLdapEncryptionKey } from './ldap-crypto.util';

describe('ldap-crypto.util', () => {
  const key = randomBytes(32);

  describe('encryptLdapBindPassword / decryptLdapBindPassword', () => {
    test('decrypts back to the original plain text', () => {
      const encrypted = encryptLdapBindPassword('senha-super-secreta', key);
      expect(decryptLdapBindPassword(encrypted, key)).toBe('senha-super-secreta');
    });

    test('produces a different ciphertext on every call (random IV)', () => {
      const first = encryptLdapBindPassword('mesma-senha', key);
      const second = encryptLdapBindPassword('mesma-senha', key);
      expect(first).not.toBe(second);
    });

    test('throws when the payload format is invalid', () => {
      expect(() => decryptLdapBindPassword('formato-invalido', key)).toThrow(
        'Payload de senha LDAP criptografada em formato invalido',
      );
    });

    test('throws when the ciphertext was tampered with', () => {
      const encrypted = encryptLdapBindPassword('senha', key);
      const [iv, authTag] = encrypted.split(':');
      const tampered = [iv, authTag, Buffer.from('lixo-adulterado').toString('base64')].join(':');
      expect(() => decryptLdapBindPassword(tampered, key)).toThrow();
    });
  });

  describe('parseLdapEncryptionKey', () => {
    test('returns a 32-byte buffer for a valid base64-encoded key', () => {
      const validKey = randomBytes(32).toString('base64');
      expect(parseLdapEncryptionKey(validKey).length).toBe(32);
    });

    test('throws when the decoded key is not 32 bytes', () => {
      const shortKey = randomBytes(16).toString('base64');
      expect(() => parseLdapEncryptionKey(shortKey)).toThrow('32 bytes');
    });
  });
});
