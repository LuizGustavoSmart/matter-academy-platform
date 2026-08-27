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

  // Embaixador é aluno em algumas turmas e acompanha métricas em outras, e
  // professor/monitor dá aula em algumas turmas e é aluno em outras — em
  // ambos os casos o menu combina as duas visões em seções separadas.
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
    : isStaff
    ? [
        {
          title: 'Área do Aluno',
          items: [
            { to: '/dashboard', label: 'Menu', icon: Home, match: (p) => p === '/dashboard' },
            { to: '/aulas', label: 'Aulas', icon: BookOpen, match: (p) => p.startsWith('/aulas') || p.startsWith('/curso/') },
            { to: '/cronograma', label: 'Cronograma', icon: CalendarDays, match: (p) => p.startsWith('/cronograma') },
            { to: '/atividades', label: 'Atividades', icon: ClipboardList, match: (p) => p.startsWith('/atividades') || p.startsWith('/atividade/') },
            { to: '/duvidas', label: 'Dúvidas', icon: HelpCircle, match: (p) => p.startsWith('/duvidas') && !p.startsWith('/gestao/') },
            { to: '/comunidade', label: 'Comunidade', icon: MessageSquare, match: (p) => (p === '/comunidade' || p.startsWith('/turma/')) && !p.startsWith('/gestao/') },
          ],
        },
        {
          title: 'Área do professor',
          items: [
            { to: '/turmas', label: 'Cursos', icon: Layers, match: (p) => p.startsWith('/turmas') },
            { to: '/gestao/duvidas', label: 'Dúvidas', icon: HelpCircle, match: (p) => p.startsWith('/gestao/duvidas') },
            { to: '/gestao/comunidade', label: 'Comunidade', icon: MessageSquare, match: (p) => p.startsWith('/gestao/comunidade') },
          ],
        },
      ]
    : [
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
      ];

  return (
    <>
      <AppShell nav={nav} contentPadded={false} />
      {(profile?.role === 'student' || isEmbaixador) && <OnboardingTour />}
    </>
  );
}
