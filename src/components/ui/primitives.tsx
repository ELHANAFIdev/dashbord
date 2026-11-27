'use client';
import Link from 'next/link';
import { CircleAlert, RotateCw } from 'lucide-react';
import { Children, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { RpcState } from '@/client/rpc';
import { CATEGORY_INFO, catColor, catInk } from '@/lib/constants';
import type { Category } from '@/lib/types';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ------------------------------------------------------------------ mise en page
export function PageHeader({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-[72ch] text-[14px] text-ink-2">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  as: As = 'section',
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <As className={cx('min-w-0 rounded-[10px] border border-line bg-surface shadow-card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3 md:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx('p-4 md:p-5', bodyClassName)}>{children}</div>
    </As>
  );
}

// ------------------------------------------------------------------ états
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={cx('skeleton', className)} style={style} />;
}

export function SkeletonBlock({ rows = 4, height = 18 }: { rows?: number; height?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Chargement des données">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} style={{ height, width: `${100 - ((i * 13) % 35)}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry, compact, title = 'Données indisponibles' }: { message: string; onRetry?: () => void; compact?: boolean; title?: string }) {
  return (
    <div role="alert" className={cx('flex items-start gap-3 rounded-lg border border-crit/40 bg-crit-soft text-ink', compact ? 'p-3' : 'p-4')}>
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-crit" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 break-words text-[13px] text-ink-2">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
      {icon}
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="max-w-[56ch] text-[13px] text-ink-3">{children}</div>}
    </div>
  );
}

/** Affiche squelette, erreur (avec « Réessayer ») ou contenu selon l'état d'une lecture. */
export function DataGate<T>({
  state,
  skeleton,
  children,
}: {
  state: RpcState<T>;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (state.error) {
    const denied = state.error.status === 403;
    return <ErrorState title={denied ? 'Accès refusé' : undefined} message={state.error.message} onRetry={denied ? undefined : state.reload} />;
  }
  if (state.data === undefined) return <>{skeleton ?? <SkeletonBlock />}</>;
  return <>{children(state.data)}</>;
}

// ------------------------------------------------------------------ contrôles
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-[14px]',
        variant === 'primary' && 'bg-accent text-accent-ink hover:opacity-90',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-sunken',
        variant === 'ghost' && 'text-ink-2 hover:bg-sunken hover:text-ink',
        variant === 'danger' && 'border border-crit/50 bg-surface text-crit hover:bg-crit-soft',
        className,
      )}
    />
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1 text-[12px] font-medium text-ink-2', className)}>
      {label}
      {children}
    </label>
  );
}

export const selectClass =
  'h-9 min-w-0 rounded-md border border-line-strong bg-surface px-2.5 text-[14px] font-normal text-ink hover:border-ink-3';

export function Select({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const i = options.findIndex((x) => x.value === value);
              const next = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
              onChange(next.value);
              const group = e.currentTarget.parentElement;
              requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
            }}
            tabIndex={active ? 0 : -1}
            className={cx(
              'h-8 rounded-[5px] px-3 text-[13px] font-medium transition-colors',
              active ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-sunken hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ étiquettes
export type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info';

export function Chip({ tone = 'neutral', icon, children, className, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-5',
        tone === 'neutral' && 'border-line bg-surface-2 text-ink-2',
        tone === 'ok' && 'border-ok/30 bg-ok-soft text-ok',
        tone === 'warn' && 'border-warn/30 bg-warn-soft text-warn',
        tone === 'crit' && 'border-crit/30 bg-crit-soft text-crit',
        tone === 'info' && 'border-info/30 bg-info-soft text-info',
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function CategoryBadge({ category, size = 'md', withLabel }: { category: Category | string; size?: 'sm' | 'md' | 'lg'; withLabel?: boolean }) {
  const c = (category || 'X') as Category;
  const dim = size === 'sm' ? 'h-5 w-5 text-[11px]' : size === 'lg' ? 'h-10 w-10 text-[20px]' : 'h-6 w-6 text-[12px]';
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cx('inline-flex shrink-0 items-center justify-center rounded-[5px] font-semibold', dim)}
        style={{ background: catColor(c), color: catInk(c) }}
        aria-label={`Catégorie ${c} : ${CATEGORY_INFO[c]?.label ?? 'inconnue'}`}
        role="img"
      >
        {c}
      </span>
      {withLabel && <span className="text-[13px] text-ink-2">{CATEGORY_INFO[c]?.label}</span>}
    </span>
  );
}

/** Indicateur clé : libellé, valeur en chiffres tabulaires, détail. */
export function Kpi({
  label,
  value,
  detail,
  tone,
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  /** Rend la tuile cliquable vers l'écran qui détaille ce chiffre. */
  href?: string;
}) {
  const content = (
    <>
      <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
        {icon}
        {label}
        {href && (
          <span aria-hidden="true" className="ml-auto text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent">
            →
          </span>
        )}
      </p>
      <p
        className={cx(
          'num mt-1 text-[28px] font-semibold leading-none tracking-tight',
          tone === 'crit' ? 'text-crit' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink',
        )}
      >
        {value}
      </p>
      {detail && <p className="mt-1.5 text-[12px] leading-snug text-ink-3">{detail}</p>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="group block min-w-0 px-4 py-3.5 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent md:px-5"
    >
      {content}
    </Link>
  ) : (
    <div className="min-w-0 px-4 py-3.5 md:px-5">{content}</div>
  );
}

const BAND_COLS: Record<number, string> = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' };

export function KpiBand({ children, loading, count }: { children?: ReactNode; loading?: boolean; count?: number }) {
  const n = count ?? (Children.toArray(children).length || 5);
  return (
    <div
      className={cx(
        'grid grid-cols-2 overflow-hidden rounded-[10px] border border-line bg-surface shadow-card sm:grid-cols-3 [&>*]:border-b [&>*]:border-line lg:[&>*]:border-b-0 lg:[&>*:not(:last-child)]:border-r',
        BAND_COLS[n] ?? 'lg:grid-cols-5',
      )}
    >
      {loading
        ? Array.from({ length: n }, (_, i) => (
            <div key={i} className="px-5 py-4">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-2 h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))
        : children}
    </div>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[12px] text-ink-3">{children}</p>;
}
