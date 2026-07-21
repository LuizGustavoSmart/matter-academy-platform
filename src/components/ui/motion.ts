import type { Variants, Transition } from 'motion/react';

export const MA_EASE = [0.22, 1, 0.36, 1] as const; // = var(--ma-ease)
export const MA_DUR_FAST = 0.12;                     // = var(--ma-dur-fast)
export const MA_DUR = 0.2;                           // = var(--ma-dur)
export const MA_STAGGER = 0.035;                     // stagger denso (não "showcase")

export const maTransition: Transition = { duration: MA_DUR, ease: MA_EASE };
export const maTransitionFast: Transition = { duration: MA_DUR_FAST, ease: MA_EASE };
// Spring quase sem overshoot — mais "seco" que o spring-out do CRM Matter (que tem bounce visível)
export const maSpringOut: Transition = { type: 'spring', stiffness: 420, damping: 34 };
export const maSpringPanel: Transition = { type: 'spring', stiffness: 380, damping: 34 };

export const fadeScrim: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: maTransition }, exit: { opacity: 0, transition: maTransitionFast } };
export const scaleIn: Variants = { hidden: { opacity: 0, scale: 0.97, y: 6 }, visible: { opacity: 1, scale: 1, y: 0, transition: maSpringOut }, exit: { opacity: 0, scale: 0.98, y: 4, transition: maTransitionFast } };
export const popIn: Variants = { hidden: { opacity: 0, y: -4, scale: 0.98 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: MA_DUR_FAST, ease: MA_EASE } }, exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: MA_DUR_FAST, ease: MA_EASE } } };
export const slideFromRight: Variants = { hidden: { x: '100%' }, visible: { x: 0, transition: maSpringPanel }, exit: { x: '100%', transition: maSpringPanel } };
export const slideFromLeft: Variants = { hidden: { x: '-100%' }, visible: { x: 0, transition: maSpringPanel }, exit: { x: '-100%', transition: maSpringPanel } };
export const toastIn: Variants = { hidden: { opacity: 0, y: 10, scale: 0.98 }, visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 32 } }, exit: { opacity: 0, scale: 0.96, transition: maTransitionFast } };

// Reservado para a Fase 2 (stagger em grids/listas de páginas específicas)
export const staggerContainer: Variants = { hidden: {}, visible: { transition: { staggerChildren: MA_STAGGER, delayChildren: 0.02 } } };
export const staggerItem: Variants = { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: maTransition } };
