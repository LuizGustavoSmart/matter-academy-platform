import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { MotionValue } from 'motion/react';
import { usePublicMotion } from '../motion/context';
import type { PublicSceneVariant } from '../types';

const LazyScene = lazy(() => import('./MatterEvolutionScene'));

export type PublicSceneProps = {
  variant: PublicSceneVariant;
  /** Progresso opcional de scroll (0..1) conectado à cena por MotionValue. */
  progress?: MotionValue<number>;
  /** Intro do logo in-hero: o campo forma o chevron antes de dissolver. */
  intro?: boolean;
  className?: string;
};

/**
 * Camada decorativa da cena. Sempre aria-hidden e sem eventos de ponteiro.
 * Renderiza primeiro o poster (fallback real em WebP); o canvas 3D chega
 * depois, em chunk próprio, e faz fade por cima. No modo static só o poster
 * permanece. O loop pausa fora da viewport e com a aba oculta.
 */
export function PublicScene({ variant, progress, intro, className = '' }: PublicSceneProps) {
  const { mode } = usePublicMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [tabActive, setTabActive] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);
  const [posterOk, setPosterOk] = useState(true);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabActive(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const active = visible && tabActive;
  const showCanvas = mode === 'full' || mode === 'lite';

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`pointer-events-none overflow-hidden ${className}`}
    >
      {posterOk && (
        <img
          src="/posters/matter-portal.webp"
          alt=""
          draggable={false}
          onError={() => setPosterOk(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            canvasReady ? 'opacity-0' : 'opacity-100'
          }`}
          style={variant === 'auth' ? { objectPosition: '65% 50%' } : undefined}
        />
      )}
      {showCanvas && (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            canvasReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Suspense fallback={null}>
            <LazyScene
              variant={variant}
              quality={mode === 'full' ? 'full' : 'lite'}
              progress={progress}
              active={active}
              intro={intro}
              onReady={() => setCanvasReady(true)}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
