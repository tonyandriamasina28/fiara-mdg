-- =====================================================================
-- fiara.mdg — migration 004
--  * Coordonnées GPS des villes et des sites pro (carte « Localisation du vendeur »)
--  * Vérification d'identité par passeport (badge « Vendeur vérifié »)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Localisation : centre-ville approximatif. Les particuliers sont affichés au centre
-- de leur ville (jamais à leur adresse) ; les pros peuvent épingler leur showroom.
-- ---------------------------------------------------------------------
ALTER TABLE cities ADD COLUMN latitude NUMERIC(9, 6), ADD COLUMN longitude NUMERIC(9, 6);
ALTER TABLE dealer_sites ADD COLUMN latitude NUMERIC(9, 6), ADD COLUMN longitude NUMERIC(9, 6);

UPDATE cities c SET latitude = v.lat, longitude = v.lng
FROM (VALUES
    ('Antananarivo', -18.8792, 47.5079), ('Antsirabe', -19.8659, 47.0333), ('Ambatolampy', -19.3833, 47.4167),
    ('Miarinarivo', -18.9500, 46.9000), ('Mahajanga', -15.7167, 46.3167), ('Marovoay', -16.1000, 46.6333),
    ('Maintirano', -18.0667, 44.0167), ('Toamasina', -18.1492, 49.4023), ('Moramanga', -18.9333, 48.2000),
    ('Ambatondrazaka', -17.8333, 48.4167), ('Fenoarivo Atsinanana', -17.3814, 49.4092), ('Antsiranana', -12.2787, 49.2917),
    ('Nosy Be', -13.4000, 48.2667), ('Ambanja', -13.6833, 48.4500), ('Sambava', -14.2667, 50.1667),
    ('Fianarantsoa', -21.4536, 47.0858), ('Ambositra', -20.5167, 47.2500), ('Manakara', -22.1500, 48.0000),
    ('Toliara', -23.3500, 43.6667), ('Morondava', -20.2833, 44.2833), ('Taolagnaro', -25.0319, 46.9831)
) AS v(name, lat, lng)
WHERE c.name = v.name;

-- ---------------------------------------------------------------------
-- Vérification d'identité
-- Le document n'est jamais stocké en clair ni dans un dossier public : fichier chiffré
-- (AES-256-GCM) hors de la racine web, clé dans une variable d'environnement, fichier
-- supprimé dès la décision de l'administrateur. La base ne garde que des métadonnées.
-- ---------------------------------------------------------------------
CREATE TYPE verification_status AS ENUM ('en_attente', 'valide', 'refuse');
CREATE TYPE identity_document_type AS ENUM ('passeport', 'cin');

CREATE TABLE identity_verifications (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type       identity_document_type NOT NULL DEFAULT 'passeport',
    issuing_country     CHAR(3)      NOT NULL DEFAULT 'MDG',      -- ISO 3166-1 alpha-3
    declared_full_name  VARCHAR(160) NOT NULL,                     -- nom saisi, comparé au document par l'admin
    document_last4      VARCHAR(4),                                -- 4 derniers caractères du n° (jamais le numéro complet)
    status              verification_status NOT NULL DEFAULT 'en_attente',
    -- Fichier chiffré
    storage_key         VARCHAR(120),                              -- nom du fichier dans le dossier privé ; NULL une fois supprimé
    mime_type           VARCHAR(40)  NOT NULL,
    file_size           INTEGER      NOT NULL,
    file_sha256         CHAR(64)     NOT NULL,                     -- empreinte du fichier en clair (détection de doublons)
    encryption_iv       VARCHAR(32)  NOT NULL,                     -- base64, 12 octets
    encryption_tag      VARCHAR(32)  NOT NULL,                     -- base64, 16 octets (GCM)
    -- Décision
    rejection_reason    TEXT,
    reviewed_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    document_deleted_at TIMESTAMPTZ,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status = 'en_attente' OR reviewed_at IS NOT NULL),
    CHECK (status <> 'refuse' OR rejection_reason IS NOT NULL)
);
-- Une seule demande en attente par utilisateur
CREATE UNIQUE INDEX identity_verifications_one_pending ON identity_verifications (user_id) WHERE status = 'en_attente';
CREATE INDEX identity_verifications_queue_idx ON identity_verifications (status, submitted_at);
CREATE INDEX identity_verifications_sha_idx ON identity_verifications (file_sha256);

-- Dénormalisé pour afficher le badge sans jointure dans la recherche
ALTER TABLE users ADD COLUMN identity_verified_at TIMESTAMPTZ;

COMMIT;
