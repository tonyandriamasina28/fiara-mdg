import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Coffre des pièces d'identité.
 *  - Chiffrement AES-256-GCM (authentifié) : un fichier volé sans la clé est illisible et toute altération est détectée.
 *  - Fichiers dans un dossier privé hors de la racine web, permissions 0600, noms aléatoires.
 *  - Lecture réservée au back-office ; suppression dès la décision.
 */

function key() {
  if (config.identityKey) {
    const k = Buffer.from(config.identityKey, 'base64');
    if (k.length !== 32) throw new Error('IDENTITY_ENCRYPTION_KEY doit faire 32 octets (base64)');
    return k;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('IDENTITY_ENCRYPTION_KEY est obligatoire en production');
  // Développement uniquement : clé dérivée du secret JWT
  return crypto.createHash('sha256').update(`identity:${config.jwtSecret}`).digest();
}

export async function storeDocument(plain: Buffer) {
  await fs.mkdir(config.identityDir, { recursive: true, mode: 0o700 });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const storageKey = `${crypto.randomUUID()}.bin`;
  await fs.writeFile(path.join(config.identityDir, storageKey), encrypted, { mode: 0o600 });
  return {
    storageKey,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    sha256: crypto.createHash('sha256').update(plain).digest('hex'),
  };
}

export async function readDocument(storageKey: string, iv: string, tag: string) {
  const encrypted = await fs.readFile(path.join(config.identityDir, path.basename(storageKey)));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export async function deleteDocument(storageKey: string) {
  await fs.rm(path.join(config.identityDir, path.basename(storageKey)), { force: true });
}
