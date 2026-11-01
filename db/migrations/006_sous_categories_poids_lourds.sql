-- =====================================================================
-- fiara.mdg — migration 006
--  * Sous-catégories « Camion & utilitaires » (grille du moteur de recherche) :
--      camion (> 7,5 t), utilitaire (fourgons et camions ≤ 7,5 t), bus, et les nouvelles valeurs ci-dessous
--  * Modèles complémentaires Audi (A1–A7, Q2–Q7), BMW (Séries 1–5, X1–X5), Mercedes-Benz (Classes A–E, GLA–GLE)
-- Les données utilisant ces valeurs sont dans 007 (une valeur d'enum ne peut pas servir dans la transaction qui l'ajoute).
-- La valeur « velo_electrique » reste dans l'enum (une valeur d'enum ne se supprime pas) mais n'est plus proposée.
-- =====================================================================

ALTER TYPE vehicle_category ADD VALUE IF NOT EXISTS 'remorque';
ALTER TYPE vehicle_category ADD VALUE IF NOT EXISTS 'tracteur_routier';
ALTER TYPE vehicle_category ADD VALUE IF NOT EXISTS 'semi_remorque';
ALTER TYPE vehicle_category ADD VALUE IF NOT EXISTS 'agricole';
ALTER TYPE vehicle_category ADD VALUE IF NOT EXISTS 'engin_chantier';
ALTER TYPE vehicle_category ADD VALUE IF NOT EXISTS 'chariot_elevateur';
