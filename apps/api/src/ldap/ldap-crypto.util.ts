import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

export function parseLdapEncryptionKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `LDAP_CONFIG_ENCRYPTION_KEY deve decodificar para ${KEY_LENGTH_BYTES} bytes em base64 (recebido: ${key.length})`,
    );
  }
  return key;
}

// Formato armazenado: "<iv base64>:<authTag base64>:<ciphertext base64>"
export function encryptLdapBindPassword(plainText: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptLdapBindPassword(payload: string, key: Buffer): string {
  const [ivB64, authTagB64, cipherTextB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !cipherTextB64) {
    throw new Error('Payload de senha LDAP criptografada em formato invalido');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherTextB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
