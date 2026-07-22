import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Paperclip, Send, ChevronDown, ChevronRight as ChevronRightIcon, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadComunidadeFile } from '../../lib/storage';
import { EmptyState, Avatar, useToast, cn } from '../../components/ui';
import { FileLink } from '../../components/FileLink';

type Pair = { turmaId: string; turmaNome: string; cursoId: string; cursoTitulo: string };
type Message = {
  id: string; turma_id: string; curso_id: string; user_id: string;
  content: string | null; arquivo_url: string | null; arquivo_nome: string | null;
  created_at: string; profiles: { nome: string | null; avatar_signed_url?: string | null } | null;
};

async function messageProfiles(userIds: string[]) {
  if (!userIds.length) return new Map<string, Message['profiles']>();
  const { data } = await supabase.from('profile_directory').select('id,nome,avatar_url').in('id', [...new Set(userIds)]);
  const rows = await Promise.all((data ?? []).map(async (item) => {
    let signedUrl: string | null = null;
    if (item.avatar_url) {
      const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(item.avatar_url, 3600);
      signedUrl = signed?.signedUrl ?? null;
    }
    return [item.id!, { nome: item.nome, avatar_signed_url: signedUrl }] as const;
  }));
  return new Map(rows);
}

export default function Comunidade() {
  const { profile } = useAuth();
  const toast = useToast();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin';

  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pair | null>(null);
  const [expandedTurma, setExpandedTurma] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) { setLoading(false); return; }
    (async () => {
      if (isStaff) {
        const { data: ut } = profile.role === 'admin'
          ? await supabase.from('turmas').select('id')
          : await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const turmaIds = [...new Set((ut ?? []).map((r: any) => r.turma_id ?? r.id))];
        if (!turmaIds.length) { setPairs([]); setLoading(false); return; }
        const [{ data: turmas }, { data: cts }] = await Promise.all([
          supabase.from('turmas').select('id,nome').in('id', turmaIds),
          supabase.from('curso_turmas').select('turma_id,curso_id').in('turma_id', turmaIds),
        ]);
        const cursoIds = [...new Set((cts ?? []).map((r) => r.curso_id))];
        const { data: cursos } = cursoIds.length ? await supabase.from('cursos').select('id,titulo').in('id', cursoIds) : { data: [] };
        const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t]));
        const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c]));
        setPairs((cts ?? []).filter((r) => turmaMap.has(r.turma_id) && cursoMap.has(r.curso_id))
          .map((r) => ({ turmaId: r.turma_id, turmaNome: turmaMap.get(r.turma_id)!.nome, cursoId: r.curso_id, cursoTitulo: cursoMap.get(r.curso_id)!.titulo }))
          .sort((a, b) => a.turmaNome.localeCompare(b.turmaNome) || a.cursoTitulo.localeCompare(b.cursoTitulo)));
      } else {
        const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id).not('curso_id', 'is', null);
        const rawPairs = (ut ?? []) as { turma_id: string; curso_id: string }[];
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
      }
      setLoading(false);
    })();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = async (p: Pair) => {
    setMsgLoading(true);
    const { data } = await supabase.from('community_messages').select('*').eq('turma_id', p.turmaId).eq('curso_id', p.cursoId).order('created_at', { ascending: true });
    const profiles = await messageProfiles((data ?? []).map((message) => message.user_id));
    setMessages((data ?? []).map((message) => ({ ...message, profiles: profiles.get(message.user_id) ?? null })) as Message[]);
    setMsgLoading(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
  };

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected);
    const channel = supabase.channel(`community:${selected.turmaId}:${selected.cursoId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `curso_id=eq.${selected.cursoId}` }, async (payload) => {
        const row = payload.new as Message;
        if (row.turma_id !== selected.turmaId) return;
        const profiles = await messageProfiles([row.user_id]);
        row.profiles = profiles.get(row.user_id) ?? null;
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
        .select('*')
        .single();
      if (error) throw error;
      // Mostra a mensagem na hora, sem esperar o round-trip do realtime.
      const optimistic = { ...data, profiles: { nome: profile.nome, avatar_signed_url: profile.avatar_signed_url } } as Message;
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, optimistic]));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current!.scrollHeight, behavior: 'smooth' }));
      setText(''); setFile(null);
    } catch (e) { toast.error((e as Error).message); } finally { setSending(false); }
  };

  const turmaGroups = isStaff ? [...new Map(pairs.map((p) => [p.turmaId, p.turmaNome])).entries()] : [];
  const isSel = (p: Pair) => selected?.turmaId === p.turmaId && selected?.cursoId === p.cursoId;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen">
      <aside className="w-72 border-r border-line flex flex-col flex-shrink-0 overflow-y-auto scrollbar-thin bg-panel">
        <div className="p-4 border-b border-line flex-shrink-0"><h2 className="text-fg text-base font-medium">Comunidade</h2></div>
        {loading ? (
          <div className="p-2 space-y-1">
            {[0, 1, 2].map((i) => <div key={i} className="h-9 rounded-md bg-panel-2/60 animate-pulse" />)}
          </div>
        ) : pairs.length === 0 ? (
          <div className="text-center px-5 py-8">
            <span className="w-10 h-10 rounded-full bg-panel-2 grid place-items-center mb-3 mx-auto"><MessageSquare className="w-5 h-5 text-fg-3" /></span>
            <p className="text-fg-2 text-sm font-medium mb-1">Nenhuma comunidade</p>
            <p className="text-fg-3 text-xs leading-relaxed">{isStaff ? 'Você ainda não está atribuído a turmas com cursos vinculados.' : 'Aguarde o administrador liberar turmas e cursos para você.'}</p>
          </div>
        ) : isStaff ? (
            <div className="p-2">
              {turmaGroups.map(([turmaId, turmaNome]) => {
                const isOpen = expandedTurma === turmaId;
                const courses = pairs.filter((p) => p.turmaId === turmaId);
                return (
                  <div key={turmaId} className="mb-1">
                    <button onClick={() => setExpandedTurma(isOpen ? null : turmaId)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-sm text-fg-2 hover:bg-panel-2 transition-colors">
                      <span className="font-medium truncate">{turmaNome}</span>
                      {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="ml-3 border-l border-line pl-2 space-y-0.5 mt-1">
                        {courses.map((p) => (
                          <button key={p.cursoId} onClick={() => setSelected(p)} className={cn('w-full text-left px-3 py-2 rounded-md text-sm transition-colors', isSel(p) ? 'bg-brand text-brand-ink font-medium' : 'text-fg-2 hover:bg-panel-2')}>{p.cursoTitulo}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {pairs.map((p) => (
                <button key={`${p.turmaId}:${p.cursoId}`} onClick={() => setSelected(p)} className={cn('w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors', isSel(p) ? 'bg-brand text-brand-ink font-medium' : 'text-fg-2 hover:bg-panel-2')}>{p.cursoTitulo}</button>
              ))}
            </div>
          )}
      </aside>

      <section className="flex-1 flex flex-col min-w-0 bg-canvas">
        {!selected ? (
          <div className="flex-1 grid place-items-center p-6"><EmptyState icon={<MessageSquare className="w-8 h-8" />} title="Selecione uma comunidade" description="Escolha uma conversa na lista ao lado." /></div>
        ) : (
          <>
            <div className="px-4 sm:px-6 py-3.5 border-b border-line flex-shrink-0"><p className="text-fg font-medium">{selected.cursoTitulo}</p><p className="text-fg-3 text-xs">{selected.turmaNome}</p></div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-4 space-y-3">
              {msgLoading ? <p className="text-fg-3 text-sm">Carregando mensagens…</p> :
                messages.length === 0 ? <p className="text-fg-3 text-sm text-center mt-8">Nenhuma mensagem ainda. Envie a primeira!</p> :
                messages.map((m) => {
                  const mine = m.user_id === profile?.id;
                  return (
                    <div key={m.id} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
                      <Avatar name={m.profiles?.nome} src={m.profiles?.avatar_signed_url} size={32} />
                      <div className={cn('max-w-[75%] rounded-xl px-3 py-2', mine ? 'bg-brand text-brand-ink' : 'bg-panel border border-line text-fg-2')}>
                        {!mine && <p className="text-xs font-medium opacity-80 mb-0.5">{m.profiles?.nome || 'Participante'}</p>}
                        {m.content && <p className="text-sm whitespace-pre-line">{m.content}</p>}
                        {m.arquivo_url && <FileLink bucket="comunidade" path={m.arquivo_url} className={cn('inline-flex items-center gap-1 text-xs underline mt-1', mine ? 'text-brand-ink/80' : 'text-brand')}><Paperclip className="w-3 h-3" /> {m.arquivo_nome ?? 'Anexo'}</FileLink>}
                        <p className={cn('text-[10px] mt-1', mine ? 'text-brand-ink/60' : 'text-fg-3')}>{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="border-t border-line px-4 py-3 flex-shrink-0 bg-panel">
              {file && <p className="text-xs text-fg-2 mb-2 flex items-center gap-1"><Paperclip className="w-3 h-3" /> {file.name}<button onClick={() => setFile(null)} className="text-danger ml-2 inline-flex items-center gap-0.5"><X className="w-3 h-3" />remover</button></p>}
              <div className="flex items-center gap-2">
                <label className="flex-shrink-0 p-2 rounded-md text-fg-3 hover:text-fg hover:bg-panel-2 cursor-pointer transition-colors">
                  <Paperclip className="w-5 h-5" /><input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Digite uma mensagem…" className="flex-1" />
                <button onClick={send} disabled={sending || (!text.trim() && !file)} aria-label="Enviar" className="flex-shrink-0 p-2.5 rounded-md bg-brand text-brand-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-hover transition-colors"><Send className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
