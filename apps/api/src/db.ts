import fs from 'node:fs';
import path from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { config } from './config.js';

/**
 * Accès base de données.
 * - DATABASE_URL défini : PostgreSQL via `pg` (pool de connexions).
 * - Sinon : PGlite, le moteur PostgreSQL compilé en WebAssembly, stocké sur disque.
 *   Même SQL, même schéma : aucun serveur à installer en développement.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

interface Driver extends Queryable {
  exec(sql: string): Promise<void>;
  transaction<R>(fn: (tx: Queryable) => Promise<R>): Promise<R>;
}

async function createDriver(): Promise<Driver> {
  if (config.databaseUrl) {
    const { default: pg } = await import('pg');
    // BIGINT (identifiants, prix en MGA) renvoyés en number : < 2^53 en pratique
    pg.types.setTypeParser(20, (v) => Number(v));
    const pool = new pg.Pool({ connectionString: config.databaseUrl });
    const run = (q: Pool | PoolClient): Queryable['query'] =>
      async (sql, params) => (await q.query(sql, params)) as unknown as { rows: never[] };
    return {
      query: run(pool),
      exec: async (sql) => void (await pool.query(sql)),
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn({ query: run(client) });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
    } as Driver;
  }

  const { PGlite, types } = await import('@electric-sql/pglite');
  fs.mkdirSync(path.dirname(config.pgliteDir), { recursive: true });
  const db = await PGlite.create(config.pgliteDir, {
    parsers: { [types.INT8]: (v: string) => Number(v) },
  });
  return {
    query: async (sql, params) => db.query(sql, params),
    exec: async (sql) => void (await db.exec(sql)),
    transaction: async (fn) => db.transaction(async (tx) => fn({ query: async (sql, params) => tx.query(sql, params) })),
  } as Driver;
}

let driver: Promise<Driver> | undefined;
const getDriver = () => (driver ??= createDriver());

export const db = {
  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    return (await (await getDriver()).query<T>(sql, params)).rows;
  },
  async one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    return (await db.query<T>(sql, params))[0];
  },
  async exec(sql: string) {
    return (await getDriver()).exec(sql);
  },
  async transaction<R>(fn: (tx: Queryable) => Promise<R>): Promise<R> {
    return (await getDriver()).transaction(fn);
  },
};
