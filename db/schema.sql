-- =====================================================================
-- fiara.mdg — schéma relationnel PostgreSQL (>= 13)
-- Place de marché automobile pour Madagascar.
-- Montants : Ariary (MGA), stockés en BIGINT (pas de sous-unité utilisée).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('particulier', 'professionnel', 'admin');
CREATE TYPE vehicle_category AS ENUM ('voiture', 'suv_4x4', 'pickup', 'utilitaire', 'camion', 'moto', 'bus');
CREATE TYPE body_type        AS ENUM ('berline', 'citadine', 'break', 'monospace', 'suv', 'coupe', 'cabriolet', 'pickup', 'fourgon', 'autre');
CREATE TYPE fuel_type        AS ENUM ('essence', 'diesel', 'hybride', 'electrique', 'gpl');
CREATE TYPE gearbox_type     AS ENUM ('manuelle', 'automatique');
CREATE TYPE drive_type       AS ENUM ('2x4', '4x4', 'awd');
CREATE TYPE vehicle_condition AS ENUM ('neuf', 'occasion', 'accidente');
-- Provenance : occasion déjà roulée à Madagascar vs importée
CREATE TYPE vehicle_origin   AS ENUM ('occasion_madagascar', 'import_europe', 'import_asie', 'import_autre');
CREATE TYPE customs_status   AS ENUM ('dedouane', 'non_dedouane', 'en_cours');
CREATE TYPE ad_status        AS ENUM ('brouillon', 'en_attente', 'active', 'suspendue', 'vendue', 'expiree', 'supprimee');
CREATE TYPE payment_provider AS ENUM ('mvola', 'orange_money', 'airtel_money');
CREATE TYPE payment_status   AS ENUM ('initie', 'en_attente', 'reussi', 'echoue', 'annule', 'rembourse');
CREATE TYPE sponsorship_status AS ENUM ('en_attente_paiement', 'active', 'terminee', 'annulee');

-- ---------------------------------------------------------------------
-- Géographie : 6 anciennes provinces + grandes villes
-- ---------------------------------------------------------------------
CREATE TABLE provinces (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code        VARCHAR(8)  NOT NULL UNIQUE,          -- ex. TNR, MJN
    name        VARCHAR(80) NOT NULL UNIQUE,          -- nom officiel (Mahajanga)
    common_name VARCHAR(80)                           -- nom d'usage (Majunga)
);

CREATE TABLE cities (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    province_id SMALLINT    NOT NULL REFERENCES provinces(id),
    name        VARCHAR(80) NOT NULL,
    common_name VARCHAR(80),
    is_capital  BOOLEAN     NOT NULL DEFAULT FALSE,   -- chef-lieu de province
    UNIQUE (province_id, name)
);

-- ---------------------------------------------------------------------
-- Utilisateurs (particuliers et professionnels)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role    NOT NULL DEFAULT 'particulier',
    first_name      VARCHAR(80)  NOT NULL,
    last_name       VARCHAR(80)  NOT NULL,
    phone           VARCHAR(20),                       -- format E.164 : +261 34 12 345 67
    phone_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    city_id         INTEGER      REFERENCES cities(id),
    avatar_url      TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

