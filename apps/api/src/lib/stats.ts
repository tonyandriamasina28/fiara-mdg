import { db, type Queryable } from '../db.js';

type StatColumn = 'views' | 'phone_reveals' | 'messages' | 'favorites';

const direct: Queryable = { query: async (sql, params) => ({ rows: await db.query(sql, params) }) };

/** Incrémente (ou décrémente) le compteur du jour d'une annonce — alimente l'analyse de la demande. */
export async function bumpStat(adId: number, column: StatColumn, by = 1, tx: Queryable = direct) {
  await tx.query(
    `INSERT INTO ad_daily_stats (ad_id, day, ${column}) VALUES ($1, current_date, GREATEST(0, $2::int))
     ON CONFLICT (ad_id, day) DO UPDATE SET ${column} = GREATEST(0, ad_daily_stats.${column} + $2::int)`,
    [adId, by],
  );
}
