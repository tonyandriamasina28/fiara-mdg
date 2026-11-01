-- =====================================================================
-- fiara.mdg — migration 007 : modèles complémentaires et poids lourds de démonstration
-- (sépare de 006 : les nouvelles valeurs d'enum doivent être validées avant usage)
-- =====================================================================

BEGIN;

INSERT INTO models (brand_id, name, slug, category)
SELECT b.id, m.name, m.slug, m.category::vehicle_category
FROM (VALUES
    ('audi', 'A7', 'a7', 'voiture'),
    ('audi', 'Q2', 'q2', 'suv_4x4'),
    ('audi', 'Q4 e-tron', 'q4-e-tron', 'suv_4x4'),
    ('bmw', 'Série 2', 'serie-2', 'voiture'),
    ('bmw', 'Série 4', 'serie-4', 'voiture'),
    ('bmw', 'X2', 'x2', 'suv_4x4'),
    ('bmw', 'X4', 'x4', 'suv_4x4'),
    ('mercedes-benz', 'Classe B', 'classe-b', 'voiture'),
    ('mercedes-benz', 'GLB', 'glb', 'suv_4x4'),
    -- Poids lourds de démonstration pour la grille de sous-catégories
    ('mercedes-benz', 'Actros', 'actros', 'tracteur_routier'),
    ('mercedes-benz', 'Atego', 'atego', 'camion'),
    ('isuzu', 'N-Series', 'n-series', 'utilitaire'),
    ('toyota', 'Coaster', 'coaster', 'bus')
) AS m(brand_slug, name, slug, category)
JOIN brands b ON b.slug = m.brand_slug
ON CONFLICT (brand_id, slug) DO NOTHING;

COMMIT;
