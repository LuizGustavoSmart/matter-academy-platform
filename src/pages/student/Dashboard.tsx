import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, ArrowRight, Users, MessageSquare, HelpCircle, ClipboardList, CalendarClock, PlayCircle, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, ProgressBar, Badge, Skeleton, SkeletonText, Avatar, cn } from '../../components/ui';
import { staggerContainer, staggerItem } from '../../components/ui/motion';

type CourseCard = { id: string; titulo: string; descricao: string | null; total: number; done: number };
type Turma = { id: string; nome: string; descricao: string | null };
type Upcoming = { id: string; titulo: string; prazo: string; turmaId: string; turmaNome: string; cursoId: string | null };

export default function StudentDashboard() {
  const { profile } = useAuth();
  const isMonitor = profile?.role === 'monitor';
  const firstName = (profile?.nome || profile?.email?.split('@')[0] || '').split(' ')[0];

  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [duvidasAbertas, setDuvidasAbertas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id);
      const turmaIds = [...new Set((ut ?? []).map((r) => r.turma_id))];
      // Cursos vinculados diretamente ao aluno + todos os cursos das turmas dele
      const { data: ctRows } = turmaIds.length
        ? await supabase.from('curso_turmas').select('curso_id').in('turma_id', turmaIds)
        : { data: [] };
      const cursoIds = [...new Set([
        ...(ut ?? []).filter((r) => r.curso_id).map((r) => r.curso_id as string),
        ...(ctRows ?? []).map((r) => r.curso_id),
      ])];

      const { data: ts } = turmaIds.length
        ? await supabase.from('turmas').select('id,nome,descricao').in('id', turmaIds).order('nome')
        : { data: [] };
      const turmaMap = new Map((ts ?? []).map((t) => [t.id, t]));

      if (isMonitor && turmaIds.length > 0) {
        const { data: duvs } = await supabase.from('community_posts').select('turma_id').eq('tipo', 'duvida').eq('status', 'aberta').in('turma_id', turmaIds);
        const counts: Record<string, number> = {};
        (duvs ?? []).forEach((d) => { counts[d.turma_id] = (counts[d.turma_id] ?? 0) + 1; });
        setDuvidasAbertas(counts);
      }

      if (!isMonitor) {
        const { data: cs } = cursoIds.length ? await supabase.from('cursos').select('id,titulo,descricao').in('id', cursoIds) : { data: [] };
        if ((cs ?? []).length > 0) {
          const ids = (cs ?? []).map((c) => c.id);
          // lessons_public é uma view não tipada no schema gerado
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: as } = await (supabase as any).from('lessons_public').select('id,curso_id').in('curso_id', ids);
          const { data: ps } = await supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true);
          const doneSet = new Set((ps ?? []).map((p) => p.aula_id));
          const counts: Record<string, { total: number; done: number }> = {};
          (as ?? []).forEach((a: { id: string; curso_id: string }) => {
            if (!counts[a.curso_id]) counts[a.curso_id] = { total: 0, done: 0 };
            counts[a.curso_id].total++;
            if (doneSet.has(a.id)) counts[a.curso_id].done++;
          });
          setCourses((cs ?? []).map((c) => ({ ...c, total: counts[c.id]?.total ?? 0, done: counts[c.id]?.done ?? 0 })));
        }

        // Próximas atividades (com prazo futuro) nas turmas do aluno
        if (turmaIds.length) {
          const nowIso = new Date().toISOString();
          const { data: ats } = await supabase
            .from('atividades').select('id,titulo,prazo,turma_id,curso_id')
            .in('turma_id', turmaIds).not('prazo', 'is', null).gte('prazo', nowIso)
            .order('prazo', { ascending: true }).limit(5);
          setUpcoming((ats ?? []).map((a) => ({
            id: a.id, titulo: a.titulo, prazo: a.prazo as string,
            turmaId: a.turma_id, turmaNome: turmaMap.get(a.turma_id)?.nome ?? 'Turma', cursoId: a.curso_id,
          })));
        }
      }

      setTurmas(ts ?? []);
      setLoading(false);
    };
    load();
  }, [profile, isMonitor]);

  /* ══════════════════ MONITOR ══════════════════ */
  if (isMonitor) {
    const totalDuvidas = Object.values(duvidasAbertas).reduce((a, b) => a + b, 0);
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <header className="mb-7">
          <h1 className="mb-1">Painel do monitor</h1>
          <p className="text-fg-3">Acompanhe as dúvidas abertas nas turmas que você monitora.</p>
        </header>
        {loading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Card key={i} className="p-5"><SkeletonText lines={3} /></Card>)}</div>
          : turmas.length === 0 ? <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhuma turma atribuída" description="O administrador precisa te atribuir a uma turma." />
          : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-7 max-w-sm">
                <Card className="p-4"><p className="text-2xl font-display font-semibold text-fg tabular-nums">{turmas.length}</p><p className="text-fg-3 text-xs mt-1">Turmas</p></Card>
                <Card className={cn('p-4', totalDuvidas > 0 && 'border-warn/30 bg-warn/[0.04]')}><p className={cn('text-2xl font-display font-semibold tabular-nums', totalDuvidas > 0 ? 'text-warn' : 'text-fg')}>{totalDuvidas}</p><p className="text-fg-3 text-xs mt-1">Dúvidas abertas</p></Card>
              </div>
              <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" variants={staggerContainer} initial="hidden" animate="visible">
                {turmas.map((t) => {
                  const count = duvidasAbertas[t.id] ?? 0;
                  return (
                    <motion.div key={t.id} variants={staggerItem}>
                      <Card hoverable className="p-5 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center flex-shrink-0"><Users className="w-5 h-5 text-brand" /></span>
                            <div className="min-w-0"><p className="text-fg font-medium truncate">{t.nome}</p>{t.descricao && <p className="text-fg-3 text-xs mt-0.5 line-clamp-1">{t.descricao}</p>}</div>
                          </div>
                          {count > 0 && <Badge tone="warn">{count} dúvida{count > 1 ? 's' : ''}</Badge>}
                        </div>
                        <div className="flex flex-col gap-2">
                          {count > 0 && <Link to={`/turma/${t.id}/comunidade?filtro=duvidas`} className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md text-sm font-medium bg-warn/10 border border-warn/30 text-warn hover:bg-warn/20 transition-colors"><HelpCircle className="w-4 h-4" />Ver dúvidas ({count})</Link>}
                          <Link to={`/turma/${t.id}/comunidade`} className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md text-sm font-medium bg-panel-2 border border-line text-fg-2 hover:bg-panel-3 transition-colors"><MessageSquare className="w-4 h-4" />Comunidade</Link>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            </>
          )}
      </div>
    );
  }

  /* ══════════════════ ALUNO / PROFESSOR ══════════════════ */
  const inProgress = [...courses].filter((c) => c.total > 0 && c.done < c.total).sort((a, b) => (b.done / b.total) - (a.done / a.total));
  const featured = inProgress[0] ?? courses[0] ?? null;
  const featuredPct = featured && featured.total ? Math.round((featured.done / featured.total) * 100) : 0;

  /* ── Visão geral por faixas (12 aulas = 1 faixa) ── */
  const AULAS_POR_FAIXA = 12;
  const aulasFeitas = courses.reduce((s, c) => s + c.done, 0);
  const aulasLancadas = courses.reduce((s, c) => s + c.total, 0);
  const faixasTotais = Math.ceil(aulasLancadas / AULAS_POR_FAIXA);
  const faixasConcluidas = Math.floor(aulasFeitas / AULAS_POR_FAIXA);
  const aulasNaFaixaAtual = aulasFeitas % AULAS_POR_FAIXA;
  const faixaAtual = Math.min(faixasConcluidas + 1, Math.max(faixasTotais, 1));
  const pctFaixaAtual = Math.round((aulasNaFaixaAtual / AULAS_POR_FAIXA) * 100);
  const pctGeral = aulasLancadas ? Math.round((aulasFeitas / aulasLancadas) * 100) : 0;
  const aulasRestantes = Math.max(aulasLancadas - aulasFeitas, 0);


  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-7 flex items-center gap-3">
        <Avatar name={profile?.nome} email={profile?.email} size={44} />
        <div>
          <h1 className="mb-0.5">{firstName ? `Olá, ${firstName}` : 'Meus cursos'}</h1>
          <p className="text-fg-3 text-sm">Continue de onde parou e acompanhe seu progresso.</p>
        </div>
      </header>

      {loading ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6"><Skeleton className="h-40 w-full rounded-xl" /><div className="grid sm:grid-cols-2 gap-4">{[0, 1].map((i) => <Card key={i} className="p-5"><SkeletonText lines={3} /></Card>)}</div></div>
          <Card className="p-5"><SkeletonText lines={5} /></Card>
        </div>
      ) : courses.length === 0 && turmas.length === 0 ? (
        <EmptyState icon={<BookOpen className="w-8 h-8" />} title="Nenhum curso disponível" description="Aguarde o administrador liberar conteúdo para suas turmas." />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Visão geral: faixas e aulas */}
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4"><Target className="w-4 h-4 text-fg-2" /><h2 className="text-base">Sua evolução</h2></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-line p-3">
                  <p className="text-2xl font-display font-semibold text-fg tabular-nums">{faixasConcluidas}<span className="text-fg-3 text-base font-normal">/{faixasTotais || '—'}</span></p>
                  <p className="text-fg-3 text-xs mt-1">Faixas concluídas</p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-2xl font-display font-semibold text-brand tabular-nums">{aulasFeitas}</p>
                  <p className="text-fg-3 text-xs mt-1">Aulas feitas</p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-2xl font-display font-semibold text-fg tabular-nums">{aulasLancadas}</p>
                  <p className="text-fg-3 text-xs mt-1">Aulas lançadas</p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-2xl font-display font-semibold text-fg tabular-nums">{aulasRestantes}</p>
                  <p className="text-fg-3 text-xs mt-1">Aulas restantes</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-fg-2">Faixa atual ({faixaAtual}ª) — {aulasNaFaixaAtual}/{AULAS_POR_FAIXA} aulas</span><span className="text-brand font-medium">{pctFaixaAtual}%</span></div>
                  <ProgressBar value={pctFaixaAtual} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-fg-2">Progresso geral — {aulasFeitas}/{aulasLancadas || '—'} aulas</span><span className="text-brand font-medium">{pctGeral}%</span></div>
                  <ProgressBar value={pctGeral} />
                </div>
                <p className="text-fg-3 text-[11px]">Cada faixa equivale a {AULAS_POR_FAIXA} aulas concluídas.</p>
              </div>
            </Card>

            {/* Continuar estudando */}

            {featured && (
              <Card className="p-5 sm:p-6 relative overflow-hidden">
                <span className="absolute -right-16 -top-16 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(203,251,0,0.10), transparent 70%)' }} />
                <p className="text-brand text-[11px] font-semibold uppercase tracking-wider mb-3">Continuar estudando</p>
                <div className="flex items-start gap-4">
                  <span className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 grid place-items-center flex-shrink-0"><PlayCircle className="w-6 h-6 text-brand" /></span>
                  <div className="min-w-0 flex-1">
                    <h2 className="mb-1 truncate">{featured.titulo}</h2>
                    <p className="text-fg-3 text-sm line-clamp-2">{featured.descricao || 'Retome sua próxima aula.'}</p>
                    <div className="mt-4 space-y-2 max-w-md">
                      <div className="flex justify-between text-xs"><span className="text-fg-2">{featured.done} de {featured.total || '—'} aulas</span><span className="text-brand font-medium">{featuredPct}%</span></div>
                      <ProgressBar value={featuredPct} />
                    </div>
                    <Link to={`/curso/${featured.id}`} className="mt-4 inline-flex items-center gap-2 px-4 h-9 rounded-md text-sm font-semibold bg-brand text-brand-ink hover:bg-brand-hover transition-colors">
                      {featured.done === 0 ? 'Começar curso' : 'Continuar'}<ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </Card>
            )}

            {/* Meus cursos */}
            <section>
              <div className="flex items-center justify-between mb-3"><h2 className="text-base">Meus cursos</h2><span className="text-fg-3 text-xs">{courses.length} curso(s)</span></div>
              {courses.length === 0 ? (
                <EmptyState icon={<BookOpen className="w-7 h-7" />} title="Nenhum curso liberado" description="Suas turmas ainda não têm cursos vinculados." />
              ) : (
                <motion.div className="grid sm:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="visible">
                  {courses.map((c) => {
                    const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
                    return (
                      <motion.div key={c.id} variants={staggerItem}>
                        <Link to={`/curso/${c.id}`} className="group">
                          <Card hoverable className="p-5 h-full flex flex-col hover:border-brand/40 transition-colors">
                            <span className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center mb-3"><BookOpen className="w-5 h-5 text-brand" /></span>
                            <h3 className="mb-1.5 group-hover:text-fg transition-colors line-clamp-1">{c.titulo}</h3>
                            <p className="text-fg-3 text-sm mb-4 line-clamp-2 flex-1">{c.descricao || 'Sem descrição'}</p>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs"><span className="text-fg-2">{c.done}/{c.total} aulas</span><span className="text-brand font-medium">{pct}%</span></div>
                              <ProgressBar value={pct} />
                            </div>
                          </Card>
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </section>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            {/* Próximas atividades */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4"><CalendarClock className="w-4 h-4 text-fg-2" /><h2 className="text-base">Próximas atividades</h2></div>
              {upcoming.length === 0 ? (
                <p className="text-fg-3 text-sm py-2">Nenhuma atividade com prazo próximo.</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((a) => {
                    const d = new Date(a.prazo);
                    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
                    return (
                      <Link key={a.id} to={a.cursoId ? `/atividades/${a.turmaId}/${a.cursoId}` : '/atividades'} className="block rounded-lg border border-line p-3 hover:border-line-strong hover:bg-panel-2/40 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="text-fg text-sm font-medium truncate">{a.titulo}</p><p className="text-fg-3 text-xs mt-0.5 truncate">{a.turmaNome}</p></div>
                          <Badge tone={days <= 2 ? 'danger' : days <= 5 ? 'warn' : 'default'}>{days <= 0 ? 'hoje' : `${days}d`}</Badge>
                        </div>
                        <p className="text-fg-3 text-[11px] mt-1.5">Prazo: {d.toLocaleDateString('pt-BR')}</p>
                      </Link>
                    );
                  })}
                  <Link to="/atividades" className="inline-flex items-center gap-1 text-brand text-sm font-medium mt-1 hover:gap-2 transition-all">Ver todas<ArrowRight className="w-3.5 h-3.5" /></Link>
                </div>
              )}
            </Card>

            {/* Minhas turmas */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-fg-2" /><h2 className="text-base">Minhas turmas</h2></div>
              {turmas.length === 0 ? (
                <p className="text-fg-3 text-sm py-2">Você ainda não está em nenhuma turma.</p>
              ) : (
                <div className="space-y-1.5">
                  {turmas.map((t) => (
                    <Link key={t.id} to={`/turma/${t.id}/comunidade`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-panel-2/50 transition-colors">
                      <span className="w-8 h-8 rounded-md bg-panel-3 grid place-items-center flex-shrink-0"><MessageSquare className="w-4 h-4 text-fg-3" /></span>
                      <span className="min-w-0"><span className="block text-fg text-sm font-medium truncate">{t.nome}</span>{t.descricao && <span className="block text-fg-3 text-xs truncate">{t.descricao}</span>}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Atalhos */}
            <Card className="p-5">
              <h2 className="text-base mb-3">Atalhos</h2>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/atividades" className="flex items-center gap-2 rounded-lg border border-line p-3 hover:border-line-strong transition-colors text-sm text-fg-2"><ClipboardList className="w-4 h-4 text-fg-3" />Atividades</Link>
                <Link to="/duvidas" className="flex items-center gap-2 rounded-lg border border-line p-3 hover:border-line-strong transition-colors text-sm text-fg-2"><HelpCircle className="w-4 h-4 text-fg-3" />Dúvidas</Link>
                <Link to="/comunidade" className="flex items-center gap-2 rounded-lg border border-line p-3 hover:border-line-strong transition-colors text-sm text-fg-2 col-span-2"><MessageSquare className="w-4 h-4 text-fg-3" />Comunidade</Link>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
