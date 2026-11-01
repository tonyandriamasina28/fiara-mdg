import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from './http.js';

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const adsDir = path.join(config.uploadsDir, 'ads');
fs.mkdirSync(adsDir, { recursive: true });

export const MAX_PHOTOS = 20;

/** Photos d'annonce : JPEG/PNG/WebP, 8 Mo max chacune, 20 max. */
export const adPhotosUpload = multer({
  storage: multer.diskStorage({
    destination: adsDir,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + EXT[file.mimetype]),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: MAX_PHOTOS },
  fileFilter: (_req, file, cb) => {
    if (EXT[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, 'Format de photo non accepté (JPEG, PNG ou WebP)'));
  },
}).array('photos', MAX_PHOTOS);

export const photoUrl = (filename: string) => `${config.publicUrl}/uploads/ads/${filename}`;

export function removeFiles(files: Express.Multer.File[] | undefined) {
  for (const f of files ?? []) fs.rm(f.path, { force: true }, () => {});
}

export function removePhotoByUrl(url: string) {
  const name = path.basename(new URL(url).pathname);
  fs.rm(path.join(adsDir, name), { force: true }, () => {});
}
