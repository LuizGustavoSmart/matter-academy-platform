import type { Variants, Transition } from 'motion/react';

/** Easing e durações do design system (colors_and_type.css). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const DUR_FAST = 0.14;
export const DUR_BASE = 0.22;
export const DUR_SLOW = 0.38;
export const STAGGER = 0.07;

export const revealTransition: Transition = { duration: DUR_SLOW, ease: EASE_OUT };

/** Entrada padrão do DS: fade + translateY sutil (6–12px), executa uma vez. */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: revealTransition },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: revealTransition },
};

/** Contêiner que revela filhos em sequência (stagger 70ms). */
export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER } },
};

/** Transição rápida entre estados (loading/erro/sucesso) nas telas de auth. */
export const stateSwap: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR_BASE, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: DUR_FAST, ease: EASE_OUT } },
};

export const viewportOnce = { once: true, amount: 0.25 } as const;

/* ============================================================
   Tokens narrativos — "Assembleia" (inteligência ao cubo).
   Marcos de timeline relativa (gramática inspirada no Anime.js,
   implementada nos motores existentes: motion/react + R3F).
   Este módulo só importa TIPOS de motion/react, então pode ser
   consumido pelo chunk 3D sem inflar o bundle.
   ============================================================ */

/**
 * Intro do logo — "a marca nasce da matéria". Timeline relativa (segundos):
 * estilhaços convergem no chevron → fusão + bloom → letras → handoff pro nav.
 */
export const INTRO = {
  /** Convergência dos estilhaços no chevron. */
  converge: 1.1,
  /** Fusão estilhaços → chevron sólido (com o bloom único). */
  fuse: 0.45,
  /** Início da revelação das letras (sobrepõe a fusão, estilo `<<+=`). */
  lettersAt: 1.35,
  /** Pausa com o lockup completo antes do handoff. */
  hold: 0.5,
  /** Voo/escala do lockup até o logo do nav. */
  handoff: 0.55,
  /** Modo in-hero: pausa do chevron antes de dissolver no campo. */
  heroHold: 0.5,
  /** Modo in-hero: duração da cascata chevron → campo. */
  heroDissolve: 0.9,
  /** Estilhaços do splash. */
  shardCount: 90,
} as const;

/** Ato I — a matéria se organiza (uma única vez, no load). Segundos. */
export const ASSEMBLY = {
  /** Duração da viagem de cada peça do estado disperso ao seu lugar. */
  perPiece: 0.9,
  /** Espalhamento máximo dos atrasos por peça (irradiando da clareira). */
  maxSpread: 0.7,
  /** Espalhamento reduzido na variante auth (assembleia curta). */
  maxSpreadAuth: 0.4,
  /** Atraso extra da peça lima após a última peça do campo. */
  standoutLag: 0.25,
  /** Duração do bloom único quando a lima pousa. */
  bloom: 1.2,
  /** Jitter máximo somado ao atraso de cada peça (quebra a regularidade). */
  jitter: 0.12,
} as const;

/**
 * Ato II — morfose em cascata: o scrub entre formações é escalonado por peça
 * (princípio da home do anime.js: o mesmo campo de origem governa a posição
 * na timeline E o valor). Peças próximas à lima partem primeiro.
 */
export const MORPH = {
  /** Fração do scrub reservada ao escalonamento das partidas.
      Maior = menos peças voando ao mesmo tempo → onda sequencial legível. */
  spread: 0.5,
  /** Altura do arco de voo por peça (× distância percorrida). */
  arc: 0.1,
  /** Teto do arco de voo das peças do campo. */
  arcMax: 0.4,
  /** Arco de voo da peça lima entre formações. */
  standoutArc: 0.4,
} as const;

/**
 * Fluidez contínua (referência: landonorris.com — scroll inercial + câmera
 * em coreografia única): o progresso lido pela cena é amortecido por frame,
 * e o conjunto orbita lentamente ao longo da página inteira.
 */
export const FLOW = {
  /** Constante do amortecimento do progresso (1/s) — maior = mais direto. */
  smooth: 5,
  /** Órbita total do conjunto ao longo da página (radianos, ~20°). */
  orbit: 0.35,
} as const;

/** Contagem dos números do hero: sobe uma única vez ao entrar em vista. */
export const COUNT = {
  duration: 1.4,
  /** Espera o reveal do bloco de stats (último da sequência do hero). */
  delay: 0.35,
} as const;

/**
 * Rede de sinais: cada peça liga-se aos vizinhos mais próximos. A rede nasce
 * quando o insight acende (pouso da lima), brilha ao redor dela e é percorrida
 * pela onda de confirmação — "sinais se conectam", literal.
 */
export const NET = {
  /** Vizinhos conectados por peça. */
  neighbors: 2,
  /** Raio de influência da lima sobre o brilho-base dos fios. */
  radius: 2.4,
  /** Brilho-base máximo (junto à lima). */
  base: 0.3,
  /** Ganho do brilho quando a onda de confirmação passa pelo fio. */
  waveGain: 1.1,
  /** Brilho global sutil enquanto uma morfose está em curso. */
  morphGlow: 0.12,
} as const;

/**
 * Cristalização: pirâmide (matéria bruta) → cubo (módulo de conhecimento).
 * Irradia da lima conforme a ordem narrativa avança; no CTA a formação vira
 * um cubo feito de cubos — e a própria lima cristaliza por último.
 */
export const CRYSTAL = {
  /** Avanço da frente de cristalização em relação à ordem global. */
  lead: 1.15,
  /** Espalhamento espacial (peças perto da lima cristalizam primeiro). */
  spread: 0.3,
  /** Tamanho do cubo relativo à pirâmide. */
  size: 0.85,
  /** Mistura de cor para o lima na peça em voo (reorganização visível). */
  flightTint: 0.35,
  /** Janela final em que a lima cristaliza (fração da ordem global). */
  standoutFrom: 0.85,
} as const;

/** Cauda de cometa da lima: intensidade ∝ velocidade — só existe em voo. */
export const TRAIL = {
  length: 14,
  size: 0.5,
  /** Velocidade (un/s) que corresponde à intensidade máxima. */
  speedRef: 2.5,
} as const;

/** Campo de toque (pointer fine + full): a matéria cede ao redor do cursor. */
export const TOUCH = {
  radius: 1.5,
  push: 0.35,
  lift: 0.18,
} as const;

/** Onda de confirmação: frente radial que parte da lima ao completar uma formação. */
export const WAVE = {
  /** Velocidade da frente (unidades de cena por segundo). */
  speed: 3.4,
  /** Largura da frente (gaussiana). */
  width: 0.6,
  /** Pico de escala somado na passagem da frente. */
  amp: 0.1,
} as const;

/** Ato II — pulso com significado: idle mínimo + impulso raro (blend aditivo). */
export const PULSE = {
  /** Amplitude do idle (quase imperceptível). */
  idleAmp: 0.06,
  /** Amplitude extra somada quando uma formação se completa. */
  boostAmp: 0.5,
  /** Constante de decaimento do impulso (segundos). */
  boostDecay: 2.2,
  /** Ciclo do pulso (token do DS). */
  period: 3.4,
} as const;

/**
 * Stagger espacial em grade (princípio "stagger from" do Anime.js):
 * o atraso é proporcional à distância Manhattan até a célula de origem.
 */
export function gridDelay(index: number, cols: number, originIndex: number, step: number = STAGGER): number {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const originRow = Math.floor(originIndex / cols);
  const originCol = originIndex % cols;
  return step * (Math.abs(row - originRow) + Math.abs(col - originCol));
}
