-- =====================================================================
-- fiara.mdg — migration 003
--  * Historique des recherches de l'utilisateur (affiché dans le profil)
--  * Paiement par carte bancaire (Stripe Checkout) et PayPal, en plus du Mobile Money
-- =====================================================================

-- ALTER TYPE … ADD VALUE ne peut pas être utilisé dans la même transaction que la valeur ajoutée :
-- ces deux lignes restent hors du bloc BEGIN/COMMIT.
ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'stripe';
ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'paypal';

BEGIN;

-- ---------------------------------------------------------------------
-- Recherches récentes : une ligne par jeu de critères (dédoublonné), les 20 dernières par utilisateur
-- ---------------------------------------------------------------------
CREATE TABLE search_history (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_string TEXT    NOT NULL,            -- critères normalisés (clés triées), ex. brand_id=1&customs=dedouane
    criteria     JSONB   NOT NULL,            -- mêmes critères, structurés
    result_count INTEGER NOT NULL DEFAULT 0,  -- nombre d'annonces au moment de la recherche
    run_count    INTEGER NOT NULL DEFAULT 1,
    last_run_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, query_string)
);
CREATE INDEX search_history_user_idx ON search_history (user_id, last_run_at DESC);

-- Lien « recherche sauvegardée » (alerte) ↔ critères : même normalisation
ALTER TABLE saved_searches ADD COLUMN query_string TEXT;
CREATE UNIQUE INDEX saved_searches_user_query_uq ON saved_searches (user_id, query_string) WHERE query_string IS NOT NULL;

-- ---------------------------------------------------------------------
-- Paiements internationaux
-- Le prix de référence reste en Ariary (amount_mga). Carte et PayPal peuvent débiter
-- une autre devise : on fige le montant débité et le taux utilisé.
-- ---------------------------------------------------------------------
CREATE TYPE payment_method AS ENUM ('mobile_money', 'carte', 'paypal');

ALTER TABLE payments
    ADD COLUMN method              payment_method NOT NULL DEFAULT 'mobile_money',
    ADD COLUMN charge_currency     CHAR(3)        NOT NULL DEFAULT 'MGA',   -- ISO 4217 : MGA, EUR, USD
    ADD COLUMN charge_amount_minor BIGINT,                                  -- montant débité en unité mineure (centimes ; MGA sans décimale)
    ADD COLUMN exchange_rate       NUMERIC(12, 4),                          -- Ar pour 1 unité de charge_currency
    ADD COLUMN payer_email         VARCHAR(255),                            -- compte PayPal / reçu Stripe
    ADD COLUMN checkout_session_id VARCHAR(255),                            -- Stripe Checkout Session / PayPal Order ID
    ADD COLUMN checkout_url        TEXT,                                    -- page hébergée où l'utilisateur paie
    ADD COLUMN card_brand          VARCHAR(20),                             -- visa, mastercard… (jamais le numéro)
    ADD COLUMN card_last4          CHAR(4);

-- Le numéro Mobile Money n'existe que pour le Mobile Money
ALTER TABLE payments ALTER COLUMN payer_msisdn DROP NOT NULL;
ALTER TABLE payments ADD CONSTRAINT payments_msisdn_for_mobile_money
    CHECK (method <> 'mobile_money' OR payer_msisdn IS NOT NULL);

CREATE UNIQUE INDEX payments_checkout_session_uq ON payments (checkout_session_id) WHERE checkout_session_id IS NOT NULL;

COMMIT;
