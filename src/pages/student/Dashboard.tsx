import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, ArrowRight, Users, MessageSquare, HelpCircle, ClipboardList, PlayCircle, Target, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AvatarUpload from '../../components/AvatarUpload';
import { Card, EmptyState, Badge, Skeleton, SkeletonText, cn } from '../../components/ui';
import { staggerContainer, staggerItem } from '../../components/ui/motion';
import { SignedImage } from '../../components/SignedImage';
import { ordemDaFaixa } from '../../lib/faixa';

type CourseCard = { id: string; titulo: string; descricao: string | null; total: number; done: number; capaUrl: string | null; faixa: string | null };
type Turma = { id: string; nome: string; descricao: string | null };
type Pendente = { id: string; titulo: string; prazo: string | null; cursoId: string | null; turmaId: string; overdue: boolean };
type NextAula = { titulo: string; cursoTitulo: string; dataHora: string; linkAoVivo: string | null; started: boolean };

export default function StudentDashboard() {
  const { profile } = useAuth();
  const isMonitor = profile?.role === 'monitor';
  const firstName = (profile?.nome || profile?.email?.split('@')[0] || '').split(' ')[0];

  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [nextAula, setNextAula] = useState<NextAula | null>(null);
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

      if (isMonitor && turmaIds.length > 0) {
        const { data: duvs } = await supabase.from('community_posts').select('turma_id').eq('tipo', 'duvida').eq('status', 'aberta').in('turma_id', turmaIds);
        const counts: Record<string, number> = {};
        (duvs ?? []).forEach((d) => { counts[d.turma_id] = (counts[d.turma_id] ?? 0) + 1; });
        setDuvidasAbertas(counts);
      }

      if (!isMonitor) {
        // faixa/capa_url ainda não estão no schema gerado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cs } = cursoIds.length ? await (supabase as any).from('cursos').select('id,titulo,descricao,capa_url,faixa').in('id', cursoIds) : { data: [] };
        if ((cs ?? []).length > 0) {
          const ids = (cs ?? []).map((c: { id: string }) => c.id);
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
          setCourses((cs ?? [])
            .map((c: { id: string; titulo: string; descricao: string | null; capa_url: string | null; faixa: string | null }) => ({ ...c, capaUrl: c.capa_url, total: counts[c.id]?.total ?? 0, done: counts[c.id]?.done ?? 0 }))
            .sort((a: CourseCard, b: CourseCard) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa)));
        }

        if (turmaIds.length) {
          // Atividades ainda não enviadas (independente do prazo já ter passado ou não)
          const [{ data: ats }, { data: envios }] = await Promise.all([
            supabase.from('atividades').select('id,titulo,prazo,turma_id,curso_id').in('turma_id', turmaIds),
            supabase.from('atividade_envios').select('atividade_id,enviado_em').eq('aluno_id', profile.id),
          ]);
          const enviadoSet = new Set((envios ?? []).filter((e) => e.enviado_em).map((e) => e.atividade_id));
          const now = Date.now();
          const pend = (ats ?? [])
            .filter((a) => !enviadoSet.has(a.id))
            .map((a) => ({
              id: a.id, titulo: a.titulo, prazo: a.prazo, turmaId: a.turma_id, cursoId: a.curso_id,
              overdue: !!a.prazo && new Date(a.prazo).getTime() < now,
            }))
            .sort((a, b) => {
              if (!a.prazo && !b.prazo) return 0;
              if (!a.prazo) return 1;
              if (!b.prazo) return -1;
              return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
            });
          setPendentes(pend);

          // Próxima aula ao vivo (ou a que está em andamento) dentre as turmas/cursos do aluno
          const { data: ctFull } = await supabase.from('curso_turmas').select('turma_id,curso_id').in('turma_id', turmaIds);
          const pairSet = new Set<string>([
            ...(ut ?? []).filter((r) => r.curso_id).map((r) => `${r.turma_id}:${r.curso_id}`),
            ...(ctFull ?? []).map((r) => `${r.turma_id}:${r.curso_id}`),
          ]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: hs } = await (supabase as any)
            .from('aula_horarios')
            .select('turma_id,curso_id,data_hora,aulas(titulo),cursos(titulo,link_ao_vivo)')
            .in('turma_id', turmaIds);
          const relevant = (hs ?? []).filter((h: { turma_id: string; curso_id: string }) => pairSet.has(`${h.turma_id}:${h.curso_id}`));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let started: any = null, next: any = null;
          relevant.forEach((h: { data_hora: string }) => {
            const t = new Date(h.data_hora).getTime();
            if (t <= now && now - t < 60 * 60 * 1000) {
              if (!started || t > new Date(started.data_hora).getTime()) started = h;
            } else if (t > now) {
              if (!next || t < new Date(next.data_hora).getTime()) next = h;
            }
          });
          const chosen = started ?? next;
          if (chosen) {
            setNextAula({
              titulo: chosen.aulas?.titulo ?? 'Aula',
              cursoTitulo: chosen.cursos?.titulo ?? '',
              dataHora: chosen.data_hora,
              linkAoVivo: chosen.cursos?.link_ao_vivo ?? null,
              started: !!started,
            });
          } else {
            setNextAula(null);
          }
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
  // Cada curso (faixa) tem 12 aulas previstas no total
  const faixasTotais = Math.max(courses.length, Math.ceil(aulasLancadas / AULAS_POR_FAIXA));
  const aulasTotais = faixasTotais * AULAS_POR_FAIXA;
  const faixasConcluidas = courses.filter((c) => c.total > 0 && c.done >= AULAS_POR_FAIXA).length;
  const aulasNaFaixaAtual = aulasFeitas % AULAS_POR_FAIXA;
  const faixaAtual = Math.min(faixasConcluidas + 1, Math.max(faixasTotais, 1));
  const pctFaixaAtual = Math.round((aulasNaFaixaAtual / AULAS_POR_FAIXA) * 100);
  const pctFeitas = aulasTotais ? (aulasFeitas / aulasTotais) * 100 : 0;
  const pctLancadas = aulasTotais ? (Math.max(aulasLancadas - aulasFeitas, 0) / aulasTotais) * 100 : 0;
  const pctGeral = aulasTotais ? Math.round((aulasFeitas / aulasTotais) * 100) : 0;
  const aulasRestantes = Math.max(aulasTotais - aulasFeitas, 0);
  const aulasNaoLancadas = Math.max(aulasTotais - aulasLancadas, 0);

  /* ── Card "Continuar estudando": mesmo modelo (feitas / lançadas / totais) ── */
  const featuredTotais = Math.max(AULAS_POR_FAIXA, featured?.total ?? 0);
  const featuredPctFeitas = featured ? ((featured.done / featuredTotais) * 100) : 0;
  const featuredPctLancadas = featured ? (Math.max(featured.total - featured.done, 0) / featuredTotais) * 100 : 0;




  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-5 rounded-xl border border-brand/25 bg-gradient-to-r from-brand/15 via-brand/5 to-transparent p-4">
        <p className="text-fg text-sm sm:text-base font-medium">
          {firstName ? `Que bom ver você por aqui, ${firstName}!` : 'Que bom ver você por aqui!'}
        </p>
        <p className="text-fg-2 text-xs sm:text-sm mt-0.5">A consistência é essencial para seu aprendizado.</p>
      </div>

      <header className="mb-7 flex items-center gap-3">
        <AvatarUpload size={44} />
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
                  <p className="text-fg-3 text-xs mt-1 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand inline-block" />Aulas feitas</p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-2xl font-display font-semibold text-fg tabular-nums">{aulasLancadas}</p>
                  <p className="text-fg-3 text-xs mt-1 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand/40 inline-block" />Aulas lançadas</p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-2xl font-display font-semibold text-fg tabular-nums">{aulasTotais}</p>
                  <p className="text-fg-3 text-xs mt-1 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-line inline-block" />Aulas totais</p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {/* Progresso geral: feitas / lançadas / totais */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-2">Progresso geral — {aulasFeitas} de {aulasTotais} aulas</span>
                    <span className="text-brand font-medium tabular-nums">{pctGeral}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-line/60 overflow-hidden flex">
                    <div className="h-full bg-brand transition-all duration-500" style={{ width: `${pctFeitas}%` }} />
                    <div className="h-full bg-brand/40 transition-all duration-500" style={{ width: `${pctLancadas}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-3">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand inline-block" />{aulasFeitas} feitas</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand/40 inline-block" />{Math.max(aulasLancadas - aulasFeitas, 0)} lançadas a fazer</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-line inline-block" />{aulasNaoLancadas} ainda não lançadas</span>
                  </div>
                </div>

                {/* Faixa atual em blocos de 12 */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-2">Faixa atual ({faixaAtual}ª) — {aulasNaFaixaAtual}/{AULAS_POR_FAIXA} aulas</span>
                    <span className="text-brand font-medium tabular-nums">{pctFaixaAtual}%</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: AULAS_POR_FAIXA }).map((_, i) => (
                      <div key={i} className={cn('h-2.5 flex-1 rounded-sm transition-colors', i < aulasNaFaixaAtual ? 'bg-brand' : 'bg-line/60')} />
                    ))}
                  </div>
                </div>

                <p className="text-fg-3 text-[11px]">Cada faixa equivale a {AULAS_POR_FAIXA} aulas — {aulasRestantes} aulas restantes para concluir todas as faixas.</p>
              </div>
            </Card>


            {/* Continuar estudando */}

            {featured && (
              <Card className="p-0 relative overflow-hidden">
                <div className="relative h-44 sm:h-56">
                  {featured.capaUrl ? (
                    <>
                      <SignedImage bucket="capas" path={featured.capaUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-brand/10 grid place-items-center"><PlayCircle className="w-8 h-8 text-brand" /></div>
                  )}
                  <p className="absolute top-3 left-4 text-brand text-[11px] font-semibold uppercase tracking-wider">Continuar estudando</p>
                  <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
                    <div className="flex justify-between text-xs"><span className="text-white/90">{featured.done} de {featuredTotais} aulas</span><span className="text-white font-medium tabular-nums">{featuredPct}%</span></div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
                    <div className="h-full bg-brand transition-all duration-500" style={{ width: `${featuredPctFeitas}%` }} />
                    <div className="h-full bg-brand/40 transition-all duration-500" style={{ width: `${featuredPctLancadas}%` }} />
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <h2 className="mb-1 truncate">{featured.titulo}</h2>
                  <p className="text-fg-3 text-sm line-clamp-2">{featured.descricao || 'Retome sua próxima aula.'}</p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-3 max-w-md">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand inline-block" />{featured.done} feitas</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand/40 inline-block" />{Math.max(featured.total - featured.done, 0)} lançadas a fazer</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-line inline-block" />{Math.max(featuredTotais - featured.total, 0)} ainda não lançadas</span>
                  </div>

                  <Link to={`/curso/${featured.id}`} className="mt-4 inline-flex items-center gap-2 px-4 h-9 rounded-md text-sm font-semibold bg-brand text-brand-ink hover:bg-brand-hover transition-colors">
                    {featured.done === 0 ? 'Começar curso' : 'Continuar'}<ArrowRight className="w-4 h-4" />
                  </Link>
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
                    const total = Math.max(AULAS_POR_FAIXA, c.total);
                    const pct = total ? Math.round((c.done / total) * 100) : 0;
                    return (
                      <motion.div key={c.id} variants={staggerItem}>
                        <Link to={`/curso/${c.id}`} className="group">
                          <Card hoverable className="p-0 overflow-hidden hover:border-brand/40 transition-colors">
                            <div className="relative h-44">
                              {c.capaUrl ? (
                                <>
                                  <SignedImage bucket="capas" path={c.capaUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                                </>
                              ) : (
                                <div className="absolute inset-0 bg-brand/10 grid place-items-center"><BookOpen className="w-8 h-8 text-brand" /></div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 px-4 pb-2">
                                <div className="flex justify-between text-xs"><span className="text-white/85">{c.done}/{total} aulas</span><span className="text-white font-medium">{pct}%</span></div>
                              </div>
                              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
                                <div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            <div className="p-4 pt-3">
                              <h3 className="mb-1 group-hover:text-fg transition-colors line-clamp-1">{c.titulo}</h3>
                              <p className="text-fg-3 text-sm line-clamp-1">{c.descricao || 'Sem descrição'}</p>
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
            {/* Próxima aula ao vivo */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4"><Video className="w-4 h-4 text-fg-2" /><h2 className="text-base">Próxima aula</h2></div>
              {!nextAula ? (
                <p className="text-fg-3 text-sm py-2">Nenhuma aula agendada por enquanto.</p>
              ) : nextAula.started ? (
                <div className="flex flex-col items-center text-center py-2">
                  <p className="text-danger text-lg font-display font-semibold">A aula já começou!</p>
                  {nextAula.linkAoVivo && (
                    <a href={nextAula.linkAoVivo} target="_blank" rel="noopener" className="mt-4 inline-flex items-center justify-center gap-2 w-full h-9 rounded-md text-sm font-semibold bg-brand text-brand-ink hover:bg-brand-hover transition-colors">Acesse aqui</a>
                  )}
                  <p className="text-fg-3 text-xs font-medium mt-4 truncate max-w-full">{nextAula.cursoTitulo}</p>
                  <p className="text-fg-3 text-xs mt-0.5 truncate max-w-full">{nextAula.titulo}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center py-2">
                  <p className="text-fg-3 text-xs">Próxima aula acontece em:</p>
                  <NextAulaCountdown dataHora={nextAula.dataHora} />
                  <p className="text-fg-3 text-xs font-medium mt-3 truncate max-w-full">{nextAula.cursoTitulo}</p>
                  <p className="text-fg-3 text-xs mt-0.5 truncate max-w-full">{nextAula.titulo}</p>
                </div>
              )}
              <Link to="/cronograma" className="inline-flex items-center gap-1 text-brand text-sm font-medium mt-3 hover:gap-2 transition-all">Ver todas<ArrowRight className="w-3.5 h-3.5" /></Link>
            </Card>

            {/* Atividades pendentes */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4"><ClipboardList className="w-4 h-4 text-fg-2" /><h2 className="text-base">Atividades</h2></div>
              {pendentes.length === 0 ? (
                <p className="text-fg-3 text-sm py-2">Nenhuma atividade pendente. 🎉</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {pendentes.map((a) => (
                    <Link key={a.id} to={a.cursoId ? `/atividades/${a.turmaId}/${a.cursoId}` : '/atividades'} className={cn('block rounded-lg border p-3 transition-colors', a.overdue ? 'border-danger/30 bg-danger/[0.04] hover:bg-danger/[0.08]' : 'border-line hover:border-line-strong hover:bg-panel-2/40')}>
                      <p className={cn('text-sm font-medium truncate', a.overdue ? 'text-danger' : 'text-fg')}>{a.titulo}</p>
                      <p className={cn('text-xs mt-0.5', a.overdue ? 'text-danger/80' : 'text-fg-3')}>
                        {a.prazo ? `Vencimento: ${new Date(a.prazo).toLocaleDateString('pt-BR')}` : 'Sem prazo definido'}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
              <Link to="/atividades" className="inline-flex items-center gap-1 text-brand text-sm font-medium mt-3 hover:gap-2 transition-all">Ver todas<ArrowRight className="w-3.5 h-3.5" /></Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function NextAulaCountdown({ dataHora }: { dataHora: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(dataHora).getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return (
    <p className="text-fg text-3xl font-display font-semibold tabular-nums mt-1">{days}d {hours}h {minutes}m</p>
  );
}
