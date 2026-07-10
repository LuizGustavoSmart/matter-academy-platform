import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, Clock, CheckCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Badge, Modal, Empty } from '../../components/ui';

type Atividade = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  turma_id: string;
  criado_por: string | null;
  created_at: string;
  turmas: { nome: string } | null;
};

type Submissao = {
  id: string;
  atividade_id: string;
  aluno_id: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
};

type Turma = { id: string; nome: string };

function deadlineInfo(prazo: string | null): { text: string; cls: string } {
  if (!prazo) return { text: 'Sem prazo', cls: 'text-[#8b929e]' };
  const diff = new Date(prazo).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0)  return { text: 'Prazo encerrado', cls: 'text-red-400' };
  if (days === 0) return { text: 'Vence hoje',     cls: 'text-amber-400' };
  if (days <= 3)  return { text: `${days} dia(s) restante(s)`, cls: 'text-amber-400' };
  return { text: new Date(prazo).toLocaleDateString('pt-BR'), cls: 'text-[#8b929e]' };
}

/* ═══════════════════════════════════════════════════════════ */
export default function Atividades() {
  const { profile } = useAuth();
  const isProf = profile?.role === 'professor' || profile?.role === 'admin';

  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [subCounts, setSubCounts]   = useState<Record<string, number>>({});
  const [turmas, setTurmas]         = useState<Turma[]>([]);
  const [loading, setLoading]       = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState<Atividade | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);

    if (isProf) {
      const { data: ats } = await supabase
        .from('atividades')
        .select('*,turmas(nome)')
        .eq('criado_por', profile.id)
        .order('created_at', { ascending: false });

      const { data: subs } = await supabase.from('submissoes').select('atividade_id');
      const counts: Record<string, number> = {};
      (subs ?? []).forEach((s: any) => { counts[s.atividade_id] = (counts[s.atividade_id] ?? 0) + 1; });

      const { data: ut } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
      const ids = [...new Set((ut ?? []).map((r: any) => r.turma_id))];
      if (ids.length) {
        const { data: ts } = await supabase.from('turmas').select('id,nome').in('id', ids).order('nome');
        setTurmas(ts ?? []);
      }

      setAtividades(ats ?? []);
      setSubCounts(counts);
    } else {
      const { data: ut } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
      const ids = [...new Set((ut ?? []).map((r: any) => r.turma_id))];
      if (!ids.length) { setLoading(false); return; }

      const [{ data: ats }, { data: subs }] = await Promise.all([
        supabase.from('atividades').select('*,turmas(nome)').in('turma_id', ids).order('created_at', { ascending: false }),
        supabase.from('submissoes').select('*').eq('aluno_id', profile.id),
      ]);
      setAtividades(ats ?? []);
      setSubmissoes(subs ?? []);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const mySubmission = (id: string) => submissoes.find((s) => s.atividade_id === id) ?? null;

  /* ── Professor view ── */
  if (isProf) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="mb-2">Atividades</h1>
            <p className="text-[#d6deed]">Crie e acompanhe as atividades das suas turmas.</p>
          </div>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
            Nova atividade
          </Button>
        </div>

        {loading ? <p className="meta">Carregando...</p> : atividades.length === 0 ? (
          <Empty
            icon={<ClipboardList className="w-10 h-10" />}
            title="Nenhuma atividade criada"
            description="Clique em 'Nova atividade' para começar"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {atividades.map((a) => {
              const dl = deadlineInfo(a.prazo);
              const count = subCounts[a.id] ?? 0;
              return (
                <Link key={a.id} to={`/atividades/${a.id}`}>
                  <Card className="p-5 hover:border-[#cbfb00]/40 transition-colors cursor-pointer h-full">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-white font-medium leading-snug">{a.titulo}</p>
                      <Badge className="flex-shrink-0">{a.turmas?.nome ?? '—'}</Badge>
                    </div>
                    {a.descricao && (
                      <p className="text-sm text-[#8b929e] mb-3 line-clamp-2">{a.descricao}</p>
                    )}
                    <div className="flex items-center justify-between text-xs mt-3">
                      <span className={dl.cls}><Clock className="w-3 h-3 inline mr-1" />{dl.text}</span>
                      <span className="text-[#cbfb00] font-medium">{count} envio(s)</span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        <CreateAtividadeModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          turmas={turmas}
          professorId={profile?.id ?? ''}
          onDone={() => { setCreateOpen(false); load(); }}
        />
      </div>
    );
  }

  /* ── Student / Monitor view ── */
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="mb-2">Atividades</h1>
        <p className="text-[#d6deed]">Envie suas respostas dentro do prazo.</p>
      </div>

      {loading ? <p className="meta">Carregando...</p> : atividades.length === 0 ? (
        <Empty
          icon={<ClipboardList className="w-10 h-10" />}
          title="Nenhuma atividade"
          description="Nenhuma atividade foi criada para suas turmas ainda"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {atividades.map((a) => {
            const dl   = deadlineInfo(a.prazo);
            const sub  = mySubmission(a.id);
            return (
              <Card key={a.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white font-medium leading-snug">{a.titulo}</p>
                  <Badge className="flex-shrink-0">{a.turmas?.nome ?? '—'}</Badge>
                </div>
                {a.descricao && (
                  <p className="text-sm text-[#8b929e] line-clamp-2">{a.descricao}</p>
                )}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <span className={`text-xs ${dl.cls}`}>
                    <Clock className="w-3 h-3 inline mr-1" />{dl.text}
                  </span>
                  {sub ? (
                    <button
                      onClick={() => setSubmitOpen(a)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#cbfb00] hover:underline"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Enviado — editar
                    </button>
                  ) : (
                    <button
                      onClick={() => setSubmitOpen(a)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/30 text-[#cbfb00] hover:bg-[#cbfb00]/20 transition-colors"
                    >
                      Enviar <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {submitOpen && (
        <SubmitModal
          atividade={submitOpen}
          existing={mySubmission(submitOpen.id)}
          alunoId={profile?.id ?? ''}
          onClose={() => setSubmitOpen(null)}
          onDone={() => { setSubmitOpen(null); load(); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Modal: professor cria atividade                            */
/* ═══════════════════════════════════════════════════════════ */
function CreateAtividadeModal({
  open, onClose, turmas, professorId, onDone,
}: {
  open: boolean; onClose: () => void;
  turmas: Turma[]; professorId: string;
  onDone: () => void;
}) {
  const [titulo, setTitulo]     = useState('');
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo]       = useState('');
  const [turmaId, setTurmaId]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitulo(''); setDescricao(''); setPrazo('');
      setTurmaId(turmas[0]?.id ?? ''); setErr(null);
    }
  }, [open, turmas]);

  const submit = async () => {
    if (!titulo.trim()) { setErr('Título obrigatório'); return; }
    if (!turmaId)       { setErr('Selecione uma turma'); return; }
    setLoading(true);
    const { error } = await supabase.from('atividades').insert({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      prazo: prazo || null,
      turma_id: turmaId,
      criado_por: professorId,
    });
    if (error) { setErr(error.message); setLoading(false); return; }
    onDone();
  };

  return (
    <Modal
      open={open} onClose={onClose} title="Nova atividade"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Criar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Exercício 01 — Introdução" />
        </div>
        <div>
          <label>Descrição / Instruções</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className="w-full resize-none"
            placeholder="Descreva o que o aluno deve fazer..."
          />
        </div>
        <div>
          <label>Prazo (opcional)</label>
          <input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </div>
        <div>
          <label>Turma</label>
          {turmas.length === 0 ? (
            <p className="meta text-sm">Você não está atribuído a nenhuma turma ainda.</p>
          ) : (
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Modal: aluno envia / edita submissão                       */
/* ═══════════════════════════════════════════════════════════ */
function SubmitModal({
  atividade, existing, alunoId, onClose, onDone,
}: {
  atividade: Atividade;
  existing: Submissao | null;
  alunoId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [conteudo, setConteudo] = useState(existing?.conteudo ?? '');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  const submit = async () => {
    if (!conteudo.trim()) { setErr('Escreva sua resposta antes de enviar'); return; }
    setLoading(true);
    const { error } = await supabase.from('submissoes').upsert(
      {
        ...(existing ? { id: existing.id } : {}),
        atividade_id: atividade.id,
        aluno_id:     alunoId,
        conteudo:     conteudo.trim(),
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'atividade_id,aluno_id' }
    );
    if (error) { setErr(error.message); setLoading(false); return; }
    onDone();
  };

  return (
    <Modal
      open={true} onClose={onClose} title={atividade.titulo}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>
            {existing ? 'Atualizar' : 'Enviar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {atividade.descricao && (
          <div className="bg-[#0d0d0d] border border-[#1c1f26] rounded-md p-3 text-sm text-[#d6deed] whitespace-pre-wrap">
            {atividade.descricao}
          </div>
        )}
        <div>
          <label>{existing ? 'Editar resposta' : 'Sua resposta'}</label>
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={9}
            className="w-full resize-none"
            placeholder="Escreva sua resposta aqui..."
            autoFocus
          />
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
