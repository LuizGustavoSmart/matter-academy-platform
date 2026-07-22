import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronRight, Command, LogOut, Menu, Moon, PanelLeft, PanelLeftClose,
  Search, Settings, Sun, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { Logo } from '../components/Logo';
import { NotificationBell } from '../components/NotificationCenter';
import { Avatar, Breadcrumbs, Input, Modal, Tooltip, cn } from '../components/ui';
import type { Crumb } from '../components/ui';
import { fadeScrim, pageIn, popIn, slideFromLeft } from '../components/ui/motion';

export type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (path: string) => boolean;
  badge?: number;
};
export type NavGroup = { title?: string; items: NavItem[] };

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', student: 'Aluno', professor: 'Professor', monitor: 'Monitor',
};

const COLLAPSE_KEY = 'ma_sidebar_collapsed';

function itemIsActive(item: NavItem, pathname: string) {
  return item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavList({ nav, collapsed, onNavigate }: { nav: NavGroup[]; collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();

  return (
    <nav className="flex-1 overflow-y-auto px-2.5 py-3.5 scrollbar-thin">
      <div className="space-y-5">
        {nav.map((group, groupIndex) => (
          <section key={`${group.title ?? 'principal'}-${groupIndex}`}>
            <AnimatePresence initial={false}>
              {group.title && !collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-3/75"
                >
                  {group.title}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = itemIsActive(item, pathname);
                const Icon = item.icon;
                const navLink = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      'group/nav relative flex h-10 items-center gap-3 overflow-hidden rounded-xl text-[13px] font-medium outline-none',
                      collapsed ? 'w-10 mx-auto justify-center px-0' : 'px-3',
                      active ? 'text-fg' : 'text-fg-3 hover:bg-panel-2/70 hover:text-fg',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="academy-active-nav"
                        className="absolute inset-0 rounded-xl border border-brand/20 bg-brand/[0.10]"
                        transition={{ type: 'spring', stiffness: 430, damping: 36 }}
                      />
                    )}
                    <Icon className={cn('relative z-[1] h-[18px] w-[18px] shrink-0', active && 'text-brand')} />
                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -5 }}
                          className="relative z-[1] min-w-0 flex-1 truncate"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!collapsed && item.badge ? (
                      <span className="relative z-[1] rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-warn">{item.badge}</span>
                    ) : null}
                  </NavLink>
                );
                return collapsed
                  ? <Tooltip key={item.to} label={item.label} side="right" className="w-full">{navLink}</Tooltip>
                  : navLink;
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}

function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = [profile?.nome, profile?.sobrenome].filter(Boolean).join(' ') || profile?.email?.split('@')[0] || 'Conta';

  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((current) => !current);
  };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnResize = () => setOpen(false);
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [open]);

  const logout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-10 items-center gap-2 rounded-xl border border-transparent px-1.5 text-left transition-colors hover:border-line hover:bg-panel-2/70 active:scale-[0.98]',
          compact ? 'w-10 justify-center px-0' : 'min-w-0 pr-2.5',
        )}
      >
        <Avatar name={name} email={profile?.email} src={profile?.avatar_signed_url} size={30} />
        {!compact && (
          <span className="hidden min-w-0 xl:block">
            <span className="block max-w-[128px] truncate text-xs font-semibold text-fg">{name}</span>
            <span className="block text-[10px] text-fg-3">{ROLE_LABEL[profile?.role ?? ''] ?? 'Conta'}</span>
          </span>
        )}
      </button>

      {pos && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              variants={popIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ top: pos.top, right: pos.right }}
              className="ma-popover fixed z-[75] w-64 overflow-hidden rounded-2xl"
            >
              <div className="border-b border-line px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={name} email={profile?.email} src={profile?.avatar_signed_url} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">{name}</p>
                    <p className="truncate text-[11px] text-fg-3">{profile?.email}</p>
                  </div>
                </div>
              </div>
              <div className="p-1.5">
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    navigate(profile?.role === 'admin' ? '/admin/configuracoes' : '/configuracoes');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-fg-2 transition-colors hover:bg-panel-3 hover:text-fg"
                >
                  <Settings className="h-4 w-4" /> Configurações
                </button>
                <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-fg-2 transition-colors hover:bg-panel-3 hover:text-fg">
                  <LogOut className="h-4 w-4" /> Sair da conta
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function SidebarInner({
  nav, area, collapsed, mobile = false, onToggleCollapse, onNavigate, onClose,
}: {
  nav: NavGroup[];
  area: string;
  collapsed: boolean;
  mobile?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className={cn(
      'flex h-full w-full flex-col border-r border-line',
      mobile ? 'app-mobile-drawer ma-overlay-surface ma-overlay-surface--elevated' : 'app-sidebar',
    )}>
      <div className={cn('relative flex h-[52px] shrink-0 items-center border-b border-line', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Logo height={collapsed ? 32 : 43} iconOnly={collapsed} className="app-logo max-w-full" />
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar menu" className="absolute right-3 grid h-8 w-8 place-items-center rounded-lg text-fg-3 hover:bg-panel-2 hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!collapsed && <p className="px-5 pb-1 pt-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-3/70">{area}</p>}
      <NavList nav={nav} collapsed={collapsed} onNavigate={onNavigate} />

      {onToggleCollapse && (
        <div className="shrink-0 border-t border-line p-2.5">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'flex h-9 w-full items-center rounded-xl text-xs font-medium text-fg-3 transition-colors hover:bg-panel-2 hover:text-fg active:scale-[0.98]',
              collapsed ? 'justify-center' : 'gap-2.5 px-2.5',
            )}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeft className="h-[17px] w-[17px]" /> : <PanelLeftClose className="h-[17px] w-[17px]" />}
            {!collapsed && <span>Recolher menu</span>}
          </button>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: NavGroup[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const items = useMemo(() => nav.flatMap((group) => group.items), [nav]);
  const filtered = items.filter((item) => item.label.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} size="md" glass ariaLabel="Buscar na plataforma">
      <div className="-m-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar uma área da plataforma"
            className="h-11 !rounded-xl !bg-panel-2 !pl-10"
          />
        </div>
        <div className="mt-3 max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
          {filtered.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  navigate(item.to);
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg-2 transition-colors hover:bg-panel-2 hover:text-fg"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-panel-3 text-fg-3"><Icon className="h-4 w-4" /></span>
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-fg-3" />
              </button>
            );
          })}
          {filtered.length === 0 && <p className="px-3 py-8 text-center text-sm text-fg-3">Nenhuma área encontrada.</p>}
        </div>
      </div>
    </Modal>
  );
}

