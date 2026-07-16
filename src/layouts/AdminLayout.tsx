import { Outlet, useNavigate } from 'react-router-dom';
import { Users, Layers, LayoutDashboard, GraduationCap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AppSidebar } from './AppSidebar';

const items = [
  { to: '/admin',                  label: 'Visão Geral',      icon: LayoutDashboard, end: true  },
  { to: '/admin/usuarios',         label: 'Usuários',        icon: Users,            end: true  },
  { to: '/admin/turmas',           label: 'Turmas',          icon: Layers,           end: false },
  { to: '/admin/mapa-professores', label: 'Mapa de Professores', icon: GraduationCap, end: true  },
];

export default function AdminLayout() {
  const { signOut, profile } = useAuth();
  const nav = useNavigate();
  const logout = async () => { await signOut(); nav('/login'); };

  return (
    <div className="min-h-screen flex">
      <AppSidebar
        items={items}
        profile={profile}
        onLogout={logout}
        subtitle="Painel admin"
      />
      <main className="flex-1 overflow-y-auto p-8 scrollbar-thin">
        <Outlet />
      </main>
    </div>
  );
}
