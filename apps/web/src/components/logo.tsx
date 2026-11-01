/** Logotype : toujours « fiara.mdg », en minuscules. */
export function Logo({ className = '', inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={`font-extrabold lowercase tracking-tight ${inverted ? 'text-white' : 'text-brand-ink dark:text-ink'} ${className}`}>
      fiara<span className={inverted ? 'text-action' : 'text-action-ink dark:text-action'}>.mdg</span>
    </span>
  );
}
