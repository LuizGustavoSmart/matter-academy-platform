import {
  ReactNode, createContext, useContext, useState, useCallback, useEffect, useId, useRef,
  cloneElement, isValidElement, type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent,
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

  useEffect(() => {
    // Reabertura antes do exit anterior terminar: finaliza o cleanup pendente primeiro.
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!open) return;
    // Guarda o elemento que abriu o diálogo para devolver o foco ao fechar (WAI-ARIA modal).
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const panel = ref.current;
      if (!panel) return;
      // Menus portalizados (Select/DropdownMenu) abertos dentro do diálogo têm seu
      // próprio tratamento de Tab — não capturar quando o foco está dentro deles.
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest('[role="menu"]')) return;
      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
        .filter((el) => el.getClientRects().length > 0);
      if (nodes.length === 0) { e.preventDefault(); return; }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const inside = panel.contains(active);
      if (e.shiftKey) {
        if (!inside || active === first) { e.preventDefault(); last.focus(); }
      } else if (!inside || active === last) {
        e.preventDefault(); first.focus();
      }
    };
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
      // Restaura o foco ao gatilho, contanto que ele ainda exista no documento.
      if (opener && opener.isConnected) opener.focus();
    };
    return () => clearTimeout(t);
  }, [open, onClose]);

  // Unmount real (ex.: navegação de rota) — não depende do fim da animação de saída.
  useEffect(() => () => cleanupRef.current?.(), []);

  const onExitComplete = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  return { ref, onExitComplete };
}

function getOverlayRoot() {
  return document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : document.body;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusAdjacent(origin: HTMLElement | null, backwards: boolean) {
  if (!origin) return;
  const focusable = [...document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter((element) => (
      element.getClientRects().length > 0
      && !element.closest('[aria-hidden="true"]')
      && !element.closest('[role="menu"]')
    ));
  const current = focusable.indexOf(origin);
  if (current < 0 || focusable.length < 2) { origin.focus(); return; }
  const next = (current + (backwards ? -1 : 1) + focusable.length) % focusable.length;
  focusable[next]?.focus();
}

/* ═══════════════════════════════ Modal ═══════════════════════════════ */
export function Modal({
  open, onClose, title, ariaLabel, children, footer, size = 'md', glass = false,
}: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg'; glass?: boolean; ariaLabel?: string;
}) {
  const { ref, onExitComplete } = useDismiss(open, onClose);
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size];
  return createPortal(
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <motion.div
          className="ma-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
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
            aria-label={ariaLabel ?? title ?? 'Janela'}
            className={cn(
              'ma-overlay-surface w-full max-h-[90vh] flex flex-col rounded-2xl',
              glass && 'ma-overlay-surface--elevated',
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
    getOverlayRoot(),
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
          className="ma-scrim fixed inset-0 z-50 flex justify-end"
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
            className={cn('ma-overlay-surface ma-overlay-surface--elevated w-full h-full flex flex-col border-l sm:rounded-l-3xl', w)}
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
            {footer && <div className="px-5 py-4 border-t border-line flex justify-end gap-2 flex-shrink-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    getOverlayRoot(),
  );
}

/* ═══════════════════════════ DropdownMenu ════════════════════════════ */
export type MenuItem =
  | { type?: 'item'; label: string; icon?: ReactNode; onClick: () => void; tone?: 'default' | 'danger'; disabled?: boolean; selected?: boolean }
  | { type: 'separator' }
  | { type: 'label'; label: string };

type ActionMenuItem = Extract<MenuItem, { onClick: () => void }>;

function MenuItems({ items, onSelect }: { items: MenuItem[]; onSelect: (item: ActionMenuItem) => void }) {
  return (
    <>
      {items.map((it, i) => {
        if ('type' in it && it.type === 'separator') return <div key={i} role="separator" className="my-1 h-px bg-line" />;
        if ('type' in it && it.type === 'label') return <div key={i} className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-fg-3">{it.label}</div>;
        const item = it as ActionMenuItem;
        return (
          <button
            key={i}
            type="button"
            role={item.selected === undefined ? 'menuitem' : 'menuitemradio'}
            aria-checked={item.selected}
            disabled={item.disabled}
            onClick={() => onSelect(item)}
            className={cn(
              'mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              item.tone === 'danger' ? 'text-danger hover:bg-danger/10' : 'text-fg-2 hover:bg-panel-3/75 hover:text-fg',
            )}
          >
            {item.icon && <span className="grid h-4 w-4 flex-shrink-0 place-items-center">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </>
  );
}

export function DropdownMenu({
  trigger, items, align = 'right', matchTriggerWidth = false,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: (el: HTMLButtonElement | null) => void }) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  matchTriggerWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; right: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, right: window.innerWidth - r.right, width: r.width });
  }, []);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => btnRef.current?.focus());
  }, []);
  const toggle = () => { if (!open) place(); setOpen((o) => !o); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(true); };
    const onScroll = () => close();
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
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const navigateMenu = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      close();
      requestAnimationFrame(() => focusAdjacent(btnRef.current, event.shiftKey));
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? buttons.length - 1
        : event.key === 'ArrowDown' ? (current + 1 + buttons.length) % buttons.length
          : (current - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const renderedTrigger = trigger({ open, toggle, ref: (el) => { btnRef.current = el; } });
  const accessibleTrigger = isValidElement(renderedTrigger)
    ? cloneElement(renderedTrigger as ReactElement<Record<string, unknown>>, {
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      'aria-controls': open ? menuId : undefined,
    })
    : renderedTrigger;

  return (
    <>
      {accessibleTrigger}
      {pos && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              id={menuId}
              role="menu"
              className="ma-popover fixed z-[60] min-w-[184px] rounded-2xl py-1.5"
              style={align === 'right'
                ? { top: pos.top, right: pos.right, minWidth: matchTriggerWidth ? pos.width : undefined }
                : { top: pos.top, left: pos.left, minWidth: matchTriggerWidth ? pos.width : undefined }}
              variants={popIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={navigateMenu}
            >
              <MenuItems items={items} onSelect={(item) => { close(true); item.onClick(); }} />
            </motion.div>
          )}
        </AnimatePresence>,
        getOverlayRoot(),
      )}
    </>
  );
}

