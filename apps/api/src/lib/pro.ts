import type { NextFunction, Request, Response } from 'express';
import { db } from '../db.js';
import { HttpError } from './http.js';

export type ProTool = 'analyse_demande' | 'comparaison_marche' | 'lead_manager' | 'offre_directe' | 'controle_qualite';
export type ToolAccess = 'limite' | 'complet';

export interface DealerContext {
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
    exclusive_recommendations: boolean;
  } | null;
  tools: Partial<Record<ProTool, { access: ToolAccess; monthly_quota: number | null }>>;
}

declare global {
  namespace Express {
    interface Request {
      dealer?: DealerContext;
    }
  }
}

/**
 * Contexte professionnel de l'utilisateur : soit il est le titulaire du compte pro,
 * soit il est membre de l'équipe (interlocuteur commercial) d'un professionnel.
 */
export async function getDealerContext(userId: number): Promise<DealerContext | null> {
  const membership = await db.one<{ dealer_id: number; role: DealerContext['role'] }>(
    `SELECT d.user_id AS dealer_id, 'proprietaire'::text AS role FROM dealer_profiles d WHERE d.user_id = $1
     UNION ALL
     SELECT m.dealer_id, m.role::text FROM dealer_members m WHERE m.user_id = $1 AND m.dealer_id <> $1
     LIMIT 1`,
    [userId],
  );
  if (!membership) return null;

  const subscription = (await db.one<NonNullable<DealerContext['subscription']>>(
    `SELECT s.id, p.code AS plan_code, p.name AS plan_name, s.ends_at, p.max_active_ads, p.max_sales_contacts,
            p.visibility_level, p.multi_site, p.exclusive_recommendations
       FROM dealer_subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.dealer_id = $1 AND s.status = 'active' AND s.ends_at > now()`,
    [membership.dealer_id],
  )) ?? null;

  const tools: DealerContext['tools'] = {};
  if (subscription) {
    const rows = await db.query<{ tool: ProTool; access: ToolAccess; monthly_quota: number | null }>(
      `SELECT a.tool, a.access, a.monthly_quota FROM plan_tool_access a
         JOIN subscription_plans p ON p.id = a.plan_id WHERE p.code = $1`,
      [subscription.plan_code],
    );
    for (const r of rows) tools[r.tool] = { access: r.access, monthly_quota: r.monthly_quota };
  }

  return { dealerId: membership.dealer_id, role: membership.role, subscription, tools };
}

/** Exige un compte professionnel (ou membre d'équipe) ; ne vérifie pas l'abonnement. */
export async function requireDealer(req: Request, _res: Response, next: NextFunction) {
  const ctx = await getDealerContext(req.user!.id);
  if (!ctx) throw new HttpError(403, 'Espace réservé aux professionnels');
  req.dealer = ctx;
  next();
}

/** Exige que la formule active inclue l'outil demandé. */
export function requireTool(tool: ProTool) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const ctx = req.dealer!;
    if (!ctx.subscription) throw new HttpError(402, 'Aucun abonnement actif : choisissez une formule pour accéder aux outils pro');
    if (!ctx.tools[tool]) {
      throw new HttpError(403, `Cet outil n'est pas inclus dans la formule ${ctx.subscription.plan_name}`, { upgrade: true, tool });
    }
    next();
  };
}

export const hasFullAccess = (req: Request, tool: ProTool) => req.dealer?.tools[tool]?.access === 'complet';
