import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Users, Layers, BookOpen, PlayCircle, LogOut, LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

const items = [
  { to: '/admin',          label: 'Visão Geral', icon: LayoutDashboard },
  { to: '/admin/usuarios', label: 'Usuários',    icon: Users },
  { to: '/admin/turmas',   label: 'Turmas',      icon: Layers },
  { to: '/admin/cursos',   label: 'Cursos',      icon: BookOpen },
  { to: '/admin/aulas',    label: 'Aulas',       icon: PlayCircle },
];

export default function AdminLayout() {
  const { signOut, profile } = useAuth();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('admin-sb') === '1'
  );

  const toggle = () => setCollapsed(c => {
    localStorage.setItem('admin-sb', c ? '0' : '1');
    return !c;
  });

  const logout = async () => {
    await signOut();
    nav('/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside
        className={`${collapsed ? 'w-16' : 'w-60'} border-r border-[#1c1f26] bg-[#000000] flex flex-col flex-shrink-0 transition-[width] duration-200 overflow-hidden`}
      >
        <div className={`flex flex-col flex-1 ${collapsed ? 'p-2' : 'p-4'}`}>

          <div className={`mb-10 ${collapsed ? 'h-[108px]' : 'px-2'}`}>
            {!collapsed && (
              <>
                <Logo height={88} />
                <p className="meta mt-2 uppercase tracking-wider">Painel admin</p>
              </>
            )}
          </div>

          <nav className="space-y-1 flex-1">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/admin/turmas' ? false : true}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md text-sm transition-colors
                  ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2'}
                  ${isActive
                    ? 'bg-[#cbfb00] text-black font-medium'
                    : 'text-[#d6deed] hover:bg-[#434d5e]/20'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-[#1c1f26] pt-4 mt-4 space-y-1">
            {!collapsed && (
              <p className="meta px-2 truncate mb-2">{profile?.email}</p>
            )}
            <button
              onClick={toggle}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              className={`w-full flex items-center gap-2 rounded-md text-sm text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors
                ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2'}`}
            >
              {collapsed
                ? <ChevronRight className="w-4 h-4" />
                : <><ChevronLeft className="w-4 h-4" /> Recolher</>
              }
            </button>
            <button
              onClick={logout}
              title={collapsed ? 'Sair' : undefined}
              className={`w-full flex items-center gap-2 rounded-md text-sm text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors
                ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2'}`}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && 'Sair'}
            </button>
          </div>

        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 scrollbar-thin">
        <Outlet />
      </main>
    </div>
  );
}