/* Context menu reutiliza o mesmo material e a mesma linguagem do dropdown. */
export function ContextMenu({
  children, items, disabled = false,
}: {
  children: ReactElement<Record<string, unknown>>; items: MenuItem[]; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuId = useId();

  const placeMenu = (clientX: number, clientY: number) => {
    const estimatedHeight = Math.min(420, items.length * 38 + 12);
    setPos({
      left: Math.max(8, Math.min(clientX, window.innerWidth - 208)),
      top: Math.max(8, Math.min(clientY, window.innerHeight - estimatedHeight - 8)),
    });
    setOpen(true);
  };

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openAtPointer = (event: ReactMouseEvent<HTMLElement>) => {
    if (disabled) return;
    event.preventDefault();
    triggerRef.current = event.currentTarget;
    placeMenu(event.clientX, event.clientY);
  };

  const openFromKeyboard = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (disabled || (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10'))) return;
    event.preventDefault();
    triggerRef.current = event.currentTarget;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    placeMenu(rect.left + Math.min(24, rect.width / 2), rect.bottom + 4);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnPointer = () => close();
    const closeOnViewport = () => close();
    const closeOnKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true); };
    document.addEventListener('mousedown', closeOnPointer);
    document.addEventListener('keydown', closeOnKey);
    window.addEventListener('resize', closeOnViewport);
    window.addEventListener('scroll', closeOnViewport, true);
    return () => {
      document.removeEventListener('mousedown', closeOnPointer);
      document.removeEventListener('keydown', closeOnKey);
      window.removeEventListener('resize', closeOnViewport);
      window.removeEventListener('scroll', closeOnViewport, true);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const navigateMenu = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      close();
      requestAnimationFrame(() => focusAdjacent(triggerRef.current, event.shiftKey));
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? buttons.length - 1
        : event.key === 'ArrowDown' ? (current + 1 + buttons.length) % buttons.length
          : (current - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const childProps = children.props as {
    onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
    onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
    tabIndex?: number;
  };
  const trigger = cloneElement(children, {
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
      childProps.onContextMenu?.(event);
      if (!event.defaultPrevented) openAtPointer(event);
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      childProps.onKeyDown?.(event);
      if (!event.defaultPrevented) openFromKeyboard(event);
    },
    tabIndex: childProps.tabIndex ?? 0,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
  });

  return (
    <>
      {trigger}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Menu de contexto"
              className="ma-context-menu fixed z-[65] min-w-[192px] rounded-2xl py-1.5"
              style={pos}
              variants={popIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={navigateMenu}
            >
              <MenuItems items={items} onSelect={(item) => { close(true); item.onClick(); }} />
            </motion.div>
          )}
        </AnimatePresence>,
        getOverlayRoot(),
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
        ariaLabel={state?.title}
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
                className="ma-popover flex items-start gap-2.5 rounded-xl px-3.5 py-3"
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
        getOverlayRoot(),
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
    danger: 'ma-toast--danger text-danger',
    success: 'ma-toast--success text-ok',
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
          className={cn('ma-popover fixed bottom-4 right-4 z-[70] rounded-xl px-4 py-3 text-sm', tones)}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>,
    getOverlayRoot(),
  );
}
