import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type ProfileLike = { id: string; role: string } | null | undefined;

/**
 * Verifica, para o curso específico dentro da turma, se o usuário dá aula
 * nele (staff) — não basta o role global nem a turma (o mesmo professor pode
 * dar aula em um curso da turma e ser aluno normal em outro).
 * Linhas antigas (curso_id NULL, de antes do toggle por curso) ainda contam
 * como staff da turma inteira, para compatibilidade com cadastros antigos.
 */
export async function isStaffOfTurma(profile: ProfileLike, turmaId: string | null | undefined, cursoId?: string | null): Promise<boolean> {
  if (!profile || !turmaId) return false;
  if (profile.role === 'admin') return true;
  if (profile.role !== 'professor' && profile.role !== 'monitor') return false;
  // is_staff ainda não está no schema gerado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('user_turmas').select('curso_id,is_staff').eq('user_id', profile.id).eq('turma_id', turmaId);
  return ((data ?? []) as { curso_id: string | null; is_staff: boolean }[])
    .some((r) => r.is_staff && (r.curso_id === null || !cursoId || r.curso_id === cursoId));
}

/** Versão em hook: null enquanto carrega, depois true/false. */
export function useIsStaffOfTurma(profile: ProfileLike, turmaId: string | null | undefined, cursoId?: string | null): boolean | null {
  const [staff, setStaff] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    setStaff(null);
    isStaffOfTurma(profile, turmaId, cursoId).then((v) => { if (active) setStaff(v); });
    return () => { active = false; };
  }, [profile, turmaId, cursoId]);
  return staff;
}
