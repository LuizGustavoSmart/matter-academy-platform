import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Users, Layers, BookOpen, PlayCircle, LogOut, GraduationCap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

const items = [
  { to: '/admin/usuarios',    label: 'Usuários',     icon: Users },
  { to: '/admin/turmas',      label: 'Turmas',        icon: Layers },
  { to: '/admin/professores', label: 'Professores',   icon: GraduationCap },
  { to: '/admin/cursos',      label: 'Cursos',        icon: BookOpen },
  { to: '/admin/aulas',       label: 'Aulas',         icon: PlayCircle },
];

export default function AdminLayout() {
  const { signOut, profile } = useAuth();
  const nav = useNavigate();

  const logout = async () => {
    await signOut();
    nav('/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-[#1c1f26] bg-[#000000] p-4 flex flex-col">
        <div className="mb-10 px-2">
          <Logo height={88} />
          <p className="meta mt-2 uppercase tracking-wider">Painel admin</p>
        </div>

        <nav className="space-y-1 flex-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin/turmas' ? false : true}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-[#cbfb00] text-black font-medium' : 'text-[#d6deed] hover:bg-[#434d5e]/20'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[#1c1f26] pt-4 mt-4">
          <p className="meta px-2 truncate">{profile?.email}</p>
          <button onClick={logout} className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 scrollbar-thin">
        <Outlet />
      </main>
    </div>
  );
}
