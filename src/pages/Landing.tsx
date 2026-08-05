import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import { m, useInView, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { PlayCircle, Users, Layers, ShieldCheck, Sparkles, BookOpen, CheckCircle2 } from 'lucide-react';
import { PublicShell } from '../public/components/PublicShell';
import { PublicAction } from '../public/components/PublicAction';
import { PublicLogo } from '../public/components/PublicLogo';
import { Reveal, RevealGroup, RevealItem } from '../public/motion/Reveal';
import { usePublicMotion } from '../public/motion/context';
import { gridDelay, COUNT, DUR_FAST, DUR_SLOW, EASE_OUT } from '../public/motion/variants';

const FEATURES = [
  {
    icon: <Layers className="h-5 w-5" aria-hidden="true" />,
    title: 'Turmas organizadas',
    text: 'Agrupe alunos por turma e controle exatamente quais cursos cada grupo pode acessar.',
  },
  {
    icon: <PlayCircle className="h-5 w-5" aria-hidden="true" />,
    title: 'Vídeo-aulas integradas',
    text: 'Conteúdo via YouTube com player nativo, progresso por aula e navegação fluida.',
  },
  {
    icon: <Users className="h-5 w-5" aria-hidden="true" />,
    title: 'Administradores, professores e alunos',
    text: 'Papéis bem definidos para dar a cada pessoa exatamente o acesso que ela precisa.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    title: 'Acesso seguro',
    text: 'Autenticação por email/senha com convites por link e recuperação de acesso.',
  },
  {
    icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
    title: 'Trilhas claras',
    text: 'Aulas ordenadas, descrição rica e marcação de conclusão para acompanhar a evolução.',
  },
  {
    icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
    title: 'Interface focada',
    text: 'Design minimalista para que nada atrapalhe o essencial: a sua aula.',
  },
];

export default function Landing() {
  return (
    <PublicShell>
      {/* Hero — conteúdo ~7/12, cena no espaço à direita */}
      <section className="relative">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-24 pt-16 md:pt-24 lg:min-h-[calc(100vh-96px)] lg:grid-cols-12 lg:items-center lg:pb-28">
          <div className="lg:col-span-7">
            <Reveal>
              <span className="pub-badge mb-8 inline-flex">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Plataforma de ensino da Matter Academy
              </span>
            </Reveal>
            <h1 className="pub-hero-title mb-6">
              <Reveal as="span" className="block text-[color:var(--pub-lime)]" delay={0.07}>
                Aprenda no seu ritmo.
              </Reveal>
              <Reveal as="span" className="block" delay={0.14}>
                Evolua com consistência.
              </Reveal>
            </h1>
            <Reveal as="p" className="pub-lead mb-10 max-w-2xl" delay={0.21}>
              Uma experiência de estudo focada, com turmas organizadas, trilhas claras e vídeo-aulas
              pensadas para que você chegue mais longe, aula após aula.
            </Reveal>
            <Reveal className="flex flex-wrap gap-3" delay={0.28}>
              <PublicAction to="/login" glow arrow>
                Acessar a plataforma
              </PublicAction>
              <PublicAction href="#recursos" variant="ghost">
                Ver recursos
              </PublicAction>
            </Reveal>
            <Reveal className="mt-12 grid max-w-md grid-cols-3 gap-8" delay={0.35}>
              <Stat value={1200} prefix="+" label="Alunos" />
              <Stat value={50} prefix="+" label="Cursos" />
              <Stat value={98} suffix="%" label="Retenção" />
            </Reveal>
          </div>
          <div className="hidden lg:col-span-5 lg:block" aria-hidden="true" />
        </div>
      </section>

      <section id="recursos" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <Reveal className="mb-14 max-w-2xl">
            <p className="pub-eyebrow mb-3">Recursos</p>
            <h2 className="mb-4">Tudo que você precisa para ensinar e estudar sem atrito.</h2>
            <p className="pub-lead">
              Da organização administrativa ao consumo dos conteúdos, cada detalhe foi pensado para
              priorizar clareza e foco.
            </p>
          </Reveal>
          {/* Stagger espacial: os sinais propagam a partir do card mais próximo
              da cena (superior direito na grade lg de 3 colunas). */}
          <RevealGroup stagger={0} className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <RevealItem key={f.title} className="h-full" delay={gridDelay(i, 3, 2)}>
                <FeatureCard icon={f.icon} title={f.title} text={f.text} />
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <Reveal className="mb-14 max-w-2xl">
            <p className="pub-eyebrow mb-3">Como funciona</p>
            <h2>Três passos para começar.</h2>
          </Reveal>
          <StepsFlow />
        </div>
      </section>

      <section id="para-quem" className="scroll-mt-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-24">
          <Reveal>
            <p className="pub-eyebrow mb-3">Para quem</p>
            <h2 className="mb-6">Feito para escolas, estúdios e academias que levam ensino a sério.</h2>
            <ul className="space-y-3">
              {[
                'Gestão centralizada de alunos, professores e turmas',
                'Controle granular de acesso a conteúdos',
                'Progresso individual visível para aluno e professor',
                'Experiência premium em qualquer dispositivo',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[color:var(--pub-lime)]" aria-hidden="true" />
                  <span className="text-[color:var(--pub-fg-soft)]">{t}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <PortalPosterCard />
          </Reveal>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-4xl px-6 py-20 md:py-24">
          <Reveal className="pub-cta-surface px-6 py-16 text-center sm:px-12">
            <h2 className="mb-4">Pronto para continuar sua evolução?</h2>
            <p className="pub-lead mb-8">Entre com seus dados e acesse seus cursos agora.</p>
            <PublicAction to="/login" size="lg" glow arrow>
              Acessar a plataforma
            </PublicAction>
            <p className="pub-meta mt-6">
              Ainda não tem acesso? Entre em contato com o administrador da sua instituição.
            </p>
          </Reveal>
        </div>
      </section>
    </PublicShell>
  );
}

/** Número que sobe de 0 ao valor, uma única vez, ao entrar em vista. */
function Stat({
  value,
  label,
  prefix = '',
  suffix = '',
}: {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
}) {
  const { reduceMotion } = usePublicMotion();
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView || reduceMotion) return;
    // Contador via rAF (sem puxar o runtime de animação pro bundle inicial);
    // desaceleração firme, final preciso, sem overshoot — regra do DS.
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now + COUNT.delay * 1000;
      const t = Math.min(Math.max((now - start) / (COUNT.duration * 1000), 0), 1);
      const e = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduceMotion, value]);

  const shown = reduceMotion ? value : display;
  return (
    <div>
      <p ref={ref} className="text-[28px] font-medium tabular-nums text-[color:var(--pub-fg)]">
        {prefix}
        {new Intl.NumberFormat('pt-BR').format(shown)}
        {suffix}
      </p>
      <p className="pub-meta mt-1 uppercase tracking-[0.14em]">{label}</p>
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  const { reduceMotion } = usePublicMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const fine = useRef(false);

  useEffect(() => {
    fine.current = window.matchMedia('(pointer: fine)').matches;
  }, []);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!fine.current || reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const dy = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    // Inclinação máxima de 2°
    ry.set(dx * 2);
    rx.set(-dy * 2);
  };

  const onPointerLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <m.div
      className="pub-card pub-card--hover group h-full"
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 700 }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-[rgba(204,252,0,0.2)] bg-[rgba(204,252,0,0.1)] text-[color:var(--pub-lime)] [transition:transform_var(--pub-dur-base)_var(--pub-ease-out)] group-hover:-translate-y-1">
        {icon}
      </div>
      <h3 className="pub-card-title mb-2">{title}</h3>
      <p className="text-sm leading-relaxed text-[color:var(--pub-fg-soft)]">{text}</p>
    </m.div>
  );
}

