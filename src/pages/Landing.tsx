import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle, Users, Layers, ShieldCheck, Sparkles, BookOpen, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Logo';

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-[#d6deed] overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-[#1c1f26] bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-28 flex items-center justify-between">
          <Logo height={96} />
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a href="#recursos" className="hover:text-[#cbfb00] transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-[#cbfb00] transition-colors">Como funciona</a>
            <a href="#para-quem" className="hover:text-[#cbfb00] transition-colors">Para quem</a>
          </nav>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#cbfb00] text-black rounded-md font-medium text-sm hover:bg-[#b8e300] transition-colors"
          >
            Entrar <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <section className="relative border-b border-[#1c1f26]">
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #cbfb00 0%, transparent 40%), radial-gradient(circle at 80% 60%, #cbfb00 0%, transparent 45%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#cbfb00]/30 bg-[#cbfb00]/5 rounded-full text-xs text-[#cbfb00] mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              Plataforma de ensino da Matter Academy
            </div>
            <h1 className="!text-[#cbfb00] text-5xl md:text-6xl font-display font-bold leading-[1.05] tracking-tight mb-6">
              Aprenda no seu ritmo.{' '}
              <span className="text-white">Evolua com consistência.</span>
            </h1>
            <p className="text-lg md:text-xl text-[#d6deed] mb-10 max-w-2xl leading-relaxed">
              Uma experiência de estudo focada, com turmas organizadas, trilhas claras e vídeo-aulas
              pensadas para que você chegue mais longe, aula após aula.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#cbfb00] text-black rounded-md font-medium hover:bg-[#b8e300] transition-colors"
              >
                Acessar a plataforma <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#recursos"
                className="inline-flex items-center gap-2 px-6 py-3 border border-[#434d5e] rounded-md font-medium text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors"
              >
                Ver recursos
              </a>
            </div>
            <div className="mt-12 grid grid-cols-3 max-w-md gap-8">
              <Stat value="+1.200" label="Alunos" />
              <Stat value="+50" label="Cursos" />
              <Stat value="98%" label="Retenção" />
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="border-b border-[#1c1f26]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-14">
            <p className="text-[#cbfb00] text-sm font-medium tracking-wider uppercase mb-3">Recursos</p>
            <h2 className="!text-white text-3xl md:text-4xl mb-4">
              Tudo que você precisa para ensinar e estudar sem atrito.
            </h2>
            <p className="text-[#d6deed] text-lg">
              Da organização administrativa ao consumo dos conteúdos, cada detalhe foi pensado para
              priorizar clareza e foco.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <Feature
              icon={<Layers className="w-5 h-5" />}
              title="Turmas organizadas"
              text="Agrupe alunos por turma e controle exatamente quais cursos cada grupo pode acessar."
            />
            <Feature
              icon={<PlayCircle className="w-5 h-5" />}
              title="Vídeo-aulas integradas"
              text="Conteúdo via YouTube com player nativo, progresso por aula e navegação fluida."
            />
            <Feature
              icon={<Users className="w-5 h-5" />}
              title="Administradores, professores e alunos"
              text="Papéis bem definidos para dar a cada pessoa exatamente o acesso que ela precisa."
            />
            <Feature
              icon={<ShieldCheck className="w-5 h-5" />}
              title="Acesso seguro"
              text="Autenticação por email/senha com convites por link e recuperação de acesso."
            />
            <Feature
              icon={<BookOpen className="w-5 h-5" />}
              title="Trilhas claras"
              text="Aulas ordenadas, descrição rica e marcação de conclusão para acompanhar a evolução."
            />
            <Feature
              icon={<Sparkles className="w-5 h-5" />}
              title="Interface focada"
              text="Design minimalista para que nada atrapalhe o essencial: a sua aula."
            />
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-b border-[#1c1f26]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-14">
            <p className="text-[#cbfb00] text-sm font-medium tracking-wider uppercase mb-3">Como funciona</p>
            <h2 className="!text-white text-3xl md:text-4xl mb-4">Três passos para começar.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <Step n={1} title="Receba seu convite" text="O administrador cria sua conta e envia um link único para ativação." />
            <Step n={2} title="Defina sua senha" text="Ative seu acesso em segundos, sem burocracia nem cadastros intermináveis." />
            <Step n={3} title="Estude sem limites" text="Acesse seus cursos, acompanhe o progresso e avance no seu tempo." />
          </div>
        </div>
      </section>

      <section id="para-quem" className="border-b border-[#1c1f26]">
        <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[#cbfb00] text-sm font-medium tracking-wider uppercase mb-3">Para quem</p>
            <h2 className="!text-white text-3xl md:text-4xl mb-6">
              Feito para escolas, estúdios e academias que levam ensino a sério.
            </h2>
            <ul className="space-y-3">
              {[
                'Gestão centralizada de alunos, professores e turmas',
                'Controle granular de acesso a conteúdos',
                'Progresso individual visível para aluno e professor',
                'Experiência premium em qualquer dispositivo',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#cbfb00] flex-shrink-0 mt-0.5" />
                  <span className="text-[#d6deed]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-[#cbfb00]/10 rounded-2xl blur-2xl" />
            <div className="relative border border-[#1c1f26] bg-[#0d0d0d] rounded-2xl p-10 text-center">
              <Logo height={200} className="mx-auto mb-6" />
              <p className="text-[#d6deed] mb-1">Plataforma oficial</p>
              <p className="meta">Tecnologia que respeita o aluno</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1c1f26]">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h2 className="!text-white text-3xl md:text-4xl mb-4">Pronto para continuar sua evolução?</h2>
          <p className="text-[#d6deed] text-lg mb-8">Entre com seus dados e acesse seus cursos agora.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#cbfb00] text-black rounded-md font-medium hover:bg-[#b8e300] transition-colors"
          >
            Acessar a plataforma <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="meta mt-6">
            Ainda não tem acesso? Entre em contato com o administrador da sua instituição.
          </p>
        </div>
      </section>

      <footer className="py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo height={72} />
          <p className="meta">© {new Date().getFullYear()} Matter Academy. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display font-bold text-2xl text-white">{value}</p>
      <p className="meta">{label}</p>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="p-6 bg-[#0d0d0d] border border-[#1c1f26] rounded-lg hover:border-[#cbfb00]/30 transition-colors">
      <div className="w-10 h-10 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center text-[#cbfb00] mb-4">
        {icon}
      </div>
      <h3 className="!text-white !text-lg !font-medium mb-2">{title}</h3>
      <p className="text-sm text-[#d6deed] leading-relaxed">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="p-6 bg-[#0d0d0d] border border-[#1c1f26] rounded-lg">
      <div className="font-display font-bold text-[#cbfb00] text-3xl mb-3">0{n}</div>
      <h3 className="!text-white !text-lg !font-medium mb-2">{title}</h3>
      <p className="text-sm text-[#d6deed] leading-relaxed">{text}</p>
    </div>
  );
}
