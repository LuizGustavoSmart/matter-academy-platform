import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight, Users, MessageSquare, HelpCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Empty, ProgressBar } from '../../components/ui';

type CourseCard = {
  id: string;
  titulo: string;
  descricao: string;
  total: number;
  done: number;
};

type Turma = {
  id: string;
  nome: string;
  descricao: string;
};

/* ══════════════════════════════════════════════════════════════════════════ */
export default function StudentDashboard() {
  const { profile } = useAuth();
  const isMonitor = profile?.role === 'monitor';

  const [courses,        setCourses]        = useState<CourseCard[]>([]);
  const [turmas,         setTurmas]         = useState<Turma[]>([]);
  const [duvidasAbertas, setDuvidasAbertas] = useState<Record<string, number>>({});
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;

      const [{ data: cs }, { data: ts }] = await Promise.all([
        supabase.from('cursos').select('id,titulo,descricao'),
        supabase.from('turmas').select('id,nome,descricao').order('nome'),
      ]);

      /* Contagem de dúvidas abertas por turma (apenas para monitores) */
      if (isMonitor && (ts ?? []).length > 0) {
        const turmaIds = (ts ?? []).map((t) => t.id);
        const { data: duvs } = await supabase
          .from('community_posts')
          .select('turma_id')
          .eq('tipo', 'duvida')
          .eq('status', 'aberta')
          .in('turma_id', turmaIds);

        const counts: Record<string, number> = {};
        (duvs ?? []).forEach((d) => {
          counts[d.turma_id] = (counts[d.turma_id] ?? 0) + 1;
        });
        setDuvidasAbertas(counts);
      }

      /* Progresso de cursos (apenas para alunos/professores) */
      if (!isMonitor) {
        const cursoIds = (cs ?? []).map((c) => c.id);
        const { data: as } = await supabase
          .from('aulas')
          .select('id,curso_id')
          .in('curso_id', cursoIds.length ? cursoIds : ['00000000-0000-0000-0000-000000000000']);
        const { data: ps } = await supabase
          .from('progresso')
          .select('aula_id,concluido')
          .eq('user_id', profile.id)
          .eq('concluido', true);

        const doneSet = new Set((ps ?? []).map((p) => p.aula_id));
        const counts: Record<string, { total: number; done: number }> = {};
        (as ?? []).forEach((a) => {
          if (!counts[a.curso_id]) counts[a.curso_id] = { total: 0, done: 0 };
          counts[a.curso_id].total++;
          if (doneSet.has(a.id)) counts[a.curso_id].done++;
        });

        setCourses(
          (cs ?? []).map((c) => ({
            ...c,
            total: counts[c.id]?.total ?? 0,
            done:  counts[c.id]?.done  ?? 0,
          })),
        );
      }

      setTurmas(ts ?? []);
      setLoading(false);
    };
    load();
  }, [profile]);

  /* ══════════════════════════════════
     VIEW: MONITOR
  ══════════════════════════════════ */
  if (isMonitor) {
    const totalDuvidas = Object.values(duvidasAbertas).reduce((a, b) => a + b, 0);

    return (
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <h1 className="mb-2">Painel do Monitor</h1>
          <p className="text-[#d6deed]">Acompanhe as dúvidas abertas nas turmas que você monitora.</p>
        </div>

        {/* Cards de resumo */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3 mb-10 max-w-sm">
            <div className="bg-[#0d0d0d] border border-[#1c1f26] rounded-lg p-4">
              <p className="text-2xl font-bold text-white">{turmas.length}</p>
              <p className="meta text-xs mt-1">Turmas</p>
            </div>
            <div className={`border rounded-lg p-4 transition-colors ${
              totalDuvidas > 0
                ? 'bg-amber-500/5 border-amber-500/30'
                : 'bg-[#0d0d0d] border-[#1c1f26]'
            }`}>
              <p className={`text-2xl font-bold ${totalDuvidas > 0 ? 'text-amber-400' : 'text-white'}`}>
                {totalDuvidas}
              </p>
              <p className={`text-xs mt-1 ${totalDuvidas > 0 ? 'text-amber-400/70' : 'meta'}`}>
                Dúvidas abertas
              </p>
            </div>
          </div>
        )}

        {/* Turmas */}
        {loading ? (
          <p className="meta">Carregando...</p>
        ) : turmas.length === 0 ? (
          <Empty
            icon={<Users className="w-10 h-10" />}
            title="Nenhuma turma atribuída"
            description="O administrador precisa te atribuir a uma turma"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {turmas.map((t) => {
              const count = duvidasAbertas[t.id] ?? 0;
              return (
                <Card key={t.id} className="p-5 flex flex-col gap-4">
                  {/* Cabeçalho do card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center flex-shrink-0">
                        <Users className="w-5 h-5 text-[#cbfb00]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{t.nome}</p>
                        {t.descricao && (
                          <p className="meta text-xs mt-0.5 line-clamp-1">{t.descricao}</p>
                        )}
                      </div>
                    </div>
                    {count > 0 && (
                      <div className="flex-shrink-0 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1 text-center min-w-[44px]">
                        <p className="text-amber-400 font-bold text-sm leading-none">{count}</p>
                        <p className="text-amber-400/70 text-[9px] leading-none mt-0.5">
                          dúvida{count > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2">
                    {count > 0 && (
                      <Link
                        to={`/turma/${t.id}/comunidade?filtro=duvidas`}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                      >
                        <HelpCircle className="w-4 h-4" />
                        Ver dúvidas abertas ({count})
                      </Link>
                    )}
                    <Link
                      to={`/turma/${t.id}/comunidade`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors border border-[#434d5e] text-[#d6deed] hover:bg-[#434d5e]/20"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Ver comunidade
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════
     VIEW: ALUNO / PROFESSOR
  ══════════════════════════════════ */
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">

      {/* ── Meus cursos ── */}
      <div className="mb-10">
        <h1 className="mb-2">Meus cursos</h1>
        <p className="text-[#d6deed]">Continue de onde parou e acompanhe seu progresso.</p>
      </div>

      {loading ? (
        <p className="meta">Carregando...</p>
      ) : courses.length === 0 ? (
        <Empty
          icon={<BookOpen className="w-10 h-10" />}
          title="Nenhum curso disponível"
          description="Aguarde o administrador liberar conteúdo para suas turmas"
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <Link key={c.id} to={`/curso/${c.id}`} className="group">
                <Card className="p-6 h-full flex flex-col transition-colors hover:border-[#cbfb00]/40">
                  <div className="w-11 h-11 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center mb-4">
                    <BookOpen className="w-5 h-5 text-[#cbfb00]" />
                  </div>
                  <h3 className="mb-2 group-hover:text-white transition-colors">{c.titulo}</h3>
                  <p className="text-sm mb-6 line-clamp-2 flex-1">{c.descricao || 'Sem descrição'}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#d6deed]">{c.done}/{c.total} aulas</span>
                      <span className="text-[#cbfb00] font-medium">{pct}%</span>
                    </div>
                    <ProgressBar value={pct} />
                  </div>
                  <div className="mt-5 inline-flex items-center gap-1 text-sm text-[#cbfb00] font-medium">
                    {c.done === 0 ? 'Começar' : pct === 100 ? 'Revisar' : 'Continuar'}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Minhas turmas ── */}
      {!loading && turmas.length > 0 && (
        <div className="mt-16">
          <div className="mb-8">
            <h2 className="mb-2">Minhas turmas</h2>
            <p className="text-[#d6deed]">Acesse a comunidade de cada turma para trocar ideias com colegas.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {turmas.map((t) => (
              <Card key={t.id} className="p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center flex-shrink-0">
                    <Users className="w-5 h-5 text-[#cbfb00]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{t.nome}</p>
                    {t.descricao && (
                      <p className="meta text-xs mt-0.5 line-clamp-1">{t.descricao}</p>
                    )}
                  </div>
                </div>
                <Link to={`/turma/${t.id}/comunidade`} className="block">
                  <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors border border-[#434d5e] text-[#d6deed] hover:bg-[#434d5e]/20">
                    <MessageSquare className="w-4 h-4" />
                    Ver comunidade
                  </button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
