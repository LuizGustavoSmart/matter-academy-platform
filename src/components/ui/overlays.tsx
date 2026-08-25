import {
  ReactNode, createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, XCircle, Info, Loader2 } from 'lucide-react';
import { cn } from './util';
import { Button } from './primitives';
import { fadeScrim, scaleIn, popIn, slideFromRight, toastIn } from './motion';

/* ═══════════════════════════ Overlay base ═══════════════════════════ */
/**
 * O componente agora fica montado durante a animação de saída (AnimatePresence),
 * então o scroll-lock/listener de Escape não podem ser removidos no instante em
 * que `open` vira false — a saída ainda está visível por cima da página. O
 * cleanup real (unlock + remove listener) só roda em `onExitComplete`.
 */
function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // onClose quase sempre chega como uma arrow function nova a cada render do
  // componente pai (ex.: onClose={() => setX(null)}). Guardamos a versão mais
  // recente numa ref em vez de listar `onClose` como dependência abaixo — do
  // contrário, o efeito reabria (e reagendava o autofoco) a cada nova
  // instância de onClose, inclusive a cada tecla digitada em qualquer campo
  // do modal, "roubando" o foco de volta para o primeiro campo 30ms depois.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    // Reabertura antes do exit anterior terminar: finaliza o cleanup pendente primeiro.
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[data-autofocus],input,textarea,select,button');
      el?.focus();
    }, 30);
    cleanupRef.current = () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    return () => clearTimeout(t);
  }, [open]);

  // Unmount real (ex.: navegação de rota) — não depende do fim da animação de saída.
  useEffect(() => () => cleanupRef.current?.(), []);

  const onExitComplete = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  return { ref, onExitComplete };
}

/* ═══════════════════════════════ Modal ═══════════════════════════════ */
export function Modal({
  open, onClose, title, children, footer, size = 'md', glass = false,
}: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg'; glass?: boolean;
}) {
  const { ref, onExitComplete } = useDismiss(open, onClose);
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size];
  return createPortal(
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          variants={fadeScrim}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'w-full max-h-[90vh] flex flex-col rounded-xl',
              glass ? 'ma-glass-elevated' : 'bg-panel border border-line shadow-ma-3',
              width,
            )}
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3 flex-shrink-0">
                <h3 className="text-base">{title}</h3>
                <button onClick={onClose} aria-label="Fechar" className="text-fg-3 hover:text-fg -mr-1 p-1 rounded-md"><X className="w-5 h-5" /></button>
              </div>
            )}
            <div className="px-5 py-5 overflow-y-auto scrollbar-thin">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-line flex justify-end gap-2 flex-shrink-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ═══════════════════════════════ Drawer ══════════════════════════════ */
export function Drawer({
  open, onClose, title, subtitle, children, footer, width = 'md',
}: {
  open: boolean; onClose: () => void; title?: string; subtitle?: ReactNode;
  children: ReactNode; footer?: ReactNode; width?: 'md' | 'lg' | 'xl';
}) {
  const { ref, onExitComplete } = useDismiss(open, onClose);
  const w = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' }[width];
  return createPortal(
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
          variants={fadeScrim}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn('w-full h-full flex flex-col bg-panel border-l border-line shadow-ma-3', w)}
            variants={slideFromRight}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-3 flex-shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base">{title}</h3>
                  {subtitle && <p className="text-fg-3 text-xs mt-0.5">{subtitle}</p>}
                </div>
                <button onClick={onClose} aria-label="Fechar" className="text-fg-3 hover:text-fg -mr-1 p-1 rounded-md flex-shrink-0"><X className="w-5 h-5" /></button>
              </div>
            )}
            <div className="px-5 py-5 overflow-y-auto scrollbar-thin flex-1">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-line flex justify-end gap-2 flex-shrink-0 bg-panel">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ═══════════════════════════ DropdownMenu ════════════════════════════ */
export type MenuItem =
  | { type?: 'item'; label: string; icon?: ReactNode; onClick: () => void; tone?: 'default' | 'danger'; disabled?: boolean }
  | { type: 'separator' }
  | { type: 'label'; label: string };

