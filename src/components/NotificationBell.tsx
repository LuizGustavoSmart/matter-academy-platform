import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell } from 'lucide-react';
import { cn } from './ui';
import { popIn } from './ui/motion';
import { useNotifications, type Notificacao } from '../hooks/useNotifications';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Largura ideal do painel; encolhe sozinho em telas estreitas. */
const PANEL_W = 340;
/** Respiro mínimo entre o painel e as bordas da janela. */
const MARGIN = 12;
/** Distância entre o painel e o botão. */
const GAP = 8;

type Pos = { top?: number; bottom?: number; left: number; width: number; maxHeight: number };

export function NotificationBell() {
  const { items, unread, markAsRead, markAllAsRead } = useNotifications();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  /**
   * O sino aparece tanto no rodapé da sidebar (canto inferior esquerdo) quanto
   * no topbar mobile (canto superior direito), então nada aqui pode assumir um
   * lado fixo: o painel é alinhado pela direita do botão e, em seguida, trazido
   * de volta para dentro da janela — é isso que impede o corte na borda quando
   * o botão está colado no canto esquerdo ou a tela é estreita.
   */
  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = Math.min(PANEL_W, vw - MARGIN * 2);
    const left = Math.min(Math.max(r.right - width, MARGIN), vw - width - MARGIN);

    const spaceBelow = vh - r.bottom - GAP - MARGIN;
    const spaceAbove = r.top - GAP - MARGIN;
    // Abre para cima só quando faltar espaço embaixo e sobrar mais em cima.
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(vh * 0.7, openUp ? spaceAbove : spaceBelow));

    setPos({
      left,
      width,
      maxHeight,
      ...(openUp ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
    });
  }, []);

  const toggle = () => { if (!open) place(); setOpen((o) => !o); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!btnRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    // Girar o celular ou redimensionar a janela recoloca o painel em vez de
    // fechá-lo — sem isso ele ficaria preso na geometria da janela antiga.
    const onResize = () => place();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, place]);

  const onItemClick = (n: Notificacao) => {
    setOpen(false);
    if (!n.lida) markAsRead(n.id);
    if (n.link) nav(n.link);
  };

  return (
    <div>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notificações"
        className="relative flex items-center justify-center w-8 h-8 rounded-md text-fg-3 hover:text-fg hover:bg-panel-2 transition-colors"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-danger text-white text-[10px] font-semibold leading-[15px] text-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {pos && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={popIn}
              onMouseDown={(e) => e.stopPropagation()}
              className="fixed z-[60] ma-glass ma-glass-strong rounded-lg overflow-hidden flex flex-col"
              style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
            >
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line flex-shrink-0">
                <p className="text-sm font-medium text-fg">Notificações</p>
                {unread > 0 && (
                  <button onClick={markAllAsRead} className="text-[11px] text-brand font-medium hover:underline">
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <div className="overflow-y-auto scrollbar-thin">
                {items.length === 0 ? (
                  <p className="text-fg-3 text-sm px-3.5 py-6 text-center">Nenhuma notificação por aqui.</p>
                ) : items.map((n) => (
                  <button
                    key={n.id}
                    role="menuitem"
                    onClick={() => onItemClick(n)}
                    className={cn(
                      'w-full text-left px-3.5 py-2.5 border-b border-line last:border-0 hover:bg-panel-3 transition-colors flex gap-2',
                      !n.lida && 'bg-panel-2/60',
                    )}
                  >
                    {!n.lida && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />}
                    <span className={cn('min-w-0 flex-1', n.lida && 'pl-3.5')}>
                      <span className="block text-sm text-fg font-medium truncate">{n.titulo}</span>
                      <span className="block text-xs text-fg-3 mt-0.5 line-clamp-2">{n.mensagem}</span>
                      <span className="block text-[11px] text-fg-3/80 mt-1">{timeAgo(n.criado_em)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
