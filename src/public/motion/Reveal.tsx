import { ReactNode } from 'react';
import { m, Variants } from 'motion/react';
import { usePublicMotion } from './context';
import { fadeRise, staggerParent, viewportOnce, EASE_OUT, DUR_SLOW } from './variants';

/* Variants dinâmicos: o delay entra na transição do próprio variant. */
export const delayedFadeRise: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: DUR_SLOW, ease: EASE_OUT, delay },
  }),
};

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Atraso adicional em segundos (usado nas sequências do hero). */
  delay?: number;
  as?: 'div' | 'section' | 'span' | 'p' | 'li' | 'footer';
};

/** Revela o conteúdo uma única vez ao entrar na viewport (fade + rise do DS). */
export function Reveal({ children, className, delay = 0, as = 'div' }: RevealProps) {
  const { reduceMotion } = usePublicMotion();
  if (reduceMotion) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }
  const Tag = m[as];
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={delayedFadeRise}
      custom={delay}
    >
      {children}
    </Tag>
  );
}

/**
 * Contêiner que revela os filhos diretos uma única vez.
 * Por padrão aplica stagger linear de 70ms; passe stagger={0} quando os
 * filhos definirem seus próprios atrasos (ex.: gridDelay espacial).
 */
export function RevealGroup({
  children,
  className,
  stagger,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const { reduceMotion } = usePublicMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  const variants: Variants =
    stagger === undefined
      ? staggerParent
      : { hidden: {}, visible: { transition: { staggerChildren: stagger } } };
  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={variants}
    >
      {children}
    </m.div>
  );
}

/** Item filho de um RevealGroup. `delay` permite stagger espacial (gridDelay). */
export function RevealItem({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { reduceMotion } = usePublicMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  if (delay !== undefined) {
    return (
      <m.div className={className} variants={delayedFadeRise} custom={delay}>
        {children}
      </m.div>
    );
  }
  return (
    <m.div className={className} variants={fadeRise}>
      {children}
    </m.div>
  );
}
