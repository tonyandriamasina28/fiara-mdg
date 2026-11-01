-- =====================================================================
-- fiara.mdg — migration 002 : abonnements professionnels et outils pro
-- Formules Bronze / Silver / Gold / Platinum, droits d'accès par outil,
-- équipes commerciales, multi-sites, CRM (leads), offres directes,
-- statistiques quotidiennes et contrôle qualité des annonces.
-- =====================================================================

BEGIN;

CREATE TYPE pro_tool AS ENUM (
    'analyse_demande',     -- Nachfrageanalyse
    'comparaison_marche',  -- Markt-Vergleich
    'lead_manager',        -- Lead Manager Pro
    'offre_directe',       -- Direkt-Angebot
    'controle_qualite'     -- Qualitäts-Check
);
CREATE TYPE tool_access         AS ENUM ('limite', 'complet');
CREATE TYPE subscription_status AS ENUM ('en_attente_paiement', 'active', 'expiree', 'annulee');
CREATE TYPE dealer_member_role  AS ENUM ('proprietaire', 'gestionnaire', 'commercial');
CREATE TYPE lead_status         AS ENUM ('nouveau', 'contacte', 'rdv', 'negociation', 'gagne', 'perdu');
CREATE TYPE lead_source         AS ENUM ('message', 'telephone', 'offre_directe', 'manuel');
CREATE TYPE payment_purpose     AS ENUM ('sponsorisation', 'abonnement');

ALTER TABLE payments ADD COLUMN purpose payment_purpose NOT NULL DEFAULT 'sponsorisation';

