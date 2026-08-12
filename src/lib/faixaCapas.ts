import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type FaixaCapaMap = Record<string, string | null>;

let cache: FaixaCapaMap | null = null;
let pending: Promise<FaixaCapaMap> | null = null;

async function fetchFaixaCapas(): Promise<FaixaCapaMap> {
  if (cache) return cache;
  if (!pending) {
    pending = (async (): Promise<FaixaCapaMap> => {
      // faixa_capas ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('faixa_capas').select('faixa,capa_url');
      const map: FaixaCapaMap = {};
      ((data ?? []) as { faixa: string; capa_url: string | null }[]).forEach((r) => { map[r.faixa] = r.capa_url; });
      cache = map;
      return map;
    })();
  }
  return pending;
}

/** Invalida o cache em memória — chamar depois de atualizar uma capa de faixa. */
export function invalidateFaixaCapasCache() { cache = null; pending = null; }

/** Mapa faixa -> capa_url, buscado uma única vez e compartilhado entre componentes. */
export function useFaixaCapas(): FaixaCapaMap {
  const [map, setMap] = useState<FaixaCapaMap>(cache ?? {});
  useEffect(() => {
    let active = true;
    fetchFaixaCapas().then((m) => { if (active) setMap(m); });
    return () => { active = false; };
  }, []);
  return map;
}

/** Capa própria do curso/aula, com fallback para a capa padrão da faixa. */
export function resolveCapaUrl(explicit: string | null | undefined, faixa: string | null | undefined, faixaCapas: FaixaCapaMap): string | null {
  if (explicit) return explicit;
  if (faixa && faixaCapas[faixa]) return faixaCapas[faixa];
  return null;
}
