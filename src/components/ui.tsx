import { ButtonHTMLAttributes, ReactNode, HTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = 'secondary', loading, icon, children, className = '', ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-[#cbfb00] text-black hover:bg-[#b8e300]',
    secondary: 'border border-[#434d5e] text-[#d6deed] hover:bg-[#434d5e]/20',
    danger: 'border border-red-900/60 text-red-400 hover:bg-red-950/40',
    ghost: 'text-[#d6deed] hover:bg-[#434d5e]/20',
  }[variant];
  return (
    <button className={`${base} ${styles} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-[#0d0d0d] border border-[#1c1f26] rounded-lg ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'default', className = '' }: { children: ReactNode; tone?: 'default' | 'success' | 'warn' | 'danger'; className?: string }) {
  const tones = {
    default: 'bg-[#434d5e]/20 text-[#d6deed] border-[#434d5e]',
    success: 'bg-[#cbfb00]/10 text-[#cbfb00] border-[#cbfb00]/30',
    warn: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    danger: 'bg-red-500/10 text-red-400 border-red-500/30',
  }[tone];
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${tones} ${className}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d0d0d] border border-[#1c1f26] rounded-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#1c1f26]">
          <h3 className="!text-white !text-lg !font-medium">{title}</h3>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[#1c1f26] flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="border border-dashed border-[#434d5e]/50 rounded-lg py-16 px-6 text-center">
      {icon && <div className="flex justify-center mb-4 text-[#434d5e]">{icon}</div>}
      <p className="text-[#d6deed] font-medium">{title}</p>
      {description && <p className="meta mt-2">{description}</p>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-[#434d5e]/30 rounded-full overflow-hidden">
      <div className="h-full bg-[#cbfb00] transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Toast({ message, tone = 'default' }: { message: string | null; tone?: 'default' | 'danger' | 'success' }) {
  if (!message) return null;
  const tones = {
    default: 'border-[#434d5e] text-[#d6deed]',
    danger: 'border-red-500/40 text-red-300 bg-red-950/30',
    success: 'border-[#cbfb00]/40 text-[#cbfb00] bg-[#cbfb00]/5',
  }[tone];
  return (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-md border bg-[#0d0d0d] ${tones} text-sm z-50 shadow-lg`}>
      {message}
    </div>
  );
}
