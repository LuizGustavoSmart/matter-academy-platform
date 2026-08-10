import {
  LayoutDashboard, Users, GraduationCap, Layers,
} from 'lucide-react';
import AppShell, { type NavGroup } from './AppShell';

const nav: NavGroup[] = [
  {
    items: [
      { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, match: (p) => p === '/admin' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { to: '/admin/usuarios', label: 'Usuários', icon: Users },
      { to: '/admin/turmas', label: 'Turmas', icon: Layers },
    ],
  },
  {
    title: 'Acompanhamento',
    items: [
      { to: '/admin/mapa-professores', label: 'Mapa de professores', icon: GraduationCap },
    ],
  },
];

export default function AdminLayout() {
  return <AppShell nav={nav} area="Administração" contentPadded />;
}