export default function AppShell({
  nav, area, contentPadded = true,
}: {
  nav: NavGroup[];
  area: string;
  contentPadded?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { preferences, updatePreferences } = usePreferences();
  const currentItem = nav.flatMap((group) => group.items).find((item) => itemIsActive(item, pathname));
  const pageTitle = pathname.includes('configuracoes') ? 'Configurações' : currentItem?.label ?? area;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    };
    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((current) => {
      localStorage.setItem(COLLAPSE_KEY, String(!current));
      return !current;
    });
  };

  const cycleTheme = () => {
    const next = preferences.theme === 'dark' ? 'light' : preferences.theme === 'light' ? 'hybrid' : 'dark';
    void updatePreferences({ theme: next });
  };
  const ThemeIcon = preferences.theme === 'dark' ? Moon : preferences.theme === 'light' ? Sun : PanelLeft;

  return (
    <div className="app-shell flex min-h-screen bg-canvas">
      <motion.aside
        className="sticky top-0 hidden h-screen shrink-0 overflow-hidden lg:flex"
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
      >
        <SidebarInner nav={nav} area={area} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button
              type="button"
              aria-label="Fechar menu"
              variants={fadeScrim}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="ma-scrim absolute inset-0"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              variants={slideFromLeft}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-y-0 left-0 w-[280px]"
            >
              <SidebarInner nav={nav} area={area} collapsed={false} mobile onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-topbar sticky top-0 z-40 hidden h-[52px] shrink-0 items-center gap-4 border-b border-line px-4 lg:flex">
          <div className="min-w-[150px]">
            <p className="truncate text-[13px] font-semibold text-fg">{pageTitle}</p>
            <p className="truncate text-[10px] text-fg-3">Matter Academy</p>
          </div>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="mx-auto flex h-9 w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-panel-2/65 px-3.5 text-left text-xs text-fg-3 transition-colors hover:border-line-strong hover:bg-panel-2"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate">Buscar na plataforma</span>
            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-1.5 py-0.5 text-[10px] text-fg-3"><Command className="h-3 w-3" />K</span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationBell />
            <Tooltip label="Configurações" side="bottom">
              <button
                type="button"
                onClick={() => navigate(pathname.startsWith('/admin') ? '/admin/configuracoes' : '/configuracoes')}
                aria-label="Abrir configurações"
                className={cn('grid h-9 w-9 place-items-center rounded-xl transition-colors hover:bg-panel-2 hover:text-fg active:scale-95', pathname.includes('configuracoes') ? 'bg-brand/10 text-brand' : 'text-fg-3')}
              >
                <Settings className="h-[18px] w-[18px]" />
              </button>
            </Tooltip>
            <Tooltip label="Alternar tema" side="bottom">
              <button type="button" onClick={cycleTheme} aria-label="Alternar tema" className="grid h-9 w-9 place-items-center rounded-xl text-fg-3 transition-colors hover:bg-panel-2 hover:text-fg active:scale-95">
                <ThemeIcon className="h-[18px] w-[18px]" />
              </button>
            </Tooltip>
            <div className="mx-1 h-5 w-px bg-line" />
            <ProfileMenu />
          </div>
        </header>

        <header className="app-mobile-header sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-3 lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="grid h-9 w-9 place-items-center rounded-xl text-fg-2 hover:bg-panel-2 hover:text-fg">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-fg">{pageTitle}</p></div>
          <NotificationBell compact />
          <ProfileMenu compact />
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            variants={pageIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn('min-w-0 flex-1 overflow-x-hidden', contentPadded && 'px-4 py-5 sm:px-6 sm:py-7 lg:px-8')}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} nav={nav} />
    </div>
  );
}

export function PageHeader({
  title, subtitle, breadcrumbs, actions, className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className="mb-2.5" />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-fg-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
