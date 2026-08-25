import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Paperclip, Send, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadComunidadeFile } from '../../lib/storage';
import { EmptyState, Avatar, useToast, cn } from '../../components/ui';
import { FileLink } from '../../components/FileLink';

type Pair = { turmaId: string; turmaNome: string; cursoId: string; cursoTitulo: string };
type Message = {
  id: string; turma_id: string; curso_id: string; user_id: string;
  content: string | null; arquivo_url: string | null; arquivo_nome: string | null;
  created_at: string; profiles: { email: string; nome: string | null; avatar_url?: string | null } | null;
};

export default function Comunidade() {
  const { profile } = useAuth();
  const toast = useToast();

  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pair | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) { setLoading(false); return; }
    (async () => {
      // is_staff ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ut } = await (supabase as any).from('user_turmas').select('turma_id,curso_id,is_staff').eq('user_id', profile.id).not('curso_id', 'is', null);
      // is_staff só é relevante para professor/monitor — a coluna tem default
      // true no banco, então para aluno/embaixador ela não deve excluir nada.
      // Cursos onde o usuário dá aula (is_staff) não aparecem aqui — ficam na Comunidade de gestão.
      const isProfOrMonitor = profile.role === 'professor' || profile.role === 'monitor';
      const rawPairs = ((ut ?? []) as { turma_id: string; curso_id: string; is_staff?: boolean }[]).filter((p) => !isProfOrMonitor || !p.is_staff);
      if (!rawPairs.length) { setPairs([]); setLoading(false); return; }
      const turmaIds = [...new Set(rawPairs.map((p) => p.turma_id))];
      const cursoIds = [...new Set(rawPairs.map((p) => p.curso_id))];
      const [{ data: turmas }, { data: cursos }] = await Promise.all([
        supabase.from('turmas').select('id,nome').in('id', turmaIds),
        supabase.from('cursos').select('id,titulo').in('id', cursoIds),
      ]);
      const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t]));
      const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c]));
      setPairs(rawPairs.filter((p) => turmaMap.has(p.turma_id) && cursoMap.has(p.curso_id))
        .map((p) => ({ turmaId: p.turma_id, turmaNome: turmaMap.get(p.turma_id)!.nome, cursoId: p.curso_id, cursoTitulo: cursoMap.get(p.curso_id)!.titulo })));
      setLoading(false);
    })();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = async (p: Pair) => {
    setMsgLoading(true);
    const { data } = await supabase.from('community_messages').select('*, profiles(email,nome,avatar_url)').eq('turma_id', p.turmaId).eq('curso_id', p.cursoId).order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
    setMsgLoading(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
  };

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected);
    const channel = supabase.channel(`community:${selected.turmaId}:${selected.cursoId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `curso_id=eq.${selected.cursoId}` }, (payload) => {
        const row = payload.new as Message;
        if (row.turma_id !== selected.turmaId) return;
        // Evita duplicar mensagem já inserida de forma otimista pelo próprio remetente.
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current!.scrollHeight, behavior: 'smooth' }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.turmaId, selected?.cursoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!selected || !profile || (!text.trim() && !file)) return;
    setSending(true);
    try {
      let arquivo_url: string | null = null;
      let arquivo_nome: string | null = null;
      if (file) { const up = await uploadComunidadeFile(file, `${selected.turmaId}/${selected.cursoId}`); arquivo_url = up.path; arquivo_nome = up.nome; }
      const { data, error } = await supabase.from('community_messages')
        .insert({ turma_id: selected.turmaId, curso_id: selected.cursoId, user_id: profile.id, content: text.trim() || null, arquivo_url, arquivo_nome })
        .select('*, profiles(email,nome,avatar_url)')
        .single();
      if (error) throw error;
      // Mostra a mensagem na hora, sem esperar o round-trip do realtime.
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current!.scrollHeight, behavior: 'smooth' }));
      setText(''); setFile(null);
    } catch (e) { toast.error((e as Error).message); } finally { setSending(false); }
  };

  const isSel = (p: Pair) => selected?.turmaId === p.turmaId && selected?.cursoId === p.cursoId;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen relative">
      <aside
        className={cn(
          'border-r border-line flex flex-col flex-shrink-0 overflow-y-auto scrollbar-thin bg-panel',
          'lg:w-72 lg:static',
          selected
            ? 'hidden lg:flex'
            : 'flex w-full lg:w-72',
        )}
      >
        <div className="p-4 border-b border-line flex-shrink-0"><h2 className="text-fg text-base font-medium">Comunidade</h2></div>
        {loading ? (
          <div className="p-2 space-y-1">
            {[0, 1, 2].map((i) => <div key={i} className="h-9 rounded-md bg-panel-2/60 animate-pulse" />)}
          </div>
        ) : pairs.length === 0 ? (
          <div className="text-center px-5 py-8">
            <span className="w-10 h-10 rounded-full bg-panel-2 grid place-items-center mb-3 mx-auto"><MessageSquare className="w-5 h-5 text-fg-3" /></span>
            <p className="text-fg-2 text-sm font-medium mb-1">Nenhuma comunidade</p>
            <p className="text-fg-3 text-xs leading-relaxed">Aguarde o administrador liberar turmas e cursos para você.</p>
          </div>
        ) : (
            <div className="p-2 space-y-0.5">
              {pairs.map((p) => (
                <button key={`${p.turmaId}:${p.cursoId}`} onClick={() => setSelected(p)} className={cn('w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors', isSel(p) ? 'bg-brand text-brand-ink font-medium' : 'text-fg-2 hover:bg-panel-2')}>{p.cursoTitulo}</button>
              ))}
            </div>
          )}
      </aside>

      <section className={cn('flex-1 flex-col min-w-0 bg-canvas', selected ? 'flex' : 'hidden lg:flex')}>
        {!selected ? (
          <div className="flex-1 grid place-items-center p-6"><EmptyState icon={<MessageSquare className="w-8 h-8" />} title="Selecione uma comunidade" description="Escolha uma conversa na lista ao lado." /></div>
        ) : (
          <>
            <div className="px-4 sm:px-6 py-3.5 border-b border-line flex-shrink-0 flex items-center gap-3">
              <button
                onClick={() => setSelected(null)}
                aria-label="Voltar"
                className="lg:hidden -ml-1 p-1.5 rounded-md text-fg-2 hover:bg-panel-2 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-fg font-medium truncate">{selected.cursoTitulo}</p>
                <p className="text-fg-3 text-xs truncate">{selected.turmaNome}</p>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-4 space-y-3">
              {msgLoading ? <p className="text-fg-3 text-sm">Carregando mensagens…</p> :
                messages.length === 0 ? <p className="text-fg-3 text-sm text-center mt-8">Nenhuma mensagem ainda. Envie a primeira!</p> :
                messages.map((m) => {
                  const mine = m.user_id === profile?.id;
                  return (
                    <div key={m.id} className={cn('flex gap-2 sm:gap-3', mine && 'flex-row-reverse')}>
                      <Avatar name={m.profiles?.nome} email={m.profiles?.email} src={m.profiles?.avatar_url} size={32} />
                      <div className={cn('max-w-[80%] sm:max-w-[75%] rounded-xl px-3 py-2 break-words', mine ? 'bg-brand text-brand-ink' : 'bg-panel border border-line text-fg-2')}>
                        {!mine && <p className="text-xs font-medium opacity-80 mb-0.5 truncate">{m.profiles?.nome || m.profiles?.email || 'Usuário'}</p>}
                        {m.content && <p className="text-sm whitespace-pre-line break-words">{m.content}</p>}
                        {m.arquivo_url && <FileLink bucket="comunidade" path={m.arquivo_url} className={cn('inline-flex items-center gap-1 text-xs underline mt-1 break-all', mine ? 'text-brand-ink/80' : 'text-brand')}><Paperclip className="w-3 h-3" /> {m.arquivo_nome ?? 'Anexo'}</FileLink>}
                        <p className={cn('text-[10px] mt-1', mine ? 'text-brand-ink/60' : 'text-fg-3')}>{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="border-t border-line px-3 sm:px-4 py-3 flex-shrink-0 bg-panel">
              {file && <p className="text-xs text-fg-2 mb-2 flex items-center gap-1 break-all"><Paperclip className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{file.name}</span><button onClick={() => setFile(null)} className="text-danger ml-2 inline-flex items-center gap-0.5 flex-shrink-0"><X className="w-3 h-3" />remover</button></p>}
              <div className="flex items-center gap-2">
                <label className="flex-shrink-0 p-2 rounded-md text-fg-3 hover:text-fg hover:bg-panel-2 cursor-pointer transition-colors">
                  <Paperclip className="w-5 h-5" /><input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Digite uma mensagem…" className="flex-1 min-w-0" />
                <button onClick={send} disabled={sending || (!text.trim() && !file)} aria-label="Enviar" className="flex-shrink-0 p-2.5 rounded-md bg-brand text-brand-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-hover transition-colors"><Send className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
