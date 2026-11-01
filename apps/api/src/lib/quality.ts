/**
 * Contrôle qualité d'une annonce (version à règles).
 * L'interface (score + critères + recommandations) est celle que renverra le futur moteur IA :
 * seul `engine` changera.
 */
export interface QualityInput {
  title: string;
  description: string | null;
  photo_count: number;
  equipment_count: number;
  version: string | null;
  power_hp: number | null;
  exterior_color: string | null;
  previous_owners: number | null;
  price_mga: number;
  market_median: number | null;
}

export interface QualityCheck {
  code: string;
  label: string;
  weight: number;
  passed: boolean;
  advice: string;
}

export function evaluateQuality(ad: QualityInput) {
  const descLength = ad.description?.trim().length ?? 0;
  const checks: QualityCheck[] = [
    { code: 'photos_min', label: 'Au moins 8 photos', weight: 25, passed: ad.photo_count >= 8,
      advice: `Ajoutez ${Math.max(0, 8 - ad.photo_count)} photo(s) : avant, arrière, profils, intérieur, compteur, moteur. Les annonces avec 8 photos ou plus reçoivent bien plus de contacts.` },
    { code: 'photos_any', label: 'Une photo de couverture', weight: 15, passed: ad.photo_count >= 1,
      advice: 'Une annonce sans photo est rarement ouverte. Prenez la photo de couverture de trois quarts avant, en plein jour.' },
    { code: 'description', label: 'Description détaillée (300 caractères et plus)', weight: 20, passed: descLength >= 300,
      advice: 'Décrivez l\'historique (import, date d\'arrivée à Madagascar), l\'entretien, l\'état des pneus et les éventuels défauts.' },
    { code: 'equipment', label: 'Au moins 4 équipements renseignés', weight: 10, passed: ad.equipment_count >= 4,
      advice: 'Cochez les équipements (climatisation, 4x4, caméra…) : ils servent aussi de filtres aux acheteurs.' },
    { code: 'version', label: 'Version / finition précisée', weight: 10, passed: Boolean(ad.version),
      advice: 'Indiquez la finition exacte (ex. « 2.8 GD-6 Legender ») pour être comparé aux bons véhicules.' },
    { code: 'technical', label: 'Puissance, couleur et nombre de propriétaires', weight: 10,
      passed: Boolean(ad.power_hp && ad.exterior_color && ad.previous_owners != null),
      advice: 'Complétez la puissance, la couleur et le nombre de propriétaires précédents.' },
    { code: 'price', label: 'Prix cohérent avec le marché', weight: 10,
      passed: ad.market_median == null || Math.abs(ad.price_mga - ad.market_median) / ad.market_median <= 0.15,
      advice: 'Votre prix s\'écarte de plus de 15 % du prix médian des véhicules comparables. Consultez la comparaison du marché.' },
  ];

  const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  return {
    score,
    grade: score >= 80 ? 'excellente' : score >= 55 ? 'bonne' : 'a_ameliorer',
    checks,
    recommendations: checks.filter((c) => !c.passed).sort((a, b) => b.weight - a.weight).map(({ code, advice }) => ({ code, advice })),
    engine: 'regles-v1',
  };
}
