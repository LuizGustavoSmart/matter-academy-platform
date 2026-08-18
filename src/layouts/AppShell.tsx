import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X, LogOut, ChevronRight, PanelLeftClose, Undo2, GraduationCap, UserCog } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';
import { Avatar, Breadcrumbs, cn } from '../components/ui';
import type { Crumb } from '../components/ui';
import { fadeScrim, popIn, slideFromLeft } from '../components/ui/motion';

export type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (path: string) => boolean;
  badge?: number;
};
export type NavGroup = { title?: string; items: NavItem[] };

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', student: 'Aluno', professor: 'Professor', monitor: 'Monitor', embaixador: 'Embaixador',
};

const COLLAPSE_KEY = 'ma_sidebar_collapsed';

/* ══════════════════════════════ NavList ═══════════════════════════════ */
function NavList({ nav, collapsed, onNavigate }: { nav: NavGroup[]; collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const isActive = (it: NavItem) =>
    it.match ? it.match(pathname) : pathname === it.to || pathname.startsWith(it.to + '/');

  return (
    <nav className="flex-1 overflow-y-auto scrollbar-thin px-2.5 py-3 space-y-5">
      {nav.map((group, gi) => (
        <div key={gi}>
          {group.title && !collapsed && (
            <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-3/80">{group.title}</p>
          )}
          <div className="space-y-0.5">
            {group.items.map((it) => {
              const active = isActive(it);
              const Icon = it.icon;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  data-tour={it.to}
                  onClick={onNavigate}
                  title={collapsed ? it.label : undefined}
                  className={cn(
                    'group/nav relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
                    collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2',
                    active ? 'bg-panel-3 text-fg' : 'text-fg-3 hover:text-fg hover:bg-panel-2',
                  )}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-brand" aria-hidden />}
                  <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', active && 'text-brand')} />
                  {!collapsed && <span className="truncate">{it.label}</span>}
                  {!collapsed && it.badge ? (
                    <span className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-warn/15 text-warn tabular-nums">{it.badge}</span>
                  ) : null}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/* ════════════════════════════ ProfileMenu ═════════════════════════════ */
/**
 * Posicionado via portal para document.body (mesmo padrão do DropdownMenu
 * genérico em components/ui/overlays.tsx) — evitar aninhar o conteúdo do
 * menu dentro do próprio botão, que causava uma corrida entre o listener de
 * "clique fora" (mousedown) e o clique no item "Meu perfil" (que só chegava
 * depois), fazendo a navegação nunca disparar.
 */
function ProfileMenu({ collapsed }: { collapsed?: boolean }) {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ bottom: window.innerHeight - r.top + 8, left: r.left, right: window.innerWidth - r.right });
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

  const logout = async () => { await signOut(); nav('/login'); };
  const name = profile?.nome || profile?.email?.split('@')[0] || 'Conta';

  return (
    <div>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn('flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-panel-2 transition-colors', !collapsed && 'w-full')}
      >
        <Avatar name={profile?.nome} email={profile?.email} src={profile?.avatar_url} size={32} />
        {!collapsed && (
          <span className="min-w-0 text-left flex-1">
            <span className="block text-sm text-fg font-medium truncate">{name}</span>
            <span className="block text-[11px] text-fg-3 truncate">{ROLE_LABEL[profile?.role ?? ''] ?? profile?.email}</span>
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
              className="fixed z-[60] min-w-[220px] ma-glass ma-glass-strong rounded-lg overflow-hidden"
              style={{ bottom: pos.bottom, left: pos.left }}
            >
              <button role="menuitem" onClick={() => { setOpen(false); nav('/perfil'); }} className="w-full text-left px-3.5 py-3 border-b border-line hover:bg-panel-3 transition-colors">
                <p className="text-sm text-fg font-medium truncate">{profile?.nome || name}</p>
                <p className="text-xs text-fg-3 truncate mt-0.5">{profile?.email}</p>
                <span className="inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand/12 text-brand border border-brand/25">
                  {ROLE_LABEL[profile?.role ?? ''] ?? 'Usuário'}
                </span>
              </button>
              <button role="menuitem" onClick={logout} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-fg-2 hover:bg-panel-3 hover:text-fg transition-colors">
                <LogOut className="w-4 h-4" /> Sair da conta
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

/* ══════════════════════════ ViewAsSwitcher ═════════════════════════════ */
function ViewAsSwitcher({ collapsed }: { collapsed: boolean }) {
  const { profile, isImpersonating, startViewAs, stopViewAs } = useAuth();

  if (isImpersonating) {
    return (
      <div className={cn('flex-shrink-0 px-2.5 pt-2.5', collapsed && 'px-1.5')}>
        <button
          onClick={stopViewAs}
          title="Retornar para admin"
          className={cn(
            'w-full flex items-center gap-2 rounded-md bg-brand text-brand-ink text-sm font-semibold transition-colors hover:bg-brand-hover',
            collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
          )}
        >
          <Undo2 className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="truncate">Retornar para admin</span>}
        </button>
      </div>
    );
  }

  if (profile?.role !== 'admin' || collapsed) return null;

  return (
    <div className="flex-shrink-0 px-2.5 pt-2.5">
      <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-3/80">Visualizar como</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => startViewAs('student')} className="flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium text-fg-2 hover:bg-panel-2 hover:text-fg transition-colors">
          <GraduationCap className="w-3.5 h-3.5" /> Aluno
        </button>
        <button onClick={() => startViewAs('professor')} className="flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium text-fg-2 hover:bg-panel-2 hover:text-fg transition-colors">
          <UserCog className="w-3.5 h-3.5" /> Professor
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════ Sidebar ═══════════════════════════════ */
function SidebarInner({
  nav, area, collapsed, onToggleCollapse, onNavigate, showClose, onClose,
}: {
  nav: NavGroup[]; area: string; collapsed: boolean;
  onToggleCollapse?: () => void; onNavigate?: () => void; showClose?: boolean; onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full w-full bg-panel border-r border-line">
      {/* Cabeçalho */}
      <div className={cn('group/header relative flex items-center border-b border-line h-14 flex-shrink-0', collapsed ? 'px-0' : 'px-4')}>
        <div className="absolute left-5 top-1/2 flex -translate-y-1/2 items-center min-w-0">
          <Logo
            height={48}
            iconOnly={collapsed}
            className="mix-blend-screen"
          />
        </div>
        {showClose ? (
          <button onClick={onClose} aria-label="Fechar menu" className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg p-1 rounded-md"><X className="w-5 h-5" /></button>
        ) : onToggleCollapse ? (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg p-1 rounded-md hidden lg:block transition-opacity',
              collapsed && 'right-1 opacity-0 group-hover/header:opacity-100 focus-visible:opacity-100',
            )}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        ) : null}
      </div>

      <ViewAsSwitcher collapsed={collapsed} />

      {!collapsed && (
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-3/70">{area}</p>
      )}

      <NavList nav={nav} collapsed={collapsed} onNavigate={onNavigate} />

      {/* Rodapé — perfil */}
      <div className="border-t border-line p-2.5 flex-shrink-0">
        <ProfileMenu collapsed={collapsed} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════ Shell ════════════════════════════════ */
export default function AppShell({
  nav, area, contentPadded = true,
}: {
  nav: NavGroup[]; area: string; contentPadded?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggleCollapse = () => setCollapsed((c) => { localStorage.setItem(COLLAPSE_KEY, String(!c)); return !c; });

  return (
    <div className="min-h-screen flex bg-canvas">
      {/* Sidebar desktop */}
      <aside className={cn('hidden lg:flex flex-shrink-0 sticky top-0 h-screen transition-[width] duration-200 ease-ma', collapsed ? 'w-[68px]' : 'w-60')}>
        <SidebarInner nav={nav} area={area} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Sidebar mobile (off-canvas) */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={fadeScrim}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={slideFromLeft}
              className="absolute inset-y-0 left-0 w-[264px]"
            >
              <SidebarInner nav={nav} area={area} collapsed={false} onNavigate={() => setMobileOpen(false)} showClose onClose={() => setMobileOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Coluna principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar (somente mobile: abre o menu) */}
        <header className="lg:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-4 border-b border-line bg-canvas/90 backdrop-blur">
          <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="text-fg-2 hover:text-fg p-1 -ml-1 rounded-md">
            <Menu className="w-5 h-5" />
          </button>
          <Logo height={22} className="mix-blend-screen" />
        </header>

        <main className={cn('flex-1 min-w-0 overflow-x-hidden', contentPadded && 'px-4 sm:px-6 lg:px-8 py-5 sm:py-7')}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ════════════════════════════ PageHeader ══════════════════════════════ */
export function PageHeader({
  title, subtitle, breadcrumbs, actions, className = '',
}: {
  title: ReactNode; subtitle?: ReactNode; breadcrumbs?: Crumb[]; actions?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className="mb-2.5" />}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="truncate">{title}</h1>
          {subtitle && <p className="text-fg-3 text-sm mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
