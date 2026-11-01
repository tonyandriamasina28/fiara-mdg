-- =====================================================================
-- fiara.mdg — migration 005
--  * Catégories du sélecteur vertical : vélo électrique et camping-car
--  * Référentiel complet des marques (78 marques) et modèles de test (Audi, BMW, Mercedes-Benz)
-- =====================================================================

-- Hors transaction : une valeur d'enum ajoutée ne peut pas être utilisée dans la même transaction
ALTER TYPE vehicle_category ADD VALUE IF NOT EXISTS 'velo_electrique';
ALTER TYPE vehicle_category ADD VALUE IF NOT EXISTS 'camping_car';

BEGIN;

-- Marques : les existantes (avec leurs annonces) sont conservées, les autres ajoutées
INSERT INTO brands (name, slug) VALUES
    ('Abarth', 'abarth'),
    ('Aiways', 'aiways'),
    ('Aixam', 'aixam'),
    ('Alfa Romeo', 'alfa-romeo'),
    ('Alpina', 'alpina'),
    ('Alpine', 'alpine'),
    ('Aston Martin', 'aston-martin'),
    ('Audi', 'audi'),
    ('BAIC', 'baic'),
    ('BAW', 'baw'),
    ('Bentley', 'bentley'),
    ('BMW', 'bmw'),
    ('Borgward', 'borgward'),
    ('Bugatti', 'bugatti'),
    ('BYD', 'byd'),
    ('Cadillac', 'cadillac'),
    ('Chevrolet', 'chevrolet'),
    ('Chrysler', 'chrysler'),
    ('Citroën', 'citroen'),
    ('Cupra', 'cupra'),
    ('Dacia', 'dacia'),
    ('DFSK', 'dfsk'),
    ('Dodge', 'dodge'),
    ('DS Automobiles', 'ds-automobiles'),
    ('Ferrari', 'ferrari'),
    ('Fiat', 'fiat'),
    ('Ford', 'ford'),
    ('GWM', 'gwm'),
    ('Honda', 'honda'),
    ('Hongqi', 'hongqi'),
    ('Hyundai', 'hyundai'),
    ('Infiniti', 'infiniti'),
    ('Isuzu', 'isuzu'),
    ('Jaguar', 'jaguar'),
    ('Jeep', 'jeep'),
    ('KGM', 'kgm'),
    ('Kia', 'kia'),
    ('Lada', 'lada'),
    ('Lamborghini', 'lamborghini'),
    ('Lancia', 'lancia'),
    ('Land Rover', 'land-rover'),
    ('Leapmotor', 'leapmotor'),
    ('Lexus', 'lexus'),
    ('Lotus', 'lotus'),
    ('Lynk & Co', 'lynk-co'),
    ('Maserati', 'maserati'),
    ('Mazda', 'mazda'),
    ('McLaren', 'mclaren'),
    ('Mercedes-Benz', 'mercedes-benz'),
    ('MG', 'mg'),
    ('Mini', 'mini'),
    ('Mitsubishi', 'mitsubishi'),
    ('NIO', 'nio'),
    ('Nissan', 'nissan'),
    ('Opel', 'opel'),
    ('ORA', 'ora'),
    ('Peugeot', 'peugeot'),
    ('Polestar', 'polestar'),
    ('Porsche', 'porsche'),
    ('Renault', 'renault'),
    ('Rolls-Royce', 'rolls-royce'),
    ('Saab', 'saab'),
    ('SEAT', 'seat'),
    ('SERES', 'seres'),
    ('Silence', 'silence'),
    ('Škoda', 'skoda'),
    ('Smart', 'smart'),
    ('SsangYong', 'ssangyong'),
    ('Subaru', 'subaru'),
    ('Suzuki', 'suzuki'),
    ('Tesla', 'tesla'),
    ('Toyota', 'toyota'),
    ('VinFast', 'vinfast'),
    ('Volvo', 'volvo'),
    ('Volkswagen', 'volkswagen'),
    ('WEY', 'wey'),
    ('XEV', 'xev'),
    ('XPENG', 'xpeng')
ON CONFLICT (slug) DO NOTHING;

-- Marques mises en avant dans la liste « Les plus recherchées »
UPDATE brands SET is_popular = TRUE WHERE slug IN ('audi', 'bmw', 'mercedes-benz', 'volkswagen');

-- Modèles de test : dépendance Marque > Modèle (models.brand_id)
INSERT INTO models (brand_id, name, slug, category)
SELECT b.id, m.name, m.slug, m.category::vehicle_category
FROM (VALUES
    ('audi', 'A1', 'a1', 'voiture'),
    ('audi', 'A3', 'a3', 'voiture'),
    ('audi', 'A4', 'a4', 'voiture'),
    ('audi', 'A5', 'a5', 'voiture'),
    ('audi', 'A6', 'a6', 'voiture'),
    ('audi', 'Q3', 'q3', 'suv_4x4'),
    ('audi', 'Q5', 'q5', 'suv_4x4'),
    ('audi', 'Q7', 'q7', 'suv_4x4'),
    ('bmw', 'Série 1', 'serie-1', 'voiture'),
    ('bmw', 'Série 3', 'serie-3', 'voiture'),
    ('bmw', 'Série 5', 'serie-5', 'voiture'),
    ('bmw', 'X1', 'x1', 'suv_4x4'),
    ('bmw', 'X3', 'x3', 'suv_4x4'),
    ('bmw', 'X5', 'x5', 'suv_4x4'),
    ('mercedes-benz', 'Classe A', 'classe-a', 'voiture'),
    ('mercedes-benz', 'Classe C', 'classe-c', 'voiture'),
    ('mercedes-benz', 'Classe E', 'classe-e', 'voiture'),
    ('mercedes-benz', 'GLA', 'gla', 'suv_4x4'),
    ('mercedes-benz', 'GLC', 'glc', 'suv_4x4'),
    ('mercedes-benz', 'GLE', 'gle', 'suv_4x4')
) AS m(brand_slug, name, slug, category)
JOIN brands b ON b.slug = m.brand_slug
ON CONFLICT (brand_id, slug) DO NOTHING;

COMMIT;
