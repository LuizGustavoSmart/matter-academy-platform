import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { m } from 'motion/react';
import { usePublicMotion } from '../motion/context';
import { delayedFadeRise } from '../motion/Reveal';
import { DUR_SLOW, EASE_OUT, INTRO, STAGGER } from '../motion/variants';

const LazyLogoScene = lazy(() => import('./LogoAssemblyScene'));

/**
 * LogoIntro — splash de abertura: "a marca nasce da matéria".
 * Estilhaços formam o chevron em 3D, as letras "matter academy" revelam-se
 * letra a letra, e o lockup voa até o logo do nav (handoff contínuo).
 * Skippável com qualquer input; roda a cada visita; reduced-motion não monta.
 */

type Phase = 'loading' | 'play' | 'handoff' | 'done';

const WORDS: { text: string; className: string }[] = [
  { text: 'matter', className: 'font-medium' },
  { text: 'academy', className: 'font-light' },
];

export function LogoIntro() {
  const { mode, reduceMotion } = usePublicMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [fly, setFly] = useState<{ x: number; y: number; scale: number } | null>(null);
  const lockupRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const letterCount = WORDS.reduce((n, w) => n + w.text.length, 0);

  const toHandoff = useCallback(() => {
    setPhase((p) => {
      if (p === 'handoff' || p === 'done') return p;
      return 'handoff';
    });
  }, []);

  // Trava o scroll enquanto o splash está ativo
  useEffect(() => {
    if (phase === 'done') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  // Skip com qualquer input
  useEffect(() => {
    if (phase === 'done') return;
    const skip = () => toHandoff();
    const opts = { passive: true } as const;
    window.addEventListener('pointerdown', skip, opts);
    window.addEventListener('wheel', skip, opts);
    window.addEventListener('keydown', skip);
    window.addEventListener('touchstart', skip, opts);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('wheel', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('touchstart', skip);
    };
  }, [phase, toHandoff]);

  // Fallback de segurança: se o chunk 3D não ficar pronto a tempo, pula tudo
  useEffect(() => {
    if (phase !== 'loading') return;
    const id = window.setTimeout(() => setPhase((p) => (p === 'loading' ? 'handoff' : p)), 900);
    return () => window.clearTimeout(id);
  }, [phase]);

  const onSceneReady = useCallback(() => {
    setPhase((p) => (p === 'loading' ? 'play' : p));
  }, []);

  // Timeline: fim do play → handoff (letras + hold), depois desmonta
  useEffect(() => {
    if (phase === 'play') {
      const total = (INTRO.lettersAt + (letterCount - 1) * STAGGER + DUR_SLOW + INTRO.hold) * 1000;
      const id = window.setTimeout(toHandoff, total);
      timers.current.push(id);
      return () => window.clearTimeout(id);
    }
    if (phase === 'handoff') {
      // mede o logo do nav e voa o lockup até lá (crossfade pro PNG real)
      const nav = document.querySelector<HTMLImageElement>('header img[alt="Matter Academy"]');
      const lockup = lockupRef.current;
      if (nav && lockup) {
        const a = lockup.getBoundingClientRect();
        const b = nav.getBoundingClientRect();
        const scale = b.height / a.height;
        setFly({
          x: b.left + b.width / 2 - (a.left + a.width / 2),
          y: b.top + b.height / 2 - (a.top + a.height / 2),
          scale,
        });
      }
      const id = window.setTimeout(() => setPhase('done'), DUR_SLOW * 1000 + 80);
      return () => window.clearTimeout(id);
    }
  }, [phase, letterCount, toHandoff]);

  const letters = useMemo(() => {
    let idx = 0;
    return WORDS.map((w) => ({
      ...w,
      chars: w.text.split('').map((ch) => ({ ch, delay: INTRO.lettersAt + idx++ * STAGGER })),
    }));
  }, []);

  // Reduced-motion (modo static): a intro simplesmente não existe
  if (reduceMotion || mode === 'static' || phase === 'done') return null;

  return (
    <m.div
      aria-hidden="true"
      className="fixed inset-0 z-50 bg-[color:var(--pub-ink)]"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'handoff' ? 0 : 1 }}
      transition={{ duration: DUR_SLOW, ease: EASE_OUT }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <m.div
          ref={lockupRef}
          className="flex items-center gap-6 sm:gap-10"
          initial={false}
          animate={fly ? { x: fly.x, y: fly.y, scale: fly.scale, opacity: 0 } : { x: 0, y: 0, scale: 1, opacity: 1 }}
          transition={{ duration: DUR_SLOW, ease: EASE_OUT }}
        >
          <div className="h-[160px] w-[160px] sm:h-[220px] sm:w-[220px]">
            <Suspense fallback={null}>
              <LazyLogoScene quality={mode === 'full' ? 'full' : 'lite'} onReady={onSceneReady} />
            </Suspense>
          </div>
          <div className="flex flex-col leading-none" style={{ fontFamily: 'var(--pub-font)' }}>
            {letters.map((w) => (
              <span key={w.text} className={`${w.className} text-[40px] tracking-tight text-[#C7CFDD] sm:text-[56px]`}>
                {w.chars.map((c, i) => (
                  <m.span
                    key={`${w.text}-${i}`}
                    className="inline-block"
                    initial="hidden"
                    animate={phase === 'loading' ? 'hidden' : 'visible'}
                    variants={delayedFadeRise}
                    custom={c.delay}
                  >
                    {c.ch}
                  </m.span>
                ))}
              </span>
            ))}
          </div>
        </m.div>
      </div>
    </m.div>
  );
}
