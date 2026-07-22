import {
  ReactNode, HTMLAttributes, useId, useState, cloneElement, isValidElement,
  type ReactElement,
} from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, AlertTriangle, Info, CheckCircle2, XCircle, ChevronLeft, X } from 'lucide-react';
import { cn } from './util';

/* ─────────────────────────────── Card ──────────────────────────────── */
export function Card({
  className = '', hoverable = false, children, ...rest
}: HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }) {
  return (
    <div
      className={cn(
        'bg-panel border border-line rounded-xl shadow-ma-1',
        hoverable && 'transition-[border-color,box-shadow,background-color,transform] duration-200 ease-ma hover:-translate-y-0.5 hover:border-line-strong hover:shadow-ma-2 active:translate-y-0',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────── StatTile ───────────────────────────── */
export function StatTile({
  label, value, icon, tone = 'default', active, onClick, hint,
}: {
  label: string; value: ReactNode; icon?: ReactNode;
  tone?: 'default' | 'brand' | 'warn' | 'danger' | 'ok';
  active?: boolean; onClick?: () => void; hint?: string;
}) {
  const toneRing: Record<string, string> = {
    default: 'border-line hover:border-line-strong',
    brand: 'border-brand/40', warn: 'border-warn/40', danger: 'border-danger/40', ok: 'border-ok/40',
  };
  const valueColor: Record<string, string> = {
    default: 'text-fg', brand: 'text-brand', warn: 'text-warn', danger: 'text-danger', ok: 'text-ok',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cn(
        'text-left bg-panel border rounded-xl p-4 w-full transition-[border-color,box-shadow,background-color] duration-200 ease-ma hover:shadow-ma-1',
        onClick && 'cursor-pointer',
        active ? 'border-brand/50 bg-brand/[0.04]' : toneRing[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('text-2xl font-display font-semibold tabular-nums', valueColor[tone])}>{value}</p>
          <p className="text-fg-3 text-xs font-medium uppercase tracking-wider mt-1">{label}</p>
        </div>
        {icon && <span className="text-fg-3 flex-shrink-0">{icon}</span>}
      </div>
      {hint && <p className="text-fg-3 text-xs mt-2">{hint}</p>}
    </Tag>
  );
}

/* ──────────────────────────── EmptyState ───────────────────────────── */
export function EmptyState({
  icon, title, description, action, className = '',
}: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('border border-dashed border-line rounded-xl py-14 px-6 text-center', className)}>
      {icon && <div className="flex justify-center mb-4 text-fg-3">{icon}</div>}
      <p className="text-fg font-medium">{title}</p>
      {description && <p className="text-fg-3 text-sm mt-1.5 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
/** Alias legado. */
export function Empty({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return <EmptyState icon={icon} title={title} description={description} />;
}

/* ─────────────────────────────── Alert ─────────────────────────────── */
type AlertTone = 'info' | 'success' | 'warn' | 'danger';
export function Alert({
  tone = 'info', title, children, className = '', action,
}: {
  tone?: AlertTone; title?: string; children?: ReactNode; className?: string; action?: ReactNode;
}) {
  const map = {
    info: { cls: 'bg-info/10 border-info/30 text-info', Icon: Info },
    success: { cls: 'bg-ok/10 border-ok/30 text-ok', Icon: CheckCircle2 },
    warn: { cls: 'bg-warn/10 border-warn/30 text-warn', Icon: AlertTriangle },
    danger: { cls: 'bg-danger/10 border-danger/30 text-danger', Icon: XCircle },
  }[tone];
  const Icon = map.Icon;
  return (
    <div role="alert" className={cn('flex gap-3 rounded-lg border p-3.5', map.cls, className)}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-sm">{title}</p>}
        {children && <div className={cn('text-sm text-fg-2', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/* ──────────────────────────── Breadcrumbs ──────────────────────────── */
export type Crumb = { label: string; to?: string };
export function Breadcrumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Trilha de navegação" className={cn('flex items-center flex-wrap gap-1 text-xs text-fg-3', className)}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1">
            {c.to && !last ? (
              <Link to={c.to} className="hover:text-fg-2 transition-colors">{c.label}</Link>
            ) : (
              <span className={cn(last && 'text-fg-2')} aria-current={last ? 'page' : undefined}>{c.label}</span>
            )}
            {!last && <ChevronRight className="w-3 h-3 text-fg-3/60" aria-hidden />}
          </span>
        );
      })}
    </nav>
  );
}

/* ─────────────────────────────── Tabs ──────────────────────────────── */
export function Tabs<T extends string>({
  tabs, value, onChange, className = '',
}: {
  tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  const activeLayoutId = useId();
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel-2/55 p-1 scrollbar-thin', className)} role="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative overflow-hidden rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              active ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {active && <motion.span layoutId={activeLayoutId} className="absolute inset-0 rounded-lg border border-line bg-panel shadow-ma-1" transition={{ type: 'spring', stiffness: 450, damping: 38 }} />}
            <span className="relative z-[1]">{t.label}</span>
            {t.count !== undefined && (
              <span className={cn('relative z-[1] ml-1.5 rounded-full px-1.5 py-0.5 text-xs', active ? 'bg-brand/15 text-brand' : 'bg-panel-3 text-fg-3')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────── Pagination ───────────────────────────── */
export function Pagination({
  page, pageCount, onPage, total, pageSize, className = '',
}: {
  page: number; pageCount: number; onPage: (p: number) => void;
  total?: number; pageSize?: number; className?: string;
}) {
  if (pageCount <= 1 && total === undefined) return null;
  const from = total !== undefined && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = total !== undefined && pageSize ? Math.min(page * pageSize, total) : null;
  return (
    <div className={cn('flex items-center justify-between gap-3 flex-wrap', className)}>
      {total !== undefined ? (
        <p className="text-xs text-fg-3">
          {total === 0 ? 'Nenhum resultado' : <>Mostrando <span className="text-fg-2 font-medium">{from}–{to}</span> de <span className="text-fg-2 font-medium">{total}</span></>}
        </p>
      ) : <span />}
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)} disabled={page <= 1}
            aria-label="Página anterior"
            className="w-8 h-8 grid place-items-center rounded-md text-fg-2 hover:bg-panel-2 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-fg-3 px-2 tabular-nums">{page} / {pageCount}</span>
          <button
            onClick={() => onPage(page + 1)} disabled={page >= pageCount}
            aria-label="Próxima página"
            className="w-8 h-8 grid place-items-center rounded-md text-fg-2 hover:bg-panel-2 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Tooltip ───────────────────────────── */
export function Tooltip({
  label, children, side = 'top', className = '',
}: {
  label: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const positions = {
    top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
    right: 'left-full top-1/2 ml-2 -translate-y-1/2',
    bottom: 'left-1/2 top-full mt-2 -translate-x-1/2',
    left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  };
  const child = isValidElement(children)
    ? (() => {
      const element = children as ReactElement<{ 'aria-describedby'?: string }>;
      const describedBy = [element.props['aria-describedby'], visible ? tooltipId : undefined].filter(Boolean).join(' ') || undefined;
      return cloneElement(element, { 'aria-describedby': describedBy });
    })()
    : children;

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setVisible(false); }}
      onFocusCapture={() => setVisible(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setVisible(false); }}
      onKeyDownCapture={(event) => { if (event.key === 'Escape') setVisible(false); }}
    >
      {child}
      <AnimatePresence>
        {visible && (
          <motion.span
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={cn(
              'ma-tooltip pointer-events-none absolute z-[100] whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-fg',
              positions[side],
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ────────────────────────── FilterChips row ────────────────────────── */
export function FilterChip({ label, onRemove }: { label: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-panel-3 border border-line text-xs text-fg-2">
      {label}
      <button onClick={onRemove} aria-label="Remover filtro" className="text-fg-3 hover:text-fg rounded-full">
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}
