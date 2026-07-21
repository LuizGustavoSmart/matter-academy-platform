import { BookOpen, Layers, ClipboardList, HelpCircle, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AppShell, { type NavGroup } from './AppShell';

export default function StudentLayout() {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';
  const area = profile?.role === 'professor' ? 'Área do professor'
    : profile?.role === 'monitor' ? 'Área do monitor'
    : 'Área do aluno';

  const nav: NavGroup[] = [
    {
      items: [
        { to: '/dashboard', label: 'Aulas', icon: BookOpen, match: (p) => p === '/dashboard' || p.startsWith('/curso/') },
        ...(isStaff ? [{ to: '/turmas', label: 'Turmas', icon: Layers, match: (p: string) => p.startsWith('/turmas') }] : []),
        { to: '/atividades', label: 'Atividades', icon: ClipboardList, match: (p) => p.startsWith('/atividades') || p.startsWith('/atividade/') },
        { to: '/duvidas', label: 'Dúvidas', icon: HelpCircle, match: (p) => p.startsWith('/duvidas') },
        { to: '/comunidade', label: 'Comunidade', icon: MessageSquare, match: (p) => p === '/comunidade' || p.startsWith('/turma/') },
      ],
    },
  ];

  return <AppShell nav={nav} area={area} contentPadded={false} />;
}
