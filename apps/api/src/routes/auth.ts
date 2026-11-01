import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError } from '../lib/http.js';
import { loginSchema, profileSchema, registerSchema } from '../lib/schemas.js';
import { requireAuth, signToken, type AuthUser } from '../middleware/auth.js';

export const authRouter = Router();

const PUBLIC_USER = `u.id, u.email, u.role, u.first_name, u.last_name, u.phone, u.city_id, u.avatar_url, u.created_at,
  d.company_name, d.is_verified AS dealer_verified`;

authRouter.post('/register', async (req, res) => {
  const input = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await db.transaction(async (tx) => {
    const { rows } = await tx.query<AuthUser>(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone, city_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, role`,
      [input.email, passwordHash, input.role, input.first_name, input.last_name, input.phone ?? null, input.city_id ?? null],
    );
    if (input.role === 'professionnel') {
      await tx.query(
        'INSERT INTO dealer_profiles (user_id, company_name, nif, stat, city_id) VALUES ($1, $2, $3, $4, $5)',
        [rows[0].id, input.company_name, input.nif ?? null, input.stat ?? null, input.city_id ?? null],
      );
    }
    return rows[0];
  });

  res.status(201).json({ token: signToken(user), user });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const row = await db.one<AuthUser & { password_hash: string; is_active: boolean }>(
    'SELECT id, role, password_hash, is_active FROM users WHERE lower(email) = $1',
    [email],
  );
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw new HttpError(401, 'E-mail ou mot de passe incorrect');
  }
  if (!row.is_active) throw new HttpError(403, 'Ce compte est désactivé');
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [row.id]);
  res.json({ token: signToken({ id: row.id, role: row.role }) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const me = await db.one(
    `SELECT ${PUBLIC_USER} FROM users u LEFT JOIN dealer_profiles d ON d.user_id = u.id WHERE u.id = $1`,
    [req.user!.id],
  );
  if (!me) throw new HttpError(404, 'Utilisateur introuvable');
  res.json(me);
});

/** POST /auth/password — changement de mot de passe (mot de passe actuel exigé). */
authRouter.post('/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = z
    .object({ current_password: z.string().min(1), new_password: z.string().min(8, '8 caractères minimum') })
    .parse(req.body);
  const row = await db.one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
  if (!row || !(await bcrypt.compare(current_password, row.password_hash))) {
    throw new HttpError(422, 'Mot de passe actuel incorrect', undefined);
  }
  await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user!.id, await bcrypt.hash(new_password, 12)]);
  res.status(204).end();
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const input = profileSchema.partial().parse(req.body);
  const entries = Object.entries(input).filter(([, v]) => v !== undefined);
  if (entries.length) {
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    await db.query(`UPDATE users SET ${sets} WHERE id = $1`, [req.user!.id, ...entries.map(([, v]) => v)]);
  }
  res.json(await db.one(`SELECT ${PUBLIC_USER} FROM users u LEFT JOIN dealer_profiles d ON d.user_id = u.id WHERE u.id = $1`, [req.user!.id]));
});
