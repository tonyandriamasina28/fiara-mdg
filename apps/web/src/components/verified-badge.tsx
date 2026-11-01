import { BadgeCheck } from 'lucide-react';
import type { Dict } from '@/i18n';

/** Badge bleu « Vendeur vérifié » : identité contrôlée par un administrateur (passeport). */
export function VerifiedBadge({ t, compact = false, className = '' }: { t: Dict; compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <span title={t.ad.verifiedSellerHint} className={`inline-flex items-center text-brand-ink ${className}`}>
        <BadgeCheck className="size-4" aria-hidden />
        <span className="sr-only">{t.ad.verifiedSeller}</span>
      </span>
    );
  }
  return (
    <span
      title={t.ad.verifiedSellerHint}
      className={`inline-flex items-center gap-1 rounded-md border border-brand/60 bg-brand-tint px-2 py-0.5 text-xs font-bold text-brand-ink ${className}`}
    >
      <BadgeCheck className="size-4" aria-hidden /> {t.ad.verifiedSeller}
    </span>
  );
}
