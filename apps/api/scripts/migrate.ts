/**
 * Crée le schéma, applique les migrations en attente puis, sur une base neuve, des données de démonstration.
 *   npm run db:migrate            → applique ce qui manque (db/schema.sql, db/seed.sql, db/migrations/*.sql)
 *   npm run db:migrate -- --reset → supprime et recrée tout (PGlite : dossier .data)
 */
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';

const reset = process.argv.includes('--reset');
if (reset && !config.databaseUrl) fs.rmSync(config.pgliteDir, { recursive: true, force: true });

const { db } = await import('../src/db.js');
const dbDir = path.join(config.repoRoot, 'db');
const sql = (file: string) => fs.readFileSync(path.join(dbDir, file), 'utf8');

if (reset && config.databaseUrl) {
  await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
const applied = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name));

const fresh = !(await db.one(`SELECT 1 FROM information_schema.tables WHERE table_name = 'ads'`));
if (fresh) {
  await db.exec(sql('schema.sql'));
  await db.exec(sql('seed.sql'));
  await db.query(`INSERT INTO schema_migrations (name) VALUES ('001_initial') ON CONFLICT DO NOTHING`);
  console.log('Schéma initial et référentiels créés.');
} else if (!applied.has('001_initial')) {
  // Base créée avant le suivi des migrations
  await db.query(`INSERT INTO schema_migrations (name) VALUES ('001_initial')`);
}

