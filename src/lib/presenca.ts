/* Presença/chamada nas aulas — tipos, rótulos e a marcação automática do aluno.
   A tabela `presencas` ainda não está no schema gerado, por isso os acessos
   usam `supabase as any`, como no restante do código que trata tabelas novas. */
import { supabase } from './supabase';

export type OrigemPresenca =
  | 'plataforma_ao_vivo'
  | 'plataforma_gravado'
  | 'teams_importado'
  | 'manual_professor';

export type Presenca = {
  id: string;
  aula_id: string;
  user_id: string;
  turma_id: string;
  origem: OrigemPresenca;
  percentual_assistido: number | null;
  presente: boolean;
  editado_por: string | null;
  criado_em: string;
  atualizado_em: string;
};

export const ORIGEM_LABEL: Record<OrigemPresenca, string> = {
  plataforma_ao_vivo: 'Plataforma — ao vivo',
  plataforma_gravado: 'Plataforma — gravação',
  teams_importado: 'Teams',
  manual_professor: 'Lançada pelo professor',
};

export const ORIGEM_TONE: Record<OrigemPresenca, 'success' | 'info' | 'warn' | 'default'> = {
  plataforma_ao_vivo: 'success',
  plataforma_gravado: 'info',
  teams_importado: 'warn',
  manual_professor: 'default',
};

/** Percentual do vídeo que precisa ser assistido para marcar presença. */
export const LIMITE_PRESENCA_PCT = 80;

/** O aluno pode entrar um pouco antes do horário marcado e ainda contar como ao vivo. */
const TOLERANCIA_ANTES_MIN = 30;
/** Usada quando a turma não tem horário de início/fim cadastrado em curso_turmas. */
const DURACAO_PADRAO_MIN = 180;

/** Duração da aula a partir dos horários da turma (`HH:MM[:SS]`), em minutos. */
export function duracaoAulaMin(horarioInicio: string | null, horarioFim: string | null): number {
  if (!horarioInicio || !horarioFim) return DURACAO_PADRAO_MIN;
  const min = (h: string) => {
    const [hh, mm] = h.split(':').map(Number);
    return hh * 60 + mm;
  };
  const diff = min(horarioFim) - min(horarioInicio);
  return diff > 0 ? diff : DURACAO_PADRAO_MIN;
}

/** Se `agora` cai na janela da aula ao vivo agendada em `aula_horarios`. */
export function dentroDaJanelaAoVivo(
  dataHora: string | null | undefined,
  duracaoMin: number,
  agora: Date = new Date(),
): boolean {
  if (!dataHora) return false;
  const inicio = new Date(dataHora).getTime() - TOLERANCIA_ANTES_MIN * 60_000;
  const fim = new Date(dataHora).getTime() + duracaoMin * 60_000;
  const t = agora.getTime();
  return t >= inicio && t <= fim;
}

/**
 * Registra a presença do próprio aluno ao cruzar o limite de tempo assistido.
 *
 * Não sobrescreve presença que já veio do Teams nem lançamento manual do
 * professor — a RLS bloqueia esses casos, e aqui a falha é ignorada de
 * propósito para não interromper a aula com um toast de erro.
 */
export async function registrarPresencaAutomatica(params: {
  aulaId: string;
  userId: string;
  turmaId: string;
  pct: number;
  aoVivo: boolean;
}): Promise<void> {
  const { aulaId, userId, turmaId, pct, aoVivo } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from('presencas').upsert(
    {
      aula_id: aulaId,
      user_id: userId,
      turma_id: turmaId,
      presente: true,
      origem: aoVivo ? 'plataforma_ao_vivo' : 'plataforma_gravado',
      percentual_assistido: Math.round(Math.min(100, pct) * 100) / 100,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'aula_id,user_id,turma_id' },
  );
}
