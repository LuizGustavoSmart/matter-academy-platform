import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Badge, Empty } from '../../components/ui';

type Atividade = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  turma_id: string;
  criado_por: string | null;
  turmas: { nome: string } | null;
};

type Aluno = {
  id: string;
  email: string;
  full_name: string | null;
};

type Submissao = {
  id: string;
  atividade_id: string;
  aluno_id: string;
  conteudo: string;
  updated_at: string;
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function initials(email: string): string {
  return email.split('@')[0]?.slice(0, 2).toUpperCase() ?? '??';
}

export default function AtividadeDetalhe() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();

  const [atividade, setAtividade] = useState<Atividade | null>(null);
  const [alunos, setAlunos]       = useState<Aluno[]>([]);
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);

  useEffect(() => {
    if (!id || !profile) return;
    (async () => {
      const { data: at } = await supabase
        .from('atividades')
        .select('*,turmas(nome)')
        .eq('id', id)
        .single();

      if (!at) { setNotFound(true); setLoading(false); return; }
      setAtividade(at as Atividade);

      const [{ data: ut }, { data: subs }] = await Promise.all([
        supabase.from('user_turmas').select('user_id').eq('turma_id', at.turma_id),
        supabase.from('submissoes').select('*').eq('atividade_id', id),
      ]);

      const alunoIds = (ut ?? []).map((r: any) => r.user_id);
      if (alunoIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id,email,full_name')
          .in('id', alunoIds)
          .eq('role', 'student')
          .order('email');
        setAlunos((profiles ?? []) as Aluno[]);
      }

      setSubmissoes((subs ?? []) as Submissao[]);
      setLoading(false);
    })();
  }, [id, profile]);

  const subMap: Record<string, Submissao> = {};
  submissoes.forEach((s) => { subMap[s.aluno_id] = s; });

  const submitted = alunos.filter((a) => subMap[a.id]);
  const pending   = alunos.filter((a) => !subMap[a.id]);

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-12"><p className="meta">Carregando...</p></div>;
  if (notFound) return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <p className="text-red-400">Atividade não encontrada.</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Back */}
      <button onClick={() => nav('/atividades')} className="inline-flex items-center gap-2 text-sm text-[#8b929e] hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar para Atividades
      </button>

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-start gap-3 mb-2">
          <h1 className="flex-1">{atividade?.titulo}</h1>
          <Badge>{atividade?.turmas?.nome ?? '—'}</Badge>
        </div>
        {atividade?.descricao && (
          <p className="text-[#d6deed] text-sm whitespace-pre-wrap mb-4">{atividade.descricao}</p>
        )}
        {atividade?.prazo && (
          <p className="text-xs text-[#8b929e]">
            <Clock className="w-3 h-3 inline mr-1" />
            Prazo: {new Date(atividade.prazo).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 mb-10 p-4 bg-[#0d0d0d] border border-[#1c1f26] rounded-lg">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{alunos.length}</p>
          <p className="text-xs text-[#8b929e]">Alunos</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#cbfb00]">{submitted.length}</p>
          <p className="text-xs text-[#8b929e]">Enviados</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-400">{pending.length}</p>
          <p className="text-xs text-[#8b929e]">Pendentes</p>
        </div>
      </div>

      {alunos.length === 0 ? (
        <Empty
          icon={<User className="w-10 h-10" />}
          title="Nenhum aluno nesta turma"
          description="Adicione alunos à turma para ver as submissões"
        />
      ) : (
        <div className="space-y-6">
          {/* Enviados */}
          {submitted.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-[#cbfb00] uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Enviados ({submitted.length})
              </h2>
              <div className="space-y-3">
                {submitted.map((a) => {
                  const sub = subMap[a.id];
                  const isOpen = expanded === a.id;
                  return (
                    <Card key={a.id} className="p-4">
                      <button
                        onClick={() => setExpanded(isOpen ? null : a.id)}
                        className="w-full flex items-center gap-3 text-left"
                      >
                        <span className="w-8 h-8 rounded-full bg-[#cbfb00]/10 border border-[#cbfb00]/30 text-[#cbfb00] text-xs font-medium flex items-center justify-center flex-shrink-0">
                          {initials(a.email)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{a.full_name || a.email}</p>
                          {!isOpen && (
                            <p className="text-[#8b929e] text-xs line-clamp-1 mt-0.5">{sub.conteudo}</p>
                          )}
                        </div>
                        <span className="text-xs text-[#8b929e] flex-shrink-0">{timeLabel(sub.updated_at)}</span>
                      </button>
                      {isOpen && (
                        <div className="mt-3 ml-11 p-3 bg-[#0d0d0d] border border-[#1c1f26] rounded-md text-sm text-[#d6deed] whitespace-pre-wrap">
                          {sub.conteudo}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Pendentes */}
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Pendentes ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((a) => (
                  <Card key={a.id} className="p-4 flex items-center gap-3 opacity-60">
                    <span className="w-8 h-8 rounded-full bg-[#1c1f26] text-[#8b929e] text-xs font-medium flex items-center justify-center flex-shrink-0">
                      {initials(a.email)}
                    </span>
                    <div>
                      <p className="text-white text-sm">{a.full_name || a.email}</p>
                      <p className="text-[#8b929e] text-xs">Aguardando envio</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