const migrations = fs.readdirSync(path.join(dbDir, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
for (const file of migrations) {
  const name = file.replace(/\.sql$/, '');
  if (applied.has(name)) continue;
  await db.exec(sql(path.join('migrations', file)));
  await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
  console.log(`Migration appliquée : ${name}`);
}

// Production : jamais de comptes ni d'annonces de démonstration (sauf --demo explicite)
const demoAllowed = process.env.NODE_ENV !== 'production' || process.argv.includes('--demo');
if (!fresh || !demoAllowed) {
  console.log(fresh ? 'Base créée (sans données de démonstration).' : 'Base à jour.');
  process.exit(0);
}

// ---- Données de démonstration -------------------------------------------------
const hash = await bcrypt.hash('fiara2026', 10);
const city = async (name: string) => (await db.one<{ id: number }>('SELECT id FROM cities WHERE name = $1', [name]))!.id;
const model = async (brand: string, slug: string) =>
  (await db.one<{ brand_id: number; id: number; category: string }>(
    'SELECT m.brand_id, m.id, m.category FROM models m JOIN brands b ON b.id = m.brand_id WHERE b.slug = $1 AND m.slug = $2',
    [brand, slug],
  ))!;
const user = async (email: string, role: string, first: string, last: string, phone: string | null, cityName: string) =>
  (await db.one<{ id: number }>(
    `INSERT INTO users (email, password_hash, role, first_name, last_name, phone, city_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [email, hash, role, first, last, phone, await city(cityName)],
  ))!.id;

await user('admin@fiara.mg', 'admin', 'Admin', 'fiara', null, 'Antananarivo');
const garage = await user('garage@fiara.mg', 'professionnel', 'Hery', 'Rakoto', '+261341234567', 'Antananarivo');
const particulier = await user('vola@fiara.mg', 'particulier', 'Vola', 'Randria', '+261321112233', 'Toamasina');
const acheteur = await user('tiana@fiara.mg', 'particulier', 'Tiana', 'Andria', '+261331234455', 'Antananarivo');
const commercial = await user('commercial@fiara.mg', 'particulier', 'Faly', 'Razafy', '+261381239876', 'Antananarivo');

await db.query(
  `INSERT INTO dealer_profiles (user_id, company_name, nif, stat, city_id, is_verified)
   VALUES ($1, 'Tana Auto Import', '3000123456', '45101 11 2019 0 00123', $2, TRUE)`,
  [garage, await city('Antananarivo')],
);
await db.query(
  `INSERT INTO dealer_sites (dealer_id, name, city_id, address, is_main)
   VALUES ($1, 'Showroom Ankorondrano', $2, 'Rue Ravoninahitriniarivo, Ankorondrano', TRUE)`,
  [garage, await city('Antananarivo')],
);
await db.query(`UPDATE dealer_sites SET latitude = -18.8946, longitude = 47.5250 WHERE dealer_id = $1`, [garage]);
// Garage de démonstration déjà vérifié (badge « Vendeur vérifié »)
await db.query('UPDATE users SET identity_verified_at = now() WHERE id = $1', [garage]);
await db.query(`INSERT INTO dealer_members (dealer_id, user_id, role) VALUES ($1, $1, 'proprietaire'), ($1, $2, 'commercial')`, [garage, commercial]);
await db.query(
  `INSERT INTO dealer_subscriptions (dealer_id, plan_id, status, starts_at, ends_at)
   SELECT $1, id, 'active', now() - interval '5 days', now() + interval '25 days' FROM subscription_plans WHERE code = 'gold'`,
  [garage],
);

type Demo = {
  seller: number; brand: string; model: string; version: string; year: number; km: number; fuel: string; gearbox: string;
  drive?: string; hp?: number; origin: string; customs: string; price: number; city: string; title: string;
  description: string; sponsoredDays?: number; ageDays: number;
};
const demo: Demo[] = [
  { seller: garage, brand: 'toyota', model: 'land-cruiser-prado', version: '3.0 D-4D TX', year: 2016, km: 98000, fuel: 'diesel', gearbox: 'automatique', drive: '4x4', hp: 173, origin: 'import_asie', customs: 'dedouane', price: 185_000_000, city: 'Antananarivo', title: 'Toyota Land Cruiser Prado 3.0 D-4D TX', description: 'Importé du Japon en 2023, carnet d\'entretien complet. 7 places, climatisation, caméra de recul.', sponsoredDays: 14, ageDays: 9 },
  { seller: garage, brand: 'toyota', model: 'hilux', version: '2.4 GD-6 double cabine', year: 2019, km: 72000, fuel: 'diesel', gearbox: 'manuelle', drive: '4x4', hp: 150, origin: 'import_asie', customs: 'non_dedouane', price: 128_000_000, city: 'Toamasina', title: 'Toyota Hilux double cabine 4x4 — au port de Tamatave', description: 'Véhicule en dépôt sous douane au port de Toamasina. Frais de dédouanement à la charge de l\'acheteur.', ageDays: 21 },
  { seller: garage, brand: 'mitsubishi', model: 'l200', version: '2.5 DI-D', year: 2014, km: 160000, fuel: 'diesel', gearbox: 'manuelle', drive: '4x4', hp: 136, origin: 'occasion_madagascar', customs: 'dedouane', price: 62_000_000, city: 'Antananarivo', title: 'Mitsubishi L200 2.5 DI-D 4x4', description: 'Roulé à Madagascar depuis 2016, entretien en garage agréé. Pneus neufs.', ageDays: 47 },
  { seller: particulier, brand: 'peugeot', model: '208', version: '1.2 PureTech Active', year: 2017, km: 54000, fuel: 'essence', gearbox: 'manuelle', hp: 82, origin: 'import_europe', customs: 'dedouane', price: 38_500_000, city: 'Toamasina', title: 'Peugeot 208 1.2 essence, très bon état', description: 'Importée de France en 2022. Première main à Madagascar, faible consommation. Prix légèrement négociable.', ageDays: 4 },
  { seller: particulier, brand: 'suzuki', model: 'jimny', version: '1.3 JLX', year: 2012, km: 118000, fuel: 'essence', gearbox: 'manuelle', drive: '4x4', hp: 85, origin: 'occasion_madagascar', customs: 'dedouane', price: 29_000_000, city: 'Toamasina', title: 'Suzuki Jimny 4x4 idéal pistes', description: 'Petit 4x4 robuste, parfait pour la côte Est. Visite technique à jour.', ageDays: 12 },
  { seller: garage, brand: 'hyundai', model: 'tucson', version: '2.0 CRDi', year: 2020, km: 41000, fuel: 'diesel', gearbox: 'automatique', drive: 'awd', hp: 185, origin: 'import_asie', customs: 'dedouane', price: 112_000_000, city: 'Mahajanga', title: 'Hyundai Tucson 2.0 CRDi automatique', description: 'Importée de Corée, état proche du neuf. Garantie garage 6 mois.', ageDays: 2 },
  { seller: garage, brand: 'nissan', model: 'navara', version: '2.5 dCi', year: 2015, km: 135000, fuel: 'diesel', gearbox: 'manuelle', drive: '4x4', hp: 190, origin: 'import_europe', customs: 'en_cours', price: 74_000_000, city: 'Antsiranana', title: 'Nissan Navara 2.5 dCi — dédouanement en cours', description: 'Arrivée récente d\'Europe, dossier de dédouanement en cours de finalisation.', ageDays: 33 },
  { seller: particulier, brand: 'renault', model: 'duster', version: '1.5 dCi 4x2', year: 2018, km: 88000, fuel: 'diesel', gearbox: 'manuelle', hp: 110, origin: 'occasion_madagascar', customs: 'dedouane', price: 45_000_000, city: 'Fianarantsoa', title: 'Renault Duster 1.5 dCi économique', description: 'Entretien régulier, aucun accident. Disponible pour essai à Fianarantsoa.', ageDays: 6 },
  // Concurrents pour la comparaison du marché
  { seller: particulier, brand: 'toyota', model: 'land-cruiser-prado', version: '3.0 D-4D', year: 2015, km: 132000, fuel: 'diesel', gearbox: 'automatique', drive: '4x4', hp: 173, origin: 'occasion_madagascar', customs: 'dedouane', price: 158_000_000, city: 'Antananarivo', title: 'Toyota Prado 3.0 D-4D 2015', description: 'Bien entretenu, 8 places.', ageDays: 15 },
  { seller: particulier, brand: 'toyota', model: 'land-cruiser-prado', version: '2.8 D-4D', year: 2017, km: 87000, fuel: 'diesel', gearbox: 'automatique', drive: '4x4', hp: 177, origin: 'import_asie', customs: 'dedouane', price: 198_000_000, city: 'Mahajanga', title: 'Toyota Land Cruiser Prado 2.8 2017', description: 'Import Dubaï, full options.', ageDays: 8 },
  { seller: particulier, brand: 'toyota', model: 'hilux', version: '2.5 D-4D', year: 2017, km: 110000, fuel: 'diesel', gearbox: 'manuelle', drive: '4x4', hp: 144, origin: 'occasion_madagascar', customs: 'dedouane', price: 105_000_000, city: 'Antananarivo', title: 'Toyota Hilux 2.5 D-4D double cabine', description: 'Utilisé en ville, carrosserie propre.', ageDays: 19 },
];

const adIds: number[] = [];
for (const d of demo) {
  const m = await model(d.brand, d.model);
  const vehicle = await db.one<{ id: number }>(
    `INSERT INTO vehicles (owner_id, brand_id, model_id, version, category, year, mileage_km, fuel, gearbox, drive, power_hp, origin, customs)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [d.seller, m.brand_id, m.id, d.version, m.category, d.year, d.km, d.fuel, d.gearbox, d.drive ?? null, d.hp ?? null, d.origin, d.customs],
  );
  const ad = await db.one<{ id: number }>(
    `INSERT INTO ads (vehicle_id, seller_id, title, description, price_mga, city_id, status, published_at, expires_at, sponsored_until)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', now() - make_interval(days => $7::int), now() + interval '60 days',
             CASE WHEN $8::int IS NULL THEN NULL ELSE now() + make_interval(days => $8::int) END)
     RETURNING id`,
    [vehicle!.id, d.seller, d.title, d.description, d.price, await city(d.city), d.ageDays, d.sponsoredDays ?? null],
  );
  adIds.push(ad!.id);

  // Statistiques quotidiennes fictives depuis la publication
  await db.query(
    `INSERT INTO ad_daily_stats (ad_id, day, views, phone_reveals, messages, favorites)
     SELECT $1, d::date, (5 + random() * 40)::int, (random() * 4)::int, (random() < 0.25)::int, (random() < 0.2)::int
       FROM generate_series(current_date - $2::int, current_date, interval '1 day') d`,
    [ad!.id, d.ageDays],
  );
}
await db.query(
  `UPDATE ads a SET views_count = s.v FROM (SELECT ad_id, sum(views)::int v FROM ad_daily_stats GROUP BY ad_id) s WHERE s.ad_id = a.id`,
);

// Favoris (pour l'offre directe), une conversation et le lead correspondant
await db.query('INSERT INTO favorites (user_id, ad_id) VALUES ($1, $3), ($2, $3), ($1, $4)', [acheteur, particulier, adIds[0], adIds[1]]);
const conv = await db.one<{ id: number }>(
  'INSERT INTO conversations (ad_id, buyer_id, seller_id) VALUES ($1, $2, $3) RETURNING id',
  [adIds[0], acheteur, garage],
);
await db.query(
  `INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES
     ($1, $2, 'Bonjour, le Prado est-il encore disponible ? Peut-on l''essayer samedi ?', now() - interval '2 hours'),
     ($1, $3, 'Bonjour Tiana, oui il est disponible. Samedi 9 h au showroom d''Ankorondrano vous convient ?', now() - interval '90 minutes')`,
  [conv!.id, acheteur, garage],
);
await db.query(
  `INSERT INTO leads (dealer_id, ad_id, buyer_id, conversation_id, name, phone, source, status, assigned_to, next_action_at)
   VALUES ($1, $2, $3, $4, 'Tiana Andria', '+261331234455', 'message', 'rdv', $5, now() + interval '3 days')`,
  [garage, adIds[0], acheteur, conv!.id, commercial],
);
await db.query(
  `INSERT INTO leads (dealer_id, ad_id, name, phone, source, status, notes)
   VALUES ($1, $2, 'M. Rabe', '+261349876543', 'telephone', 'nouveau', 'Appel reçu au showroom, intéressé par un pick-up dédouané.')`,
  [garage, adIds[1]],
);

// Recherches récentes de l'acheteuse de démonstration (profil)
await db.query(
  `INSERT INTO search_history (user_id, query_string, criteria, result_count, run_count, last_run_at) VALUES
     ($1, 'brand_id=1&customs=dedouane', '{"brand_id":"1","customs":"dedouane"}', 3, 4, now() - interval '1 hour'),
     ($1, 'category=pickup,suv_4x4&price_max=150000000&province_id=1', '{"category":"pickup,suv_4x4","price_max":"150000000","province_id":"1"}', 4, 2, now() - interval '1 day'),
     ($1, 'fuel=diesel&gearbox=automatique', '{"fuel":"diesel","gearbox":"automatique"}', 4, 1, now() - interval '3 days')`,
  [acheteur],
);

console.log(`${demo.length} annonces de démonstration créées.`);
console.log('Comptes de test (mot de passe « fiara2026 ») :');
console.log('  admin@fiara.mg · garage@fiara.mg (pro, formule Gold) · commercial@fiara.mg · vola@fiara.mg · tiana@fiara.mg');
process.exit(0);
