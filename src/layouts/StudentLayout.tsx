import { Home, BookOpen, Layers, ClipboardList, HelpCircle, MessageSquare, CalendarDays } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AppShell, { type NavGroup } from './AppShell';
import OnboardingTour from '../pages/student/OnboardingTour';

export default function StudentLayout() {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';
  const isEmbaixador = profile?.role === 'embaixador';
  const area = profile?.role === 'professor' ? 'Área do professor'
    : profile?.role === 'monitor' ? 'Área do monitor'
    : isEmbaixador ? 'Área do embaixador'
    : 'Área do aluno';

  // Embaixador é aluno em algumas turmas e acompanha métricas em outras — o
  // menu combina as duas visões em seções separadas.
  const nav: NavGroup[] = isEmbaixador
    ? [
        {
          items: [
            { to: '/dashboard', label: 'Menu', icon: Home, match: (p) => p === '/dashboard' },
            { to: '/aulas', label: 'Aulas', icon: BookOpen, match: (p) => p.startsWith('/aulas') || p.startsWith('/curso/') },
            { to: '/cronograma', label: 'Cronograma', icon: CalendarDays, match: (p) => p.startsWith('/cronograma') },
            { to: '/atividades', label: 'Atividades', icon: ClipboardList, match: (p) => p.startsWith('/atividades') || p.startsWith('/atividade/') },
            { to: '/duvidas', label: 'Dúvidas', icon: HelpCircle, match: (p) => p.startsWith('/duvidas') },
            { to: '/comunidade', label: 'Comunidade', icon: MessageSquare, match: (p) => p === '/comunidade' || p.startsWith('/turma/') },
          ],
        },
        {
          title: 'Acompanhar turma',
          items: [
            { to: '/turmas', label: 'Cursos', icon: Layers, match: (p) => p.startsWith('/turmas') },
          ],
        },
      ]
    : [
        {
          items: [
            { to: '/dashboard', label: 'Menu', icon: Home, match: (p) => p === '/dashboard' },
            ...(isStaff ? [] : [{ to: '/aulas', label: 'Aulas', icon: BookOpen, match: (p: string) => p.startsWith('/aulas') || p.startsWith('/curso/') }]),
            { to: '/cronograma', label: 'Cronograma', icon: CalendarDays, match: (p) => p.startsWith('/cronograma') },
            ...(isStaff ? [{ to: '/turmas', label: 'Cursos', icon: Layers, match: (p: string) => p.startsWith('/turmas') }] : []),
            ...(isStaff ? [] : [{ to: '/atividades', label: 'Atividades', icon: ClipboardList, match: (p: string) => p.startsWith('/atividades') || p.startsWith('/atividade/') }]),
            { to: '/duvidas', label: 'Dúvidas', icon: HelpCircle, match: (p) => p.startsWith('/duvidas') },
            { to: '/comunidade', label: 'Comunidade', icon: MessageSquare, match: (p) => p === '/comunidade' || p.startsWith('/turma/') },
          ],
        },
      ];

  return (
    <>
      <AppShell nav={nav} area={area} contentPadded={false} />
      {(profile?.role === 'student' || isEmbaixador) && <OnboardingTour />}
    </>
  );
}
