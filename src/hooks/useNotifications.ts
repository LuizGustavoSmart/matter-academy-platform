import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  criado_em: string;
};

// "notificacoes" ainda não está no schema gerado do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useNotifications() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await sb
      .from('notificacoes')
      .select('*')
      .eq('user_id', profile.id)
      .order('criado_em', { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notificacao[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile) return;
    const topic = `notifications:${profile.id}`;
    // Em StrictMode (dev) o efeito roda 2x seguidas; o removeChannel() do
    // cleanup anterior é assíncrono e pode não ter terminado ainda, então o
    // supabase-js devolve o MESMO canal (já inscrito) na segunda chamada de
    // .channel(), e o .on() nele explode com "cannot add callbacks after
    // subscribe()". Removendo qualquer canal remanescente com esse tópico
    // antes de criar o novo evita a colisão.
    supabase.getChannels().forEach((c) => { if (c.topic.endsWith(topic)) supabase.removeChannel(c); });
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${profile.id}` },
        (payload) => setItems((prev) => [payload.new as Notificacao, ...prev].slice(0, 30)),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const unread = items.filter((n) => !n.lida).length;

  const markAsRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    await sb.from('notificacoes').update({ lida: true }).eq('id', id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = items.filter((n) => !n.lida).map((n) => n.id);
    if (!unreadIds.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, lida: true })));
    await sb.from('notificacoes').update({ lida: true }).in('id', unreadIds);
  }, [items]);

  return { items, unread, loading, markAsRead, markAllAsRead };
}
