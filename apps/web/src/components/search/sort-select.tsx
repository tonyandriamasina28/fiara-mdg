'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDict } from '@/i18n/client';
import { SORTS } from '@/lib/format';

export function SortSelect() {
  const t = useDict();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      <span className="shrink-0 font-semibold">{t.results.sortBy}</span>
      <select
        className="field h-10 w-auto"
        value={params.get('sort') ?? 'pertinence'}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set('sort', e.target.value);
          next.delete('page');
          router.push(`${pathname}?${next.toString()}`, { scroll: false });
        }}
      >
        {SORTS.map((v) => <option key={v} value={v}>{t.labels.sort[v]}</option>)}
      </select>
    </label>
  );
}
