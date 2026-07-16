export type TipoCobranca = 'fixo' | 'por_aluno' | 'recorrente_mensal';

export const TIPO_COBRANCA_LABEL: Record<TipoCobranca, string> = {
  fixo: 'Valor fixo',
  por_aluno: 'Por aluno',
  recorrente_mensal: 'Mensal recorrente',
};

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Total calculado da turma conforme o tipo de cobrança. */
export function calcTotal(
  tipo: TipoCobranca | null | undefined,
  valor: number | null | undefined,
  alunos: number,
): number {
  if (!tipo || valor == null) return 0;
  if (tipo === 'por_aluno') return valor * alunos;
  return valor; // fixo e recorrente_mensal usam o valor direto
}

/** Descrição legível do valor de uma turma (ex: "R$ 100,00/aluno × 8 = R$ 800,00"). */
export function describeCobranca(
  tipo: TipoCobranca | null | undefined,
  valor: number | null | undefined,
  alunos: number,
): { total: string; detalhe: string | null } {
  if (!tipo || valor == null) return { total: '—', detalhe: null };
  if (tipo === 'fixo') return { total: formatBRL(valor), detalhe: 'Valor fixo' };
  if (tipo === 'recorrente_mensal') return { total: `${formatBRL(valor)}/mês`, detalhe: 'Mensal recorrente' };
  // por_aluno
  return {
    total: formatBRL(valor * alunos),
    detalhe: `${formatBRL(valor)}/aluno × ${alunos}`,
  };
}
