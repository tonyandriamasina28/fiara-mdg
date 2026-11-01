-- Données de référence fiara.mdg (provinces, villes, marques, modèles, équipements, offres)

BEGIN;

INSERT INTO provinces (code, name, common_name) VALUES
    ('TNR', 'Antananarivo', 'Tananarive'),
    ('MJN', 'Mahajanga',    'Majunga'),
    ('TMM', 'Toamasina',    'Tamatave'),
    ('DIE', 'Antsiranana',  'Diego-Suarez'),
    ('FIA', 'Fianarantsoa', NULL),
    ('TLE', 'Toliara',      'Tuléar');

INSERT INTO cities (province_id, name, common_name, is_capital)
SELECT p.id, c.name, c.common_name, c.is_capital
FROM (VALUES
    ('TNR', 'Antananarivo', 'Tana',        TRUE),
    ('TNR', 'Antsirabe',    NULL,          FALSE),
    ('TNR', 'Ambatolampy',  NULL,          FALSE),
    ('TNR', 'Miarinarivo',  NULL,          FALSE),
    ('MJN', 'Mahajanga',    'Majunga',     TRUE),
    ('MJN', 'Marovoay',     NULL,          FALSE),
    ('MJN', 'Maintirano',   NULL,          FALSE),
    ('TMM', 'Toamasina',    'Tamatave',    TRUE),
    ('TMM', 'Moramanga',    NULL,          FALSE),
    ('TMM', 'Ambatondrazaka', NULL,        FALSE),
    ('TMM', 'Fenoarivo Atsinanana', 'Fénérive-Est', FALSE),
    ('DIE', 'Antsiranana',  'Diego-Suarez', TRUE),
    ('DIE', 'Nosy Be',      NULL,          FALSE),
    ('DIE', 'Ambanja',      NULL,          FALSE),
    ('DIE', 'Sambava',      NULL,          FALSE),
    ('FIA', 'Fianarantsoa', NULL,          TRUE),
    ('FIA', 'Ambositra',    NULL,          FALSE),
    ('FIA', 'Manakara',     NULL,          FALSE),
    ('TLE', 'Toliara',      'Tuléar',      TRUE),
    ('TLE', 'Morondava',    NULL,          FALSE),
    ('TLE', 'Taolagnaro',   'Fort-Dauphin', FALSE)
) AS c(code, name, common_name, is_capital)
JOIN provinces p ON p.code = c.code;

INSERT INTO brands (name, slug, is_popular) VALUES
    ('Toyota', 'toyota', TRUE), ('Nissan', 'nissan', TRUE), ('Mitsubishi', 'mitsubishi', TRUE),
    ('Hyundai', 'hyundai', TRUE), ('Kia', 'kia', TRUE), ('Peugeot', 'peugeot', TRUE),
    ('Renault', 'renault', TRUE), ('Suzuki', 'suzuki', TRUE), ('Isuzu', 'isuzu', TRUE),
    ('Ford', 'ford', FALSE), ('Mazda', 'mazda', FALSE), ('Honda', 'honda', FALSE),
    ('Volkswagen', 'volkswagen', FALSE), ('Mercedes-Benz', 'mercedes-benz', FALSE),
    ('Land Rover', 'land-rover', FALSE), ('Citroën', 'citroen', FALSE), ('Dacia', 'dacia', FALSE),
    ('Chevrolet', 'chevrolet', FALSE), ('Yamaha', 'yamaha', FALSE), ('Sinotruk', 'sinotruk', FALSE);