/** Thresholds em que o preenchimento "alcança" cada passo — iguais às posições
    dos nós no trilho (centros dos 3 cards), gatilhos discretos (§2, onscroll). */
const STEP_NODE_THRESHOLDS = [0.167, 0.5, 0.833] as const;

/** Nó do trilho: pop de 140ms + anel de confirmação único ao acender. */
function StepNode({ lit, className, style }: { lit: boolean; className?: string; style?: CSSProperties }) {
  const { reduceMotion } = usePublicMotion();
  const cls = `absolute h-2 w-2 rounded-full bg-[color:var(--pub-lime)] shadow-[0_0_10px_rgba(204,252,0,0.55)] ${className ?? ''}`;
  // Reduced motion: o nó renderiza aceso (estado final), sem pop nem atraso.
  if (reduceMotion) return <span aria-hidden="true" data-step-node="" className={cls} style={style} />;
  return (
    <m.span
      aria-hidden="true"
      data-step-node=""
      className={cls}
      style={style}
      initial={false}
      animate={lit ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0.25 }}
      transition={{ duration: DUR_FAST, ease: EASE_OUT }}
    >
      <m.span
        className="absolute inset-0 rounded-full border border-[color:var(--pub-lime)]"
        initial={false}
        animate={lit ? { scale: [0.6, 2.2], opacity: [0.6, 0] } : { scale: 0.6, opacity: 0 }}
        transition={{ duration: DUR_SLOW, ease: EASE_OUT }}
      />
    </m.span>
  );
}

function StepsFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const { reduceMotion } = usePublicMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.65'] });

  // Regime discreto (distinto do scrub do trilho): quantos nós já foram alcançados.
  const [litCount, setLitCount] = useState(0);
  useEffect(() => {
    // Cobre chegada via âncora (#como-funciona): sincroniza com o valor atual.
    setLitCount(STEP_NODE_THRESHOLDS.filter((t) => scrollYProgress.get() >= t).length);
  }, [scrollYProgress]);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setLitCount(STEP_NODE_THRESHOLDS.filter((t) => v >= t).length);
  });

  // Frente luminosa: acompanha o preenchimento do trilho (transform puro).
  const tipLeft = useTransform(scrollYProgress, (v) => `${Math.min(Math.max(v, 0), 1) * 100}%`);

  return (
    <div ref={ref} className="relative">
      {/* Trilho de continuidade (desktop): preenchimento por scroll + frente
          luminosa + nós nos centros dos cards. Sem SVG esticado — só
          transform/opacity, sem distorção. */}
      <div className="pointer-events-none absolute -top-7 left-0 right-0 hidden h-px md:block" aria-hidden="true">
        <div className="absolute inset-0 rounded-full bg-[rgba(255,255,255,0.08)]" />
        <m.div
          className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-[rgba(204,252,0,0.2)] to-[color:var(--pub-lime)]"
          style={{ scaleX: reduceMotion ? 1 : scrollYProgress }}
        />
        {!reduceMotion && (
          <m.span
            className="absolute top-1/2 h-[7px] w-[7px] rounded-full bg-[color:var(--pub-lime)] shadow-[0_0_12px_rgba(204,252,0,0.9)]"
            style={{ left: tipLeft, x: '-50%', y: '-50%' }}
          />
        )}
        {STEP_NODE_THRESHOLDS.map((t, i) => (
          <StepNode key={t} lit={i < litCount} style={{ left: `calc(${t * 100}% - 4px)`, top: -3.5 }} />
        ))}
      </div>
      {/* Eixo vertical no mobile */}
      <div className="absolute bottom-2 left-[3px] top-2 w-px bg-[rgba(255,255,255,0.08)] md:hidden" aria-hidden="true">
        <m.div
          className="h-full w-full origin-top bg-[color:var(--pub-lime)]"
          style={{ scaleY: reduceMotion ? 1 : scrollYProgress }}
        />
        {/* Nós sobre o eixo (mobile), nos mesmos thresholds */}
        {STEP_NODE_THRESHOLDS.map((t, i) => (
          <StepNode key={t} lit={i < litCount} style={{ left: -3.5, top: `calc(${t * 100}% - 4px)` }} />
        ))}
      </div>

      <RevealGroup className="grid gap-5 pl-6 md:grid-cols-3 md:pl-0">
        <RevealItem className="h-full">
          <StepCard n="01" title="Receba seu convite" text="O administrador cria sua conta e envia um link único para ativação." />
        </RevealItem>
        <RevealItem className="h-full">
          <StepCard n="02" title="Defina sua senha" text="Ative seu acesso em segundos, sem burocracia nem cadastros intermináveis." />
        </RevealItem>
        <RevealItem className="h-full">
          <StepCard n="03" title="Estude sem limites" text="Acesse seus cursos, acompanhe o progresso e avance no seu tempo." />
        </RevealItem>
      </RevealGroup>
    </div>
  );
}

function StepCard({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="pub-step h-full">
      <div className="pub-step__n mb-3">{n}</div>
      <h3 className="pub-step-title mb-2 font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-[color:var(--pub-fg-soft)]">{text}</p>
    </div>
  );
}

function PortalPosterCard() {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="pub-card overflow-hidden p-0">
      <div className="relative aspect-[4/3] bg-[color:var(--pub-ink)]">
        {imgOk ? (
          <img
            src="/posters/matter-portal.webp"
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={() => setImgOk(false)}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: '68% 45%' }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <PublicLogo height={110} />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(11,13,16,0.75) 100%)' }}
          aria-hidden="true"
        />
        <div className="absolute bottom-0 left-0 p-6">
          <p className="mb-1 text-[color:var(--pub-fg)]">Plataforma oficial</p>
          <p className="pub-meta">Tecnologia que respeita o aluno</p>
        </div>
      </div>
    </div>
  );
}
