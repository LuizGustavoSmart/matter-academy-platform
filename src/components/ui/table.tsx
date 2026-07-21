import { ReactNode, HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { cn } from './util';
import { Skeleton } from './primitives';

/* Contêiner com scroll horizontal controlado (nunca estoura o body). */
export function TableWrap({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <table className={cn('w-full text-sm border-collapse', className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="text-left">{children}</thead>;
}
export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ className = '', children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-line last:border-0', className)} {...rest}>{children}</tr>;
}

export function Th({ className = '', children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn('px-4 py-2.5 font-medium text-fg-3 text-xs uppercase tracking-wider whitespace-nowrap bg-panel-2/50', className)} {...rest}>
      {children}
    </th>
  );
}

export function Td({ className = '', children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...rest}>{children}</td>;
}

/* Cabeçalho ordenável. dir: 'asc' | 'desc' | null */
export function SortHeader({
  label, active, dir, onClick, className = '', align = 'left',
}: {
  label: string; active: boolean; dir: 'asc' | 'desc' | null; onClick: () => void;
  className?: string; align?: 'left' | 'right';
}) {
  return (
    <th className={cn('px-4 py-2.5 text-xs uppercase tracking-wider whitespace-nowrap bg-panel-2/50 font-medium', className)}>
      <button
        onClick={onClick}
        className={cn('inline-flex items-center gap-1 transition-colors', align === 'right' && 'flex-row-reverse', active ? 'text-fg-2' : 'text-fg-3 hover:text-fg-2')}
      >
        {label}
        {active && dir === 'asc' ? <ArrowUp className="w-3 h-3" />
          : active && dir === 'desc' ? <ArrowDown className="w-3 h-3" />
          : <ChevronsUpDown className="w-3 h-3 opacity-60" />}
      </button>
    </th>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-panel border border-line rounded-xl overflow-hidden" aria-hidden>
      <div className="px-4 py-3 border-b border-line bg-panel-2/50 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3.5 border-b border-line last:border-0 flex items-center gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'flex-[1.5]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}