-- Informations complémentaires des vendeurs professionnels (garages, concessionnaires)
CREATE TABLE dealer_profiles (
    user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_name  VARCHAR(160) NOT NULL,
    nif           VARCHAR(20),                         -- Numéro d'Identification Fiscale
    stat          VARCHAR(30),                         -- numéro statistique
    address       TEXT,
    city_id       INTEGER REFERENCES cities(id),
    website       TEXT,
    logo_url      TEXT,
    description   TEXT,
    opening_hours JSONB,
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Référentiel véhicules
-- ---------------------------------------------------------------------
CREATE TABLE brands (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       VARCHAR(60) NOT NULL UNIQUE,
    slug       VARCHAR(60) NOT NULL UNIQUE,
    is_popular BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE models (
    id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brand_id INTEGER     NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name     VARCHAR(80) NOT NULL,
    slug     VARCHAR(80) NOT NULL,
    category vehicle_category NOT NULL DEFAULT 'voiture',
    UNIQUE (brand_id, slug)
);

CREATE TABLE equipment (
    id    SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code  VARCHAR(40) NOT NULL UNIQUE,                 -- ex. climatisation
    label VARCHAR(80) NOT NULL,
    grp   VARCHAR(40) NOT NULL                         -- confort, sécurité, multimédia, tout-terrain
);

-- Le véhicule (l'objet) est séparé de l'annonce (la mise en vente),
-- comme sur mobile.de : un véhicule peut être republié sans ressaisie.
CREATE TABLE vehicles (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id            BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_id            INTEGER NOT NULL REFERENCES brands(id),
    model_id            INTEGER NOT NULL REFERENCES models(id),
    version             VARCHAR(120),                  -- finition : "2.8 GD-6 Legender"
    category            vehicle_category  NOT NULL DEFAULT 'voiture',
    body                body_type,
    year                SMALLINT NOT NULL CHECK (year BETWEEN 1950 AND 2100),
    first_registration  DATE,
    mileage_km          INTEGER  NOT NULL CHECK (mileage_km >= 0),
    fuel                fuel_type    NOT NULL,
    gearbox             gearbox_type NOT NULL,
    drive               drive_type,
    power_hp            SMALLINT CHECK (power_hp > 0),
    engine_cc           INTEGER  CHECK (engine_cc > 0),
    doors               SMALLINT CHECK (doors BETWEEN 1 AND 6),
    seats               SMALLINT CHECK (seats BETWEEN 1 AND 60),
    exterior_color      VARCHAR(40),
    interior_color      VARCHAR(40),
    condition           vehicle_condition NOT NULL DEFAULT 'occasion',
    origin              vehicle_origin    NOT NULL,
    customs             customs_status    NOT NULL,
    previous_owners     SMALLINT CHECK (previous_owners >= 0),
    has_service_history BOOLEAN,
    vin                 VARCHAR(17),
    registration_plate  VARCHAR(20),                   -- non affichée publiquement
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_brand_model_idx ON vehicles (brand_id, model_id);
CREATE INDEX vehicles_owner_idx       ON vehicles (owner_id);

CREATE TABLE vehicle_equipment (
    vehicle_id   BIGINT   NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    equipment_id SMALLINT NOT NULL REFERENCES equipment(id),
    PRIMARY KEY (vehicle_id, equipment_id)
);

-- ---------------------------------------------------------------------
-- Annonces
-- ---------------------------------------------------------------------
CREATE TABLE ads (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id       BIGINT  NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    seller_id        BIGINT  NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    title            VARCHAR(140) NOT NULL,
    description      TEXT,
    price_mga        BIGINT  NOT NULL CHECK (price_mga > 0),
    price_negotiable BOOLEAN NOT NULL DEFAULT FALSE,
    city_id          INTEGER NOT NULL REFERENCES cities(id),
    status           ad_status NOT NULL DEFAULT 'en_attente',
    show_phone       BOOLEAN NOT NULL DEFAULT TRUE,
    contact_phone    VARCHAR(20),                      -- si différent du téléphone du compte
    whatsapp         BOOLEAN NOT NULL DEFAULT FALSE,
    views_count      INTEGER NOT NULL DEFAULT 0,
    sponsored_until  TIMESTAMPTZ,                      -- dénormalisé depuis ad_sponsorships pour le tri
    published_at     TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    search_vector    TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
    ) STORED
);
CREATE INDEX ads_status_published_idx ON ads (status, published_at DESC);
CREATE INDEX ads_price_idx            ON ads (price_mga) WHERE status = 'active';
CREATE INDEX ads_city_idx             ON ads (city_id)   WHERE status = 'active';
CREATE INDEX ads_seller_idx           ON ads (seller_id);
CREATE INDEX ads_sponsored_idx        ON ads (sponsored_until) WHERE sponsored_until IS NOT NULL;
CREATE INDEX ads_search_idx           ON ads USING GIN (search_vector);
CREATE INDEX vehicles_filters_idx     ON vehicles (year, mileage_km, fuel, gearbox);

CREATE TABLE ad_photos (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad_id      BIGINT   NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    url        TEXT     NOT NULL,
    position   SMALLINT NOT NULL DEFAULT 0,
    width      INTEGER,
    height     INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ad_id, position)
);

CREATE TABLE favorites (
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_id      BIGINT NOT NULL REFERENCES ads(id)   ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ad_id)
);

-- Recherches sauvegardées (alertes "nouvelles annonces")
CREATE TABLE saved_searches (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label       VARCHAR(120),
    criteria    JSONB  NOT NULL,
    notify      BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Traçage des affichages du numéro (statistiques vendeur, anti-scraping)
CREATE TABLE phone_reveals (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad_id      BIGINT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ip_hash    VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX phone_reveals_ad_idx ON phone_reveals (ad_id, created_at);

-- ---------------------------------------------------------------------
-- Messagerie acheteur <-> vendeur (une conversation par annonce et acheteur)
-- ---------------------------------------------------------------------
CREATE TABLE conversations (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad_id           BIGINT NOT NULL REFERENCES ads(id)   ON DELETE CASCADE,
    buyer_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ad_id, buyer_id),
    CHECK (buyer_id <> seller_id)
);
CREATE INDEX conversations_buyer_idx  ON conversations (buyer_id, last_message_at DESC);
CREATE INDEX conversations_seller_idx ON conversations (seller_id, last_message_at DESC);

CREATE TABLE messages (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT   NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- Annonces sponsorisées & paiements Mobile Money
-- ---------------------------------------------------------------------
CREATE TABLE sponsorship_plans (
    id            SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          VARCHAR(30)  NOT NULL UNIQUE,        -- remontee, top_annonce, vitrine
    label         VARCHAR(80)  NOT NULL,
    description   TEXT,
    duration_days SMALLINT     NOT NULL CHECK (duration_days > 0),
    price_mga     BIGINT       NOT NULL CHECK (price_mga > 0),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE payments (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            BIGINT  NOT NULL REFERENCES users(id),
    provider           payment_provider NOT NULL,
    status             payment_status   NOT NULL DEFAULT 'initie',
    amount_mga         BIGINT  NOT NULL CHECK (amount_mga > 0),
    payer_msisdn       VARCHAR(20) NOT NULL,           -- numéro Mobile Money débité
    idempotency_key    UUID    NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    provider_reference VARCHAR(120),                   -- transactionId / serverCorrelationId opérateur
    failure_reason     TEXT,
    metadata           JSONB   NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at       TIMESTAMPTZ,
    UNIQUE (provider, provider_reference)
);
CREATE INDEX payments_user_idx ON payments (user_id, created_at DESC);

-- Journal brut des callbacks opérateurs (rejouable, auditable)
CREATE TABLE payment_events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_id  BIGINT REFERENCES payments(id) ON DELETE SET NULL,
    provider    payment_provider NOT NULL,
    event_type  VARCHAR(60) NOT NULL,
    payload     JSONB       NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ad_sponsorships (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad_id      BIGINT   NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    plan_id    SMALLINT NOT NULL REFERENCES sponsorship_plans(id),
    payment_id BIGINT   REFERENCES payments(id),
    status     sponsorship_status NOT NULL DEFAULT 'en_attente_paiement',
    starts_at  TIMESTAMPTZ,
    ends_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ad_sponsorships_ad_idx ON ad_sponsorships (ad_id, status);

-- ---------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------
CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_touch    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER vehicles_touch BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER ads_touch      BEFORE UPDATE ON ads      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
