import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export const TURMA_CAPA_OPTIONS = [
  { value: 'td_matter', label: 'TD Matter' },
  { value: 'padrao', label: 'Padrão (demais turmas)' },
] as const;

type TurmaCapaMap = Record<string, string | null>;

let cache: TurmaCapaMap | null = null;
let pending: Promise<TurmaCapaMap> | null = null;

async function fetchTurmaCapas(): Promise<TurmaCapaMap> {
  if (cache) return cache;
  if (!pending) {
    pending = (async (): Promise<TurmaCapaMap> => {
      // turma_capas ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('turma_capas').select('tipo,capa_url');
      const map: TurmaCapaMap = {};
      ((data ?? []) as { tipo: string; capa_url: string | null }[]).forEach((r) => { map[r.tipo] = r.capa_url; });
      cache = map;
      return map;
    })();
  }
  return pending;
}

/** Invalida o cache em memória — chamar depois de atualizar uma capa-modelo de turma. */
export function invalidateTurmaCapasCache() { cache = null; pending = null; }

/** Mapa tipo -> capa_url, buscado uma única vez e compartilhado entre componentes. */
export function useTurmaCapas(): TurmaCapaMap {
  const [map, setMap] = useState<TurmaCapaMap>(cache ?? {});
  useEffect(() => {
    let active = true;
    fetchTurmaCapas().then((m) => { if (active) setMap(m); });
    return () => { active = false; };
  }, []);
  return map;
}
