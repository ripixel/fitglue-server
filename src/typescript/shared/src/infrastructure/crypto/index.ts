import crypto from 'crypto';
import { getSecret } from '../secrets';

/**
 * Encrypts user credentials using AES-256-GCM with the OAuth state secret
 * @param credentials Email and password to encrypt
 * @param projectId Google Cloud project ID
 * @returns Encrypted credentials as JSON string
 */
export async function encryptCredentials(
  credentials: { email: string; password: string },
  projectId: string
): Promise<string> {
  const secret = await getSecret(projectId, 'oauth-state-secret');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(secret, 'hex'),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
    authTag: authTag.toString('hex'),
  });
}

/**
 * Decrypts user credentials encrypted with encryptCredentials
 * @param encryptedData Encrypted credentials JSON string
 * @param projectId Google Cloud project ID
 * @returns Decrypted email and password
 */
export async function decryptCredentials(
  encryptedData: string,
  projectId: string
): Promise<{ email: string; password: string }> {
  const secret = await getSecret(projectId, 'oauth-state-secret');
  const { iv, data, authTag } = JSON.parse(encryptedData);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(secret, 'hex'),
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, 'hex')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}
