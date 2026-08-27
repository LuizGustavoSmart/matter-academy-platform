import { supabase, callFn } from './supabase';

export type NotifyAction = 'nova_aula' | 'nova_atividade' | 'atividade_corrigida' | 'nova_submissao';

export type NotifyRecipient = { user_id: string; email: string; nome?: string | null };

/** Alunos matriculados numa turma+curso (mesma fonte usada nas telas de correção). */
export async function studentsOfTurmaCurso(turmaId: string, cursoId: string): Promise<NotifyRecipient[]> {
  const { data: ut } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId).eq('curso_id', cursoId);
  const userIds = (ut ?? []).map((r) => r.user_id);
  if (!userIds.length) return [];
  const { data: profiles } = await supabase.from('profiles').select('id,email,nome,role').in('id', userIds);
  return (profiles ?? [])
    .filter((p) => p.role === 'student')
    .map((p) => ({ user_id: p.id, email: p.email, nome: p.nome }));
}

/** Professores/monitores responsáveis por uma turma+curso (mesmo critério de src/lib/turmaStaff.ts). */
export async function staffOfTurmaCurso(turmaId: string, cursoId: string): Promise<NotifyRecipient[]> {
  // is_staff ainda não está no schema gerado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: ut } = await sb.from('user_turmas').select('user_id,curso_id,is_staff').eq('turma_id', turmaId);
  const userIds = ((ut ?? []) as { user_id: string; curso_id: string | null; is_staff: boolean }[])
    .filter((r) => r.is_staff && (r.curso_id === null || r.curso_id === cursoId))
    .map((r) => r.user_id);
  if (!userIds.length) return [];
  const { data: profiles } = await supabase.from('profiles').select('id,email,nome,role').in('id', userIds);
  return (profiles ?? [])
    .filter((p) => p.role === 'professor' || p.role === 'monitor')
    .map((p) => ({ user_id: p.id, email: p.email, nome: p.nome }));
}

/**
 * Dispara notificação in-app + e-mail via a edge function "notify-events".
 * Fire-and-forget: falha no envio não deve travar o fluxo que a chamou.
 */
export async function notify(action: NotifyAction, recipients: NotifyRecipient[], titulo: string, mensagem: string, link: string) {
  if (!recipients.length) return;
  try {
    await callFn('notify-events', action, { recipients, titulo, mensagem, link });
  } catch (e) {
    console.error('[notify]', action, (e as Error).message);
  }
}