export function DropdownMenu({
  trigger, items, align = 'right',
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: (el: HTMLButtonElement | null) => void }) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, right: window.innerWidth - r.right });
  }, []);

  const toggle = () => { if (!open) place(); setOpen((o) => !o); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!btnRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <>
      {trigger({ open, toggle, ref: (el) => { btnRef.current = el; } })}
      {pos && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              className="fixed z-[60] min-w-[184px] py-1 rounded-lg ma-glass"
              style={align === 'right' ? { top: pos.top, right: pos.right } : { top: pos.top, left: pos.left }}
              variants={popIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {items.map((it, i) => {
                if ('type' in it && it.type === 'separator') return <div key={i} className="my-1 h-px bg-line" />;
                if ('type' in it && it.type === 'label') return <div key={i} className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-fg-3">{it.label}</div>;
                const item = it as Extract<MenuItem, { onClick: () => void }>;
                return (
                  <button
                    key={i}
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => { setOpen(false); item.onClick(); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                      item.tone === 'danger' ? 'text-danger hover:bg-danger/10' : 'text-fg-2 hover:bg-panel-3 hover:text-fg',
                    )}
                  >
                    {item.icon && <span className="flex-shrink-0 w-4 h-4 grid place-items-center">{item.icon}</span>}
                    {item.label}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/* ═══════════════════════════ Confirm dialog ══════════════════════════ */
type ConfirmOpts = {
  title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string;
  tone?: 'danger' | 'brand'; requireText?: string;
};
const ConfirmCtx = createContext<((o: ConfirmOpts) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => { setTyped(''); setState({ ...o, resolve }); }), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  const tone = state?.tone ?? 'brand';
  const blocked = !!state?.requireText && typed.trim() !== state.requireText;

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        size="sm"
        glass
        footer={state && (
          <>
            <Button variant="secondary" onClick={() => close(false)}>{state.cancelLabel ?? 'Cancelar'}</Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)} data-autofocus>
              {state.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        )}
      >
        {state && (
          <div className="flex gap-3.5">
            <span className={cn('w-9 h-9 rounded-full grid place-items-center flex-shrink-0', tone === 'danger' ? 'bg-danger/12 text-danger' : 'bg-brand/12 text-brand')}>
              {tone === 'danger' ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </span>
            <div className="min-w-0">
              <h3 className="text-base mb-1">{state.title}</h3>
              {state.message && <div className="text-sm text-fg-2">{state.message}</div>}
              {state.requireText && (
                <div className="mt-3">
                  <label>Digite <span className="text-fg font-medium">{state.requireText}</span> para confirmar</label>
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

/* ══════════════════════════════ Toasts ═══════════════════════════════ */
type ToastTone = 'default' | 'success' | 'danger' | 'warn' | 'info' | 'loading';
type ToastItem = { id: string; message: ReactNode; tone: ToastTone; action?: { label: string; onClick: () => void } };
type ToastApi = {
  show: (message: ReactNode, opts?: { tone?: ToastTone; duration?: number; action?: ToastItem['action'] }) => string;
  success: (m: ReactNode, d?: number) => string;
  error: (m: ReactNode, d?: number) => string;
  warn: (m: ReactNode, d?: number) => string;
  info: (m: ReactNode, d?: number) => string;
  dismiss: (id: string) => void;
};
const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const show = useCallback((message: ReactNode, opts?: { tone?: ToastTone; duration?: number; action?: ToastItem['action'] }) => {
    const id = Math.random().toString(36).slice(2);
    const tone = opts?.tone ?? 'default';
    setItems((xs) => [...xs, { id, message, tone, action: opts?.action }]);
    const duration = opts?.duration ?? (tone === 'danger' ? 6000 : 3800);
    if (tone !== 'loading' && duration > 0) timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api: ToastApi = {
    show,
    success: (m, d) => show(m, { tone: 'success', duration: d }),
    error: (m, d) => show(m, { tone: 'danger', duration: d }),
    warn: (m, d) => show(m, { tone: 'warn', duration: d }),
    info: (m, d) => show(m, { tone: 'info', duration: d }),
    dismiss,
  };

  const icon: Record<ToastTone, ReactNode> = {
    default: null,
    success: <CheckCircle2 className="w-4 h-4 text-ok" />,
    danger: <XCircle className="w-4 h-4 text-danger" />,
    warn: <AlertTriangle className="w-4 h-4 text-warn" />,
    info: <Info className="w-4 h-4 text-info" />,
    loading: <Loader2 className="w-4 h-4 text-fg-2 animate-spin" />,
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]" role="region" aria-live="polite" aria-label="Notificações">
          <AnimatePresence mode="popLayout">
            {items.map((t) => (
              <motion.div
                key={t.id}
                layout
                variants={toastIn}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg ma-glass"
              >
                {icon[t.tone] && <span className="mt-0.5 flex-shrink-0">{icon[t.tone]}</span>}
                <div className="text-sm text-fg flex-1 min-w-0">{t.message}</div>
                {t.action && (
                  <button onClick={() => { t.action!.onClick(); dismiss(t.id); }} className="text-brand text-xs font-medium hover:underline flex-shrink-0">{t.action.label}</button>
                )}
                <button onClick={() => dismiss(t.id)} aria-label="Fechar" className="text-fg-3 hover:text-fg flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/* ─── Toast legado (páginas ainda não migradas) ─── */
export function Toast({ message, tone = 'default' }: { message: string | null; tone?: 'default' | 'danger' | 'success' }) {
  const tones = {
    default: 'border-line text-fg',
    danger: 'border-danger/40 text-danger bg-danger/10',
    success: 'border-ok/40 text-ok bg-ok/10',
  }[tone];
  return createPortal(
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          variants={toastIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn('fixed bottom-4 right-4 px-4 py-3 rounded-lg border text-sm z-[70] ma-glass', tones)}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