-- ---------------------------------------------------------------------
-- Formules d'abonnement
-- ---------------------------------------------------------------------
CREATE TABLE subscription_plans (
    id                        SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                      VARCHAR(20)  NOT NULL UNIQUE,     -- bronze, silver, gold, platinum
    tier                      SMALLINT     NOT NULL UNIQUE CHECK (tier BETWEEN 1 AND 9),
    name                      VARCHAR(40)  NOT NULL,
    tagline                   VARCHAR(80)  NOT NULL,
    price_mga                 BIGINT       CHECK (price_mga > 0),  -- prix mensuel ; NULL = sur devis
    quote_only                BOOLEAN      NOT NULL DEFAULT FALSE, -- vrai : uniquement sur devis, pas de paiement en ligne
    billing_period_days       SMALLINT     NOT NULL DEFAULT 30,
    max_active_ads            INTEGER      NOT NULL CHECK (max_active_ads > 0),
    max_sales_contacts        SMALLINT     NOT NULL DEFAULT 0,     -- interlocuteurs commerciaux
    visibility_level          SMALLINT     NOT NULL DEFAULT 0,     -- 0 standard … 3 maximale (tri des résultats)
    multi_site                BOOLEAN      NOT NULL DEFAULT FALSE,
    exclusive_recommendations BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active                 BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Droits d'accès aux outils pro ; absence de ligne = outil non inclus
CREATE TABLE plan_tool_access (
    plan_id       SMALLINT    NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    tool          pro_tool    NOT NULL,
    access        tool_access NOT NULL,
    monthly_quota INTEGER     CHECK (monthly_quota > 0),  -- NULL = illimité
    PRIMARY KEY (plan_id, tool)
);

CREATE TABLE dealer_subscriptions (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dealer_id  BIGINT   NOT NULL REFERENCES dealer_profiles(user_id) ON DELETE CASCADE,
    plan_id    SMALLINT NOT NULL REFERENCES subscription_plans(id),
    status     subscription_status NOT NULL DEFAULT 'en_attente_paiement',
    starts_at  TIMESTAMPTZ,
    ends_at    TIMESTAMPTZ,
    payment_id BIGINT REFERENCES payments(id),
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un seul abonnement actif par professionnel
CREATE UNIQUE INDEX dealer_subscriptions_one_active ON dealer_subscriptions (dealer_id) WHERE status = 'active';

-- ---------------------------------------------------------------------
-- Organisation du professionnel : sites et équipe
-- ---------------------------------------------------------------------
CREATE TABLE dealer_sites (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dealer_id  BIGINT  NOT NULL REFERENCES dealer_profiles(user_id) ON DELETE CASCADE,
    name       VARCHAR(120) NOT NULL,
    city_id    INTEGER NOT NULL REFERENCES cities(id),
    address    TEXT,
    phone      VARCHAR(20),
    is_main    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ads ADD COLUMN site_id BIGINT REFERENCES dealer_sites(id) ON DELETE SET NULL;

-- Interlocuteurs commerciaux : comptes utilisateurs rattachés au professionnel
CREATE TABLE dealer_members (
    dealer_id  BIGINT NOT NULL REFERENCES dealer_profiles(user_id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       dealer_member_role NOT NULL DEFAULT 'commercial',
    site_id    BIGINT REFERENCES dealer_sites(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (dealer_id, user_id)
);
CREATE INDEX dealer_members_user_idx ON dealer_members (user_id);

-- ---------------------------------------------------------------------
-- Lead Manager Pro (CRM)
-- ---------------------------------------------------------------------
CREATE TABLE leads (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dealer_id       BIGINT NOT NULL REFERENCES dealer_profiles(user_id) ON DELETE CASCADE,
    ad_id           BIGINT REFERENCES ads(id) ON DELETE SET NULL,
    buyer_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    conversation_id BIGINT UNIQUE REFERENCES conversations(id) ON DELETE SET NULL,
    name            VARCHAR(160) NOT NULL,
    phone           VARCHAR(20),
    email           VARCHAR(255),
    source          lead_source NOT NULL DEFAULT 'manuel',
    status          lead_status NOT NULL DEFAULT 'nouveau',
    assigned_to     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    next_action_at  TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_dealer_status_idx ON leads (dealer_id, status, updated_at DESC);
CREATE TRIGGER leads_touch BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE lead_activities (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lead_id    BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    author_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    kind       VARCHAR(20) NOT NULL CHECK (kind IN ('note', 'appel', 'email', 'rdv', 'statut', 'message')),
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lead_activities_lead_idx ON lead_activities (lead_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Offre directe aux utilisateurs ayant mis l'annonce en favori
-- ---------------------------------------------------------------------
CREATE TABLE direct_offers (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad_id              BIGINT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    dealer_id          BIGINT NOT NULL REFERENCES dealer_profiles(user_id) ON DELETE CASCADE,
    original_price_mga BIGINT NOT NULL,
    offer_price_mga    BIGINT NOT NULL,
    message            TEXT,
    expires_at         TIMESTAMPTZ NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (offer_price_mga > 0 AND offer_price_mga < original_price_mga)
);
CREATE INDEX direct_offers_dealer_idx ON direct_offers (dealer_id, created_at DESC);

CREATE TABLE direct_offer_recipients (
    offer_id        BIGINT NOT NULL REFERENCES direct_offers(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (offer_id, user_id)
);

-- ---------------------------------------------------------------------
-- Analyse de la demande : agrégats quotidiens par annonce
-- ---------------------------------------------------------------------
CREATE TABLE ad_daily_stats (
    ad_id         BIGINT  NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    day           DATE    NOT NULL,
    views         INTEGER NOT NULL DEFAULT 0,
    phone_reveals INTEGER NOT NULL DEFAULT 0,
    messages      INTEGER NOT NULL DEFAULT 0,
    favorites     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ad_id, day)
);

-- Historique du contrôle qualité (score 0-100 et recommandations)
CREATE TABLE ad_quality_reports (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad_id      BIGINT   NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    score      SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    details    JSONB    NOT NULL,
    engine     VARCHAR(20) NOT NULL DEFAULT 'regles-v1',  -- remplacé par un modèle IA plus tard
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ad_quality_reports_ad_idx ON ad_quality_reports (ad_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Données : formules et droits d'accès
-- ---------------------------------------------------------------------
INSERT INTO subscription_plans
    (code, tier, name, tagline, price_mga, quote_only, max_active_ads, max_sales_contacts, visibility_level, multi_site, exclusive_recommendations)
VALUES
    ('bronze',   1, 'Bronze',   'Essentiel',     15000,  FALSE,  5,  0, 0, FALSE, FALSE),
    ('silver',   2, 'Silver',   'Développement', 35000,  FALSE, 15,  1, 1, FALSE, FALSE),
    ('gold',     3, 'Gold',     'Professionnel', 65000,  FALSE, 30,  5, 2, FALSE, FALSE),
    -- Platinum : 120 000 Ar/mois en souscription directe ; au-delà de 60 véhicules ou de plusieurs sites, sur devis
    ('platinum', 4, 'Platinum', 'Premium',       120000, FALSE, 60, 10, 3, TRUE,  TRUE);

INSERT INTO plan_tool_access (plan_id, tool, access, monthly_quota)
SELECT p.id, a.tool::pro_tool, a.access::tool_access, a.quota
FROM (VALUES
    ('bronze',   'analyse_demande',    'limite',  NULL),
    ('bronze',   'lead_manager',       'limite',  NULL),
    ('bronze',   'offre_directe',      'limite',  3),
    ('bronze',   'controle_qualite',   'limite',  NULL),
    ('silver',   'analyse_demande',    'complet', NULL),
    ('silver',   'comparaison_marche', 'limite',  NULL),
    ('silver',   'lead_manager',       'limite',  NULL),
    ('silver',   'offre_directe',      'limite',  10),
    ('silver',   'controle_qualite',   'complet', NULL),
    ('gold',     'analyse_demande',    'complet', NULL),
    ('gold',     'comparaison_marche', 'complet', NULL),
    ('gold',     'lead_manager',       'complet', NULL),
    ('gold',     'offre_directe',      'complet', 30),
    ('gold',     'controle_qualite',   'complet', NULL),
    ('platinum', 'analyse_demande',    'complet', NULL),
    ('platinum', 'comparaison_marche', 'complet', NULL),
    ('platinum', 'lead_manager',       'complet', NULL),
    ('platinum', 'offre_directe',      'complet', NULL),
    ('platinum', 'controle_qualite',   'complet', NULL)
) AS a(plan_code, tool, access, quota)
JOIN subscription_plans p ON p.code = a.plan_code;

COMMIT;
