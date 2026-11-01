import Link from 'next/link';
import { getDict } from '@/i18n/server';
import { Logo } from './logo';

export async function SiteFooter() {
  const t = await getDict();
  const columns = [
    {
      title: t.footer.buy,
      links: [
        { href: '/recherche', label: t.footer.allAds },
        { href: '/recherche?customs=dedouane', label: t.footer.cleared },
        { href: '/recherche?origin=import_asie,import_europe', label: t.footer.imports },
        { href: '/recherche?seller_type=professionnel', label: t.footer.dealerAds },
      ],
    },
    {
      title: t.footer.sell,
      links: [
        { href: '/vendre', label: t.footer.postAd },
        { href: '/pro', label: t.footer.proSpace },
        { href: '/pro/tarifs', label: t.footer.pricing },
      ],
    },
    {
      title: t.footer.regions,
      links: [
        { href: '/recherche?province_id=1', label: 'Antananarivo' },
        { href: '/recherche?province_id=3', label: 'Toamasina' },
        { href: '/recherche?province_id=2', label: 'Mahajanga' },
        { href: '/recherche?province_id=4', label: 'Antsiranana' },
        { href: '/recherche?province_id=5', label: 'Fianarantsoa' },
        { href: '/recherche?province_id=6', label: 'Toliara' },
      ],
    },
  ];

  return (
    <footer className="mt-20 bg-brand-deep text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <Logo inverted className="text-lg" />
          <p className="mt-3 max-w-xs text-sm leading-relaxed">{t.footer.tagline}</p>
          <p className="mt-4 text-sm">{t.footer.payments}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-bold text-white">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/60 sm:px-6">© {new Date().getFullYear()} fiara.mdg</p>
      </div>
    </footer>
  );
}
