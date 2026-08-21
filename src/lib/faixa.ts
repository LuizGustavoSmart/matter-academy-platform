export type Faixa = 'branca' | 'verde' | 'marrom' | 'preta';

export const FAIXA_OPTIONS: { value: Faixa; label: string }[] = [
  { value: 'branca', label: 'Faixa Branca' },
  { value: 'verde', label: 'Faixa Verde' },
  { value: 'marrom', label: 'Faixa Marrom' },
  { value: 'preta', label: 'Faixa Preta' },
];

const FAIXA_ORDEM: Record<Faixa, number> = { branca: 0, verde: 1, marrom: 2, preta: 3 };

/** Posição da faixa na sequência cronológica fixa. Faixas desconhecidas/ausentes vão para o final. */
export function ordemDaFaixa(faixa: string | null | undefined): number {
  return faixa && faixa in FAIXA_ORDEM ? FAIXA_ORDEM[faixa as Faixa] : 999;
}

export function labelDaFaixa(faixa: string | null | undefined): string | null {
  return FAIXA_OPTIONS.find((o) => o.value === faixa)?.label ?? null;
}

/** Cor sólida de cada faixa, usada no dot/badge da faixa (perfil, cronograma). */
export const FAIXA_DOT_CLASS: Record<string, string> = {
  branca: 'bg-white border border-line-strong',
  verde: 'bg-emerald-500',
  marrom: 'bg-amber-800',
  preta: 'bg-neutral-900 border border-white/20',
};
