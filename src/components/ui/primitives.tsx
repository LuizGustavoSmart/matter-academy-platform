import {
  ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes,
  ReactNode, forwardRef, useId,
} from 'react';
import { Loader2, Search, Check, X } from 'lucide-react';
import { cn, initials, stringHue } from './util';

/* ────────────────────────────── Spinner ────────────────────────────── */
export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} aria-hidden />;
}

/* ────────────────────────────── Button ─────────────────────────────── */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type BtnSize = 'sm' | 'md' | 'lg';
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
};

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover active:bg-brand-press font-semibold',
  secondary: 'bg-panel-2 text-fg border border-line hover:border-line-strong hover:bg-panel-3',
  ghost: 'text-fg-2 hover:text-fg hover:bg-panel-2',
  subtle: 'bg-panel-3 text-fg hover:bg-line',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
};
const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
};

export function Button({
  variant = 'secondary', size = 'md', loading, icon, iconRight, block,
  children, className = '', disabled, ...rest
}: BtnProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-medium',
        'transition-all duration-150 ease-ma active:scale-[0.98]',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100',
        BTN_SIZE[size], BTN_VARIANT[variant], block && 'w-full', className,
      )}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}

/* ──────────────────────────── IconButton ───────────────────────────── */
type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: 'ghost' | 'subtle' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
};
export const IconButton = forwardRef<HTMLButtonElement, IconBtnProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', loading, children, className = '', disabled, ...rest }, ref,
) {
  const variants = {
    ghost: 'text-fg-3 hover:text-fg hover:bg-panel-2',
    subtle: 'bg-panel-3 text-fg-2 hover:text-fg hover:bg-line',
    danger: 'text-fg-3 hover:text-danger hover:bg-danger/10',
  };
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid place-items-center rounded-md transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'sm' ? 'w-7 h-7' : 'w-9 h-9',
        variants[variant], className,
      )}
      disabled={loading || disabled}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
});

/* ───────────────────────────── Field wrap ──────────────────────────── */
export function Field({
  label, required, hint, error, htmlFor, children, className = '',
}: {
  label?: string; required?: boolean; hint?: string; error?: string | null;
  htmlFor?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-center gap-1">
          {label}
          {required && <span className="text-danger" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-danger text-xs mt-1.5 flex items-center gap-1">{error}</p>
      ) : hint ? (
        <p className="text-fg-3 text-xs mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── Input ─────────────────────────────── */
type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className = '', ...rest }, ref,
) {
  return (
    <input
      ref={ref}
      className={cn(invalid && 'border-danger focus:border-danger', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ invalid, className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn('resize-y min-h-[80px]', invalid && 'border-danger focus:border-danger', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ invalid, className = '', children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn('cursor-pointer', invalid && 'border-danger focus:border-danger', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

/* ───────────────────────────── SearchInput ─────────────────────────── */
export function SearchInput({
  value, onChange, placeholder = 'Buscar…', className = '', onClear,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; onClear?: () => void;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="!pl-9 !pr-9"
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); onClear?.(); }}
          aria-label="Limpar busca"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── Checkbox / Radio ──────────────────────── */
export function Checkbox({
  checked, indeterminate, onChange, label, disabled, className = '',
}: {
  checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void;
  label?: ReactNode; disabled?: boolean; className?: string;
}) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none !mb-0', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <span
        className={cn(
          'w-[18px] h-[18px] rounded-[5px] grid place-items-center border transition-colors flex-shrink-0',
          checked || indeterminate ? 'bg-brand border-brand text-brand-ink' : 'bg-panel-3 border-line-strong',
        )}
      >
        {indeterminate ? <span className="w-2.5 h-0.5 bg-brand-ink rounded" /> : checked ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {label && <span className="text-sm text-fg-2">{label}</span>}
    </label>
  );
}

export function Radio({
  checked, onChange, label, name, disabled, className = '',
}: {
  checked: boolean; onChange: () => void; label?: ReactNode; name?: string; disabled?: boolean; className?: string;
}) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none !mb-0', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <span className={cn('w-[18px] h-[18px] rounded-full grid place-items-center border transition-colors flex-shrink-0', checked ? 'border-brand' : 'border-line-strong')}>
        {checked && <span className="w-2.5 h-2.5 rounded-full bg-brand" />}
      </span>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="sr-only" />
      {label && <span className="text-sm text-fg-2">{label}</span>}
    </label>
  );
}

/* ─────────────────────────────── Switch ────────────────────────────── */
export function Switch({
  checked, onChange, label, disabled, id,
}: {
  checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean; id?: string;
}) {
  const gen = useId();
  const inputId = id ?? gen;
  return (
    <label htmlFor={inputId} className={cn('inline-flex items-center gap-2.5 cursor-pointer select-none !mb-0', disabled && 'opacity-50 cursor-not-allowed')}>
      <button
        type="button"
        role="switch"
        id={inputId}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative w-9 h-5 rounded-full transition-colors flex-shrink-0', checked ? 'bg-brand' : 'bg-line-strong')}
      >
        <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform', checked && 'translate-x-4')} />
      </button>
      {label && <span className="text-sm text-fg-2">{label}</span>}
    </label>
  );
}

/* ─────────────────────────────── Badge ─────────────────────────────── */
type BadgeTone = 'default' | 'brand' | 'success' | 'warn' | 'danger' | 'info' | 'outline';
export function Badge({
  children, tone = 'default', dot, className = '',
}: {
  children: ReactNode; tone?: BadgeTone; dot?: boolean; className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    default: 'bg-panel-3 text-fg-2 border-line',
    brand: 'bg-brand/12 text-brand border-brand/25',
    success: 'bg-ok/12 text-ok border-ok/25',
    warn: 'bg-warn/12 text-warn border-warn/25',
    danger: 'bg-danger/12 text-danger border-danger/25',
    info: 'bg-info/15 text-info border-info/30',
    outline: 'bg-transparent text-fg-3 border-line',
  };
  const dotColor: Record<BadgeTone, string> = {
    default: 'bg-fg-3', brand: 'bg-brand', success: 'bg-ok', warn: 'bg-warn',
    danger: 'bg-danger', info: 'bg-info', outline: 'bg-fg-3',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border', tones[tone], className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor[tone])} />}
      {children}
    </span>
  );
}

/* ─────────────────────────────── Avatar ────────────────────────────── */
export function Avatar({
  name, email, size = 36, className = '', src,
}: {
  name?: string | null; email?: string | null; size?: number; className?: string; src?: string | null;
}) {
  const hue = stringHue((name || email || '?').toLowerCase());
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn('rounded-full object-cover flex-shrink-0 select-none border border-line', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn('inline-grid place-items-center rounded-full font-medium text-fg flex-shrink-0 select-none', className)}
      style={{
        width: size, height: size, fontSize: size * 0.4,
        background: `hsl(${hue} 45% 22%)`,
        border: `1px solid hsl(${hue} 45% 32%)`,
      }}
      aria-hidden
    >
      {initials(name, email)}
    </span>
  );
}


/* ──────────────────────────── ProgressBar ──────────────────────────── */
export function ProgressBar({ value, className = '', tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'ok' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('w-full h-1.5 bg-panel-3 rounded-full overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all duration-500 ease-ma', tone === 'ok' ? 'bg-ok' : 'bg-brand')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ───────────────────────────── Skeleton ────────────────────────────── */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('ma-skeleton rounded-md', className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export type { BtnProps, BtnVariant, BadgeTone };
