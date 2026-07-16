import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, MessageSquare, ClipboardList, HelpCircle, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AppSidebar } from './AppSidebar';

export default function StudentLayout() {
  const { signOut, profile } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const logout = async () => { await signOut(); nav('/login'); };

  const isStaff       = profile?.role === 'professor' || profile?.role === 'monitor';
  const isAulas       = location.pathname === '/dashboard' || location.pathname.startsWith('/curso/');
  const isComunidade  = location.pathname === '/comunidade' || location.pathname.startsWith('/turma/');
  const isAtividades  = location.pathname.startsWith('/atividades') || location.pathname.startsWith('/atividade/');
  const isDuvidas     = location.pathname.startsWith('/duvidas');
  const isTurmas      = location.pathname.startsWith('/turmas');

  const items = [
    { label: 'Aulas',      icon: BookOpen,      onClick: () => nav('/dashboard'),   isActive: isAulas      },
    ...(isStaff ? [{ label: 'Turmas', icon: Layers, onClick: () => nav('/turmas'), isActive: isTurmas }] : []),
    { label: 'Atividades', icon: ClipboardList, onClick: () => nav('/atividades'),  isActive: isAtividades },
    { label: 'Dúvidas',    icon: HelpCircle,     onClick: () => nav('/duvidas'),     isActive: isDuvidas    },
    { label: 'Comunidade', icon: MessageSquare, onClick: () => nav('/comunidade'),  isActive: isComunidade },
  ];

  return (
    <div className="min-h-screen flex">
      <AppSidebar
        items={items}
        profile={profile}
        onLogout={logout}
      />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <Outlet />
      </main>
    </div>
  );
}
