import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Paperclip, Send, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadComunidadeFile } from '../../lib/storage';
import { Empty } from '../../components/ui';

type Pair = { turmaId: string; turmaNome: string; cursoId: string; cursoTitulo: string };
type Message = {
  id: string; turma_id: string; curso_id: string; user_id: string;
  content: string | null; arquivo_url: string | null; arquivo_nome: string | null;
  created_at: string; profiles: { email: string } | null;
};

function initials(email: string) {
  return email.split('@')[0]?.slice(0, 2).toUpperCase() ?? '??';
}

export default function Comunidade() {
  const { profile } = useAuth();
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
        const turmaIds = [...new Set((ut ?? []).map((r: any) => r.turma_id ?? r.id))];
        if (!turmaIds.length) { setPairs([]); setLoading(false); return; }

        const [{ data: turmas }, { data: cts }] = await Promise.all([
          supabase.from('turmas').select('id,nome').in('id', turmaIds),
          supabase.from('curso_turmas').select('turma_id,curso_id').in('turma_id', turmaIds),
        ]);
        const cursoIds = [...new Set((cts ?? []).map((r: any) => r.curso_id))];
        const { data: cursos } = cursoIds.length
          ? await supabase.from('cursos').select('id,titulo').in('id', cursoIds)
          : { data: [] };
        const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t]));
        const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c]));

        const list: Pair[] = (cts ?? [])
          .filter((r: any) => turmaMap.has(r.turma_id) && cursoMap.has(r.curso_id))
          .map((r: any) => ({
            turmaId: r.turma_id,
            turmaNome: turmaMap.get(r.turma_id)!.nome,
            cursoId: r.curso_id,
            cursoTitulo: cursoMap.get(r.curso_id)!.titulo,
          }))
          .sort((a, b) => a.turmaNome.localeCompare(b.turmaNome) || a.cursoTitulo.localeCompare(b.cursoTitulo));
        setPairs(list);
      } else {
        const { data: ut } = await supabase
          .from('user_turmas')
          .select('turma_id,curso_id')
          .eq('user_id', profile.id)
          .not('curso_id', 'is', null);
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

        const list: Pair[] = rawPairs
          .filter((p) => turmaMap.has(p.turma_id) && cursoMap.has(p.curso_id))
          .map((p) => ({
            turmaId: p.turma_id,
            turmaNome: turmaMap.get(p.turma_id)!.nome,
            cursoId: p.curso_id,
            cursoTitulo: cursoMap.get(p.curso_id)!.titulo,
          }));
        setPairs(list);
      }
      setLoading(false);
    })();
  }, [profile]);

  const loadMessages = async (p: Pair) => {
    setMsgLoading(true);
    const { data } = await supabase
      .from('community_messages')
      .select('*, profiles(email)')
      .eq('turma_id', p.turmaId)
      .eq('curso_id', p.cursoId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
    setMsgLoading(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
  };

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected);

    const channel = supabase
      .channel(`community:${selected.turmaId}:${selected.cursoId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `curso_id=eq.${selected.cursoId}` }, (payload) => {
        const row = payload.new as Message;
        if (row.turma_id !== selected.turmaId) return;
        setMessages((prev) => [...prev, row]);
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current!.scrollHeight, behavior: 'smooth' }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selected?.turmaId, selected?.cursoId]);

  const send = async () => {
    if (!selected || !profile || (!text.trim() && !file)) return;
    setSending(true);
    try {
      let arquivo_url: string | null = null;
      let arquivo_nome: string | null = null;
      if (file) {
        const up = await uploadComunidadeFile(file, `${selected.turmaId}/${selected.cursoId}`);
        arquivo_url = up.url;
        arquivo_nome = up.nome;
      }
      const { error } = await supabase.from('community_messages').insert({
        turma_id: selected.turmaId,
        curso_id: selected.cursoId,
        user_id: profile.id,
        content: text.trim() || null,
        arquivo_url,
        arquivo_nome,
      });
      if (error) throw error;
      setText('');
      setFile(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const turmaGroups = isStaff ? [...new Map(pairs.map((p) => [p.turmaId, p.turmaNome])).entries()] : [];

  return (
    <div className="flex h-screen">
      {/* ── LADO ESQUERDO ── */}
      <aside className="w-80 border-r border-[#1c1f26] flex flex-col flex-shrink-0 overflow-y-auto scrollbar-thin">
        <div className="p-4 border-b border-[#1c1f26]">
          <h2 className="text-white text-base font-medium">Comunidade</h2>
        </div>

        {loading ? (
          <p className="meta p-4">Carregando...</p>
        ) : pairs.length === 0 ? (
          <p className="meta p-4">Nenhuma comunidade disponível</p>
        ) : isStaff ? (
          <div className="p-2">
            {turmaGroups.map(([turmaId, turmaNome]) => {
              const isOpen = expandedTurma === turmaId;
              const courses = pairs.filter((p) => p.turmaId === turmaId);
              return (
                <div key={turmaId} className="mb-1">
                  <button
                    onClick={() => setExpandedTurma(isOpen ? null : turmaId)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-sm text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors"
                  >
                    <span className="font-medium">{turmaNome}</span>
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                  </button>
                  {isOpen && (
                    <div className="ml-3 border-l border-[#1c1f26] pl-2 space-y-0.5 mt-1">
                      {courses.map((p) => (
                        <button
                          key={p.cursoId}
                          onClick={() => setSelected(p)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            selected?.turmaId === p.turmaId && selected?.cursoId === p.cursoId
                              ? 'bg-[#cbfb00] text-black font-medium'
                              : 'text-[#d6deed] hover:bg-[#434d5e]/20'
                          }`}
                        >
                          {p.cursoTitulo}
                        </button>
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
              <button
                key={`${p.turmaId}:${p.cursoId}`}
                onClick={() => setSelected(p)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                  selected?.turmaId === p.turmaId && selected?.cursoId === p.cursoId
                    ? 'bg-[#cbfb00] text-black font-medium'
                    : 'text-[#d6deed] hover:bg-[#434d5e]/20'
                }`}
              >
                {p.cursoTitulo}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── LADO DIREITO ── */}
      <section className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 grid place-items-center">
            <Empty icon={<MessageSquare className="w-10 h-10" />} title="Selecione uma comunidade" description="Escolha uma conversa na lista ao lado" />
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-[#1c1f26] flex-shrink-0">
              <p className="text-white font-medium">{selected.cursoTitulo}</p>
              <p className="meta text-xs">{selected.turmaNome}</p>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-3">
              {msgLoading ? (
                <p className="meta">Carregando mensagens...</p>
              ) : messages.length === 0 ? (
                <p className="meta text-center mt-8">Nenhuma mensagem ainda. Envie a primeira!</p>
              ) : (
                messages.map((m) => {
                  const mine = m.user_id === profile?.id;
                  return (
                    <div key={m.id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                      <div className="w-8 h-8 rounded-full bg-[#1c1f26] grid place-items-center flex-shrink-0 text-xs text-[#d6deed]">
                        {initials(m.profiles?.email ?? '??')}
                      </div>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 ${mine ? 'bg-[#cbfb00] text-black' : 'bg-[#0d0d0d] border border-[#1c1f26] text-[#d6deed]'}`}>
                        {!mine && <p className="text-xs opacity-70 mb-0.5">{m.profiles?.email}</p>}
                        {m.content && <p className="text-sm whitespace-pre-line">{m.content}</p>}
                        {m.arquivo_url && (
                          <a href={m.arquivo_url} target="_blank" rel="noopener" className={`inline-flex items-center gap-1 text-xs underline mt-1 ${mine ? 'text-black/80' : 'text-[#cbfb00]'}`}>
                            <Paperclip className="w-3 h-3" /> {m.arquivo_nome ?? 'Anexo'}
                          </a>
                        )}
                        <p className={`text-[10px] mt-1 ${mine ? 'text-black/60' : 'text-[#434d5e]'}`}>
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-[#1c1f26] px-4 py-3 flex-shrink-0">
              {file && (
                <p className="text-xs text-[#d6deed] mb-2 flex items-center gap-1">
                  <Paperclip className="w-3 h-3" /> {file.name}
                  <button onClick={() => setFile(null)} className="text-red-400 ml-2">remover</button>
                </p>
              )}
              <div className="flex items-center gap-2">
                <label className="flex-shrink-0 p-2 rounded-md text-[#d6deed] hover:bg-[#434d5e]/20 cursor-pointer transition-colors">
                  <Paperclip className="w-5 h-5" />
                  <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Digite uma mensagem..."
                  className="flex-1"
                />
                <button
                  onClick={send}
                  disabled={sending || (!text.trim() && !file)}
                  className="flex-shrink-0 p-2.5 rounded-md bg-[#cbfb00] text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#b8e300] transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
