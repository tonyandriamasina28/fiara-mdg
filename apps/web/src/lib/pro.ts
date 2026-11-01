export const TOOLS = ['analyse_demande', 'comparaison_marche', 'lead_manager', 'offre_directe', 'controle_qualite'] as const;
export type ProTool = (typeof TOOLS)[number];
export type ToolAccess = { access: 'limite' | 'complet'; monthly_quota: number | null };

export interface Plan {
  code: string;
  tier: number;
  name: string;
  tagline: string;
  price_mga: number | null;
  quote_only: boolean;
  max_active_ads: number;
  max_sales_contacts: number;
  visibility_level: number;
  multi_site: boolean;
  exclusive_recommendations: boolean;
  tools: Partial<Record<ProTool, ToolAccess>>;
}

export interface ProContext {
  dealerId: number;
  role: 'proprietaire' | 'gestionnaire' | 'commercial';
  subscription: {
    id: number;
    plan_code: string;
    plan_name: string;
    ends_at: string;
    max_active_ads: number;
    max_sales_contacts: number;
    visibility_level: number;
    multi_site: boolean;
  } | null;
  tools: Partial<Record<ProTool, ToolAccess>>;
  company: { company_name: string; is_verified: boolean };
  usage: { active_ads: number; team: number; sites: number; offers_this_month: number; new_leads: number };
}

/** Première formule (par niveau) qui inclut l'outil — pour le message « disponible à partir de ». */
export function firstPlanWith(plans: Plan[], tool: ProTool, full = false) {
  return plans.find((p) => p.tools[tool] && (!full || p.tools[tool]!.access === 'complet'));
}
