import { useEffect, useState, ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import { PublicMotionContext, PublicMotionContextValue } from './context';
import type { PublicMotionMode } from '../types';

const loadFeatures = () => import('./motion-features').then((m) => m.default);

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function detectMode(reduceMotion: boolean): PublicMotionMode {
  const connection = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  if (reduceMotion || connection?.saveData || !supportsWebGL()) return 'static';
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = window.matchMedia('(max-width: 767px)').matches;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (coarse || small || (memory !== undefined && memory < 4)) return 'lite';
  return 'full';
}

export function PublicMotionProvider({ children }: { children: ReactNode }) {
  // Começa em 'static': o conteúdo e o poster renderizam antes de qualquer canvas.
  const [value, setValue] = useState<PublicMotionContextValue>({ mode: 'static', reduceMotion: false });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      const reduceMotion = media.matches;
      setValue({ mode: detectMode(reduceMotion), reduceMotion });
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return (
    <PublicMotionContext.Provider value={value}>
      <LazyMotion features={loadFeatures} strict>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </LazyMotion>
    </PublicMotionContext.Provider>
  );
}