INSERT INTO models (brand_id, name, slug, category)
SELECT b.id, m.name, m.slug, m.category::vehicle_category
FROM (VALUES
    ('toyota', 'Land Cruiser', 'land-cruiser', 'suv_4x4'),
    ('toyota', 'Land Cruiser Prado', 'land-cruiser-prado', 'suv_4x4'),
    ('toyota', 'Hilux', 'hilux', 'pickup'),
    ('toyota', 'RAV4', 'rav4', 'suv_4x4'),
    ('toyota', 'Corolla', 'corolla', 'voiture'),
    ('toyota', 'Yaris', 'yaris', 'voiture'),
    ('toyota', 'HiAce', 'hiace', 'bus'),
    ('toyota', 'Fortuner', 'fortuner', 'suv_4x4'),
    ('nissan', 'Patrol', 'patrol', 'suv_4x4'),
    ('nissan', 'Navara', 'navara', 'pickup'),
    ('nissan', 'X-Trail', 'x-trail', 'suv_4x4'),
    ('nissan', 'Sunny', 'sunny', 'voiture'),
    ('mitsubishi', 'Pajero', 'pajero', 'suv_4x4'),
    ('mitsubishi', 'L200', 'l200', 'pickup'),
    ('mitsubishi', 'Outlander', 'outlander', 'suv_4x4'),
    ('hyundai', 'Tucson', 'tucson', 'suv_4x4'),
    ('hyundai', 'Santa Fe', 'santa-fe', 'suv_4x4'),
    ('hyundai', 'i10', 'i10', 'voiture'),
    ('hyundai', 'H-1', 'h-1', 'utilitaire'),
    ('kia', 'Sportage', 'sportage', 'suv_4x4'),
    ('kia', 'Picanto', 'picanto', 'voiture'),
    ('kia', 'Sorento', 'sorento', 'suv_4x4'),
    ('peugeot', '208', '208', 'voiture'),
    ('peugeot', '301', '301', 'voiture'),
    ('peugeot', '3008', '3008', 'suv_4x4'),
    ('peugeot', 'Partner', 'partner', 'utilitaire'),
    ('peugeot', 'Boxer', 'boxer', 'utilitaire'),
    ('renault', 'Clio', 'clio', 'voiture'),
    ('renault', 'Duster', 'duster', 'suv_4x4'),
    ('renault', 'Kangoo', 'kangoo', 'utilitaire'),
    ('renault', 'Master', 'master', 'utilitaire'),
    ('suzuki', 'Swift', 'swift', 'voiture'),
    ('suzuki', 'Jimny', 'jimny', 'suv_4x4'),
    ('suzuki', 'Vitara', 'vitara', 'suv_4x4'),
    ('isuzu', 'D-Max', 'd-max', 'pickup'),
    ('isuzu', 'NPR', 'npr', 'camion'),
    ('ford', 'Ranger', 'ranger', 'pickup'),
    ('ford', 'Everest', 'everest', 'suv_4x4'),
    ('mazda', 'BT-50', 'bt-50', 'pickup'),
    ('mazda', 'CX-5', 'cx-5', 'suv_4x4'),
    ('honda', 'CR-V', 'cr-v', 'suv_4x4'),
    ('honda', 'Civic', 'civic', 'voiture'),
    ('volkswagen', 'Amarok', 'amarok', 'pickup'),
    ('volkswagen', 'Golf', 'golf', 'voiture'),
    ('mercedes-benz', 'Classe C', 'classe-c', 'voiture'),
    ('mercedes-benz', 'Sprinter', 'sprinter', 'utilitaire'),
    ('mercedes-benz', 'Classe G', 'classe-g', 'suv_4x4'),
    ('land-rover', 'Defender', 'defender', 'suv_4x4'),
    ('land-rover', 'Range Rover', 'range-rover', 'suv_4x4'),
    ('citroen', 'C3', 'c3', 'voiture'),
    ('citroen', 'Berlingo', 'berlingo', 'utilitaire'),
    ('dacia', 'Sandero', 'sandero', 'voiture'),
    ('dacia', 'Duster', 'duster', 'suv_4x4'),
    ('chevrolet', 'Captiva', 'captiva', 'suv_4x4'),
    ('yamaha', 'DT 125', 'dt-125', 'moto'),
    ('yamaha', 'Crypton', 'crypton', 'moto'),
    ('sinotruk', 'Howo', 'howo', 'camion')
) AS m(brand_slug, name, slug, category)
JOIN brands b ON b.slug = m.brand_slug;

INSERT INTO equipment (code, label, grp) VALUES
    ('climatisation', 'Climatisation', 'confort'),
    ('vitres_electriques', 'Vitres électriques', 'confort'),
    ('sieges_cuir', 'Sièges cuir', 'confort'),
    ('regulateur', 'Régulateur de vitesse', 'confort'),
    ('abs', 'ABS', 'sécurité'),
    ('airbags', 'Airbags', 'sécurité'),
    ('camera_recul', 'Caméra de recul', 'sécurité'),
    ('alarme', 'Alarme / antivol', 'sécurité'),
    ('gps', 'GPS', 'multimédia'),
    ('bluetooth', 'Bluetooth', 'multimédia'),
    ('ecran_tactile', 'Écran tactile', 'multimédia'),
    ('blocage_differentiel', 'Blocage de différentiel', 'tout-terrain'),
    ('treuil', 'Treuil', 'tout-terrain'),
    ('snorkel', 'Snorkel', 'tout-terrain'),
    ('galerie', 'Galerie de toit', 'tout-terrain'),
    ('attelage', 'Attelage', 'tout-terrain');

INSERT INTO sponsorship_plans (code, label, description, duration_days, price_mga) VALUES
    ('remontee',    'Remontée',    'L''annonce repasse en tête des résultats une fois par jour.', 7,  15000),
    ('top_annonce', 'Top annonce', 'Placée au-dessus des résultats correspondants, avec badge.',  14, 45000),
    ('vitrine',     'Vitrine',     'Mise en avant sur la page d''accueil et en tête des résultats.', 30, 120000);

COMMIT;
