import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler, HttpError } from './lib/http.js';
import { adsRouter } from './routes/ads.js';
import { authRouter } from './routes/auth.js';
import { messagesRouter } from './routes/messages.js';
import { paymentsRouter } from './routes/payments.js';
import { proRouter } from './routes/pro.js';
import { meRouter } from './routes/me.js';
import { adminVerificationsRouter, verificationsRouter } from './routes/verifications.js';
import { stripeWebhook } from './routes/payments.js';
import { referenceRouter } from './routes/reference.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.webOrigin }));
// Corps brut pour vérifier la signature Stripe : doit précéder express.json()
app.post('/api/payments/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhook);
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '30d', immutable: true }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/reference', referenceRouter);
app.use('/api/ads', adsRouter);
app.use('/api/conversations', messagesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/pro', proRouter);
app.use('/api/me', meRouter);
app.use('/api/verifications', verificationsRouter);
app.use('/api/admin/verifications', adminVerificationsRouter);

app.use((_req, _res, next) => next(new HttpError(404, 'Route inconnue')));
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API fiara.mdg prête sur http://localhost:${config.port}`);
});
