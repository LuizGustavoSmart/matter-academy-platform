import { useEffect, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, useToast } from '../../components/ui';

const STEPS = [
  { to: '/dashboard', title: 'Menu', description: 'Sua visão geral: progresso nas faixas, próxima aula ao vivo e atividades pendentes.' },
  { to: '/aulas', title: 'Aulas', description: 'Todos os cursos (faixas) que você tem acesso, com o quanto já concluiu de cada um.' },
  { to: '/cronograma', title: 'Cronograma', description: 'Um calendário com as datas das aulas ao vivo e os prazos das suas atividades.' },
  { to: '/atividades', title: 'Atividades', description: 'Envie suas atividades e acompanhe as notas e comentários dos professores.' },
  { to: '/duvidas', title: 'Dúvidas', description: 'Tire dúvidas direto de qualquer aula e acompanhe as respostas por aqui.' },
  { to: '/comunidade', title: 'Comunidade', description: 'Converse com colegas e professores da sua turma, por curso.' },
];

export default function OnboardingTour() {
  const { profile, refresh } = useAuth();
  const toast = useToast();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (profile && profile.role === 'student' && profile.tour_visto === false) {
      setShowWelcome(true);
    }
  }, [profile]);

  const markVisto = async () => {
    if (!profile) return;
    // tour_visto ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('profiles').update({ tour_visto: true }).eq('id', profile.id);
    refresh();
  };

  const skip = async () => {
    setShowWelcome(false);
    await markVisto();
  };

  const startTour = () => {
    setShowWelcome(false);
    const tour = driver({
      showProgress: true,
      nextBtnText: 'Avançar',
      prevBtnText: 'Voltar',
      doneBtnText: 'Concluir',
      progressText: '{{current}} de {{total}}',
      steps: STEPS.map((s) => ({
        element: `[data-tour="${s.to}"]`,
        popover: { title: s.title, description: s.description },
      })),
      onDestroyed: () => {
        markVisto();
        toast.success('Bons estudos! 🎓');
      },
    });
    tour.drive();
  };

  if (!showWelcome) return null;

  const firstName = (profile?.nome || '').split(' ')[0];

  return (
    <Modal open={showWelcome} onClose={skip} title="">
      <div className="text-center py-4">
        <h1 className="text-2xl font-display font-semibold text-fg mb-3">
          {firstName ? `Bem-vindo(a), ${firstName}!` : 'Bem-vindo(a)!'}
        </h1>
        <p className="text-fg-2 text-sm mb-2">
          Preparamos uma experiência pensada para você aprender no seu ritmo, com tudo mais fácil de acompanhar.
        </p>
        <p className="text-fg-2 text-sm mb-6">
          A seguir, faremos um tour pela nossa plataforma para apresentar cada uma das seções!
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={skip}>Pular</Button>
          <Button variant="primary" onClick={startTour}>Iniciar tour</Button>
        </div>
      </div>
    </Modal>
  );
}
