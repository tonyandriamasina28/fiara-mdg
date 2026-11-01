import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // pas de fichier .env : valeurs par défaut ci-dessous
}

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || (isProd ? '' : 'dev-secret-fiara');
if (!jwtSecret) throw new Error('JWT_SECRET est obligatoire en production');

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  pgliteDir: path.join(root, '.data', 'pglite'),
  uploadsDir: path.join(root, 'uploads'),
  // Pièces d'identité : dossier PRIVÉ, jamais servi par express.static ni par le serveur web
  identityDir: process.env.IDENTITY_STORAGE_DIR || path.join(root, 'private', 'identity'),
  // Clé AES-256 (32 octets en base64). Obligatoire en production : openssl rand -base64 32
  identityKey: process.env.IDENTITY_ENCRYPTION_KEY || '',
  jwtSecret,
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:3000',
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:4000',
  repoRoot: path.resolve(root, '..', '..'),

  /**
   * Paiements internationaux. Sans clé, les paiements carte / PayPal fonctionnent en simulation.
   * PayPal ne gère pas l'Ariary et un compte Stripe malgache n'existe pas : on débite en euros
   * au taux ci-dessous (à remplacer par un flux de change quotidien).
   */
  payments: {
    mgaPerEur: Number(process.env.MGA_PER_EUR || 5200),
    cardCurrency: (process.env.CARD_CURRENCY || 'EUR').toUpperCase(),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
    paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    paypalApiBase: process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com',
  },
};
