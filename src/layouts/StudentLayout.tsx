import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, MessageSquare, LogOut, ClipboardList, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

export default function StudentLayout() {
  const { signOut, profile } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const logout = async () => { await signOut(); nav('/login'); };

  const { pathname } = location;
  const isAulas      = pathname === '/dashboard' || pathname.startsWith('/curso/');
  const isComunidade = pathname === '/comunidade' || pathname.startsWith('/turma/');
  const isAtividades = pathname === '/atividades' || pathname.startsWith('/atividades/');
  const isDuvidas    = pathname === '/duvidas';

  const navClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      active ? 'bg-[#cbfb00] text-black font-medium' : 'text-[#d6deed] hover:bg-[#434d5e]/20'
    }`;

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-[#1c1f26] bg-[#000000] p-4 flex flex-col flex-shrink-0">
        <div className="mb-10 px-2">
          <Logo height={88} />
        </div>

        <nav className="space-y-1 flex-1">
          <button onClick={() => nav('/dashboard')} className={navClass(isAulas)}>
            <BookOpen className="w-4 h-4" />
            Aulas
          </button>
          <button onClick={() => nav('/atividades')} className={navClass(isAtividades)}>
            <ClipboardList className="w-4 h-4" />
            Atividades
          </button>
          <button onClick={() => nav('/duvidas')} className={navClass(isDuvidas)}>
            <HelpCircle className="w-4 h-4" />
            Dúvidas
          </button>
          <button onClick={() => nav('/comunidade')} className={navClass(isComunidade)}>
            <MessageSquare className="w-4 h-4" />
            Comunidade
          </button>
        </nav>

        <div className="border-t border-[#1c1f26] pt-4 mt-4">
          <p className="meta px-2 truncate text-xs">{profile?.email}</p>
          <button onClick={logout} className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <Outlet />
      </main>
    </div>
  );
}
