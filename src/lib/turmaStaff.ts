import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type ProfileLike = { id: string; role: string } | null | undefined;

/** Verifica, para a turma específica, se o usuário dá aula nela (staff) — não basta o role global. */
export async function isStaffOfTurma(profile: ProfileLike, turmaId: string | null | undefined): Promise<boolean> {
  if (!profile || !turmaId) return false;
  if (profile.role === 'admin') return true;
  if (profile.role !== 'professor' && profile.role !== 'monitor') return false;
  // is_staff ainda não está no schema gerado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('user_turmas').select('is_staff').eq('user_id', profile.id).eq('turma_id', turmaId);
  return ((data ?? []) as { is_staff: boolean }[]).some((r) => r.is_staff);
}

/** Versão em hook: null enquanto carrega, depois true/false. */
export function useIsStaffOfTurma(profile: ProfileLike, turmaId: string | null | undefined): boolean | null {
  const [staff, setStaff] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    setStaff(null);
    isStaffOfTurma(profile, turmaId).then((v) => { if (active) setStaff(v); });
    return () => { active = false; };
  }, [profile, turmaId]);
  return staff;
}
