import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo } from '../components/Logo';

type NavItem =
  | {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      to: string;
      end?: boolean;
      isActive?: never;
      onClick?: never;
    }
  | {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      onClick: () => void;
      isActive: boolean;
      to?: never;
      end?: never;
    };

type AppSidebarProps = {
  items: NavItem[];
  profile: { email?: string | null } | null;
  onLogout: () => void;
  subtitle?: string;
};

const STORAGE_KEY = 'sidebar_collapsed';

const activeClass  = 'bg-[#cbfb00] text-black font-medium';
const inactiveClass = 'text-[#d6deed] hover:bg-[#434d5e]/20';

export function AppSidebar({ items, profile, onLogout, subtitle }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  const toggle = () =>
    setCollapsed((c) => { localStorage.setItem(STORAGE_KEY, String(!c)); return !c; });

  const base = (active: boolean, col: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors w-full ${
      col ? 'justify-center' : ''
    } ${active ? activeClass : inactiveClass}`;

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-60'} transition-all duration-300 ease-in-out
        border-r border-[#1c1f26] bg-[#000000] flex flex-col flex-shrink-0`}
    >
      {/* ── Cabeçalho ── */}
      <div
        className={`flex items-center border-b border-[#1c1f26] mb-4
          ${collapsed ? 'justify-center py-5 px-2' : 'justify-between px-4 pt-4 pb-3'}`}
      >
        {!collapsed && (
          <div className="min-w-0">
            <Logo height={60} />
            {subtitle && (
              <p className="meta mt-1 uppercase tracking-wider text-[10px]">{subtitle}</p>
            )}
          </div>
        )}
        <button
          onClick={toggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="p-1.5 rounded-md text-[#434d5e] hover:text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors flex-shrink-0"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Itens de navegação ── */}
      <nav className="space-y-1 flex-1 px-2">
        {items.map((item) => {
          const Icon = item.icon;

          if (item.to !== undefined) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => base(isActive, collapsed)}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          }

          return (
            <button
              key={item.label}
              onClick={item.onClick}
              title={collapsed ? item.label : undefined}
              className={base(item.isActive, collapsed)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* ── Rodapé ── */}
      <div className="border-t border-[#1c1f26] pt-4 mt-4 px-2 pb-4 space-y-1">
        {!collapsed && profile?.email && (
          <p className="meta px-3 truncate text-xs pb-1">{profile.email}</p>
        )}
        <button
          onClick={onLogout}
          title={collapsed ? 'Sair' : undefined}
          className={base(false, collapsed)}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
