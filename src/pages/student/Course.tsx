import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Check, HelpCircle, CalendarDays, Flame, Clock, Sparkles, Trophy, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ProgressBar, Skeleton, useToast, cn } from '../../components/ui';
import LessonVideoPlayer from '../../components/LessonVideoPlayer';
import DuvidaModal from './DuvidaModal';


type Aula = { id: string; titulo: string; descricao: string | null; ordem: number };
type Curso = { id: string; titulo: string; descricao: string | null };

export default function StudentCourse() {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const toast = useToast();
  const [curso, setCurso] = useState<Curso | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [duvidaOpen, setDuvidaOpen] = useState(false);
  const [daysSince, setDaysSince] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id || !profile) return;
      const { data: c } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle();
      if (!c) { nav('/dashboard'); return; }
      setCurso(c);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: as } = await (supabase as any).from('lessons_public').select('id,titulo,descricao,ordem').eq('curso_id', id).order('ordem');
      setAulas((as ?? []) as Aula[]);
      const { data: ps } = await supabase.from('progresso').select('aula_id,concluido,updated_at').eq('user_id', profile.id);
      setDone(new Set((ps ?? []).filter((p) => p.concluido).map((p) => p.aula_id)));
      const courseAulaIds = new Set((as ?? []).map((a: Aula) => a.id));
      const lastAccessed = (ps ?? []).filter((p) => courseAulaIds.has(p.aula_id)).sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())[0];
      if (lastAccessed?.updated_at) {
        const diffMs = Date.now() - new Date(lastAccessed.updated_at).getTime();
        setDaysSince(Math.max(0, Math.floor(diffMs / 86_400_000)));
      } else {
        setDaysSince(null);
      }
      const requestedAula = searchParams.get('aula');
      if (requestedAula && courseAulaIds.has(requestedAula)) { setCurrentId(requestedAula); setLoading(false); return; }
      setCurrentId(lastAccessed?.aula_id ?? (as?.[0]?.id ?? null));
      setLoading(false);
    };

    load();
  }, [id, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = useMemo(() => aulas.find((a) => a.id === currentId) ?? null, [aulas, currentId]);
  const currentIdx = useMemo(() => aulas.findIndex((a) => a.id === currentId), [aulas, currentId]);

  const selectAula = async (aulaId: string) => {
    setCurrentId(aulaId);
    if (profile) await supabase.from('progresso').upsert({ user_id: profile.id, aula_id: aulaId, concluido: done.has(aulaId), updated_at: new Date().toISOString() }, { onConflict: 'user_id,aula_id' });
  };
  const toggleDone = async () => {
    if (!current || !profile) return;
    const newDone = !done.has(current.id);
    await supabase.from('progresso').upsert({ user_id: profile.id, aula_id: current.id, concluido: newDone, updated_at: new Date().toISOString() }, { onConflict: 'user_id,aula_id' });
    const next = new Set(done);
    if (newDone) next.add(current.id); else next.delete(current.id);
    setDone(next);
  };
  const markCurrentDone = async () => {
    if (!current || !profile || done.has(current.id)) return;
    await supabase.from('progresso').upsert({ user_id: profile.id, aula_id: current.id, concluido: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id,aula_id' });
    setDone((prev) => new Set(prev).add(current.id));
  };
  const goNext = () => { const next = aulas[currentIdx + 1]; if (next) selectAula(next.id); };

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8"><Skeleton className="h-8 w-full max-w-64 mb-6" /><div className="grid lg:grid-cols-[320px_1fr] gap-6"><Skeleton className="h-64 sm:h-96 rounded-xl" /><Skeleton className="h-64 sm:h-96 rounded-xl" /></div></div>;
  if (!curso) return null;

  const pct = aulas.length ? Math.round((done.size / aulas.length) * 100) : 0;
  const isDone = current ? done.has(current.id) : false;
  const hasNext = currentIdx < aulas.length - 1;
  const restantes = Math.max(aulas.length - done.size, 0);

  const aviso = (() => {
    if (aulas.length > 0 && done.size >= aulas.length) {
      return { icon: <Trophy className="w-5 h-5" />, title: 'Faixa concluída!', text: 'Você finalizou todas as aulas deste curso. Que tal revisar ou avançar para a próxima faixa?' };
    }
    if (daysSince === null) {
      return { icon: <Sparkles className="w-5 h-5" />, title: 'Bora começar!', text: 'Sua primeira aula está esperando por você. Um passo por dia já muda o jogo.' };
    }
    if (daysSince === 0) {
      return { icon: <Flame className="w-5 h-5" />, title: 'Você está no ritmo!', text: `Já estudou hoje. Faltam ${restantes} aula${restantes === 1 ? '' : 's'} para concluir esta faixa.` };
    }
    if (daysSince === 1) {
      return { icon: <Flame className="w-5 h-5" />, title: 'Sequência quase intacta', text: 'Você estudou ontem — assista mais uma aula hoje e mantenha o ritmo.' };
    }
    if (daysSince <= 6) {
      return { icon: <Clock className="w-5 h-5" />, title: `Você está há ${daysSince} dias sem acessar suas aulas`, text: 'Bora manter o ritmo? Só uma aula já te coloca de volta no jogo.' };
    }
    if (daysSince <= 20) {
      return { icon: <Clock className="w-5 h-5" />, title: `Já são ${daysSince} dias longe das aulas`, text: `Você tem ${restantes} aula${restantes === 1 ? '' : 's'} restante${restantes === 1 ? '' : 's'} nesta faixa. Retome agora, do ponto onde parou.` };
    }
    return { icon: <PlayCircle className="w-5 h-5" />, title: `Faz ${daysSince} dias desde o seu último acesso`, text: 'Nunca é tarde para voltar. Comece com a próxima aula e reconstrua seu ritmo.' };
  })();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="px-4 sm:px-6 py-6 border-b border-line">
        <div className="flex items-center justify-between mb-4">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
          <Link to={`/curso/${id}/cronograma`} className="inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-brand transition-colors"><CalendarDays className="w-4 h-4" /> Cronograma</Link>
        </div>

        {/* Aviso motivacional */}
        <div className="mb-5 rounded-xl border border-brand/25 bg-gradient-to-r from-brand/15 via-brand/5 to-transparent p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand/15 text-brand flex items-center justify-center">{aviso.icon}</div>
          <div className="min-w-0">
            <p className="text-fg text-sm font-medium">{aviso.title}</p>
            <p className="text-fg-2 text-xs sm:text-sm mt-0.5">{aviso.text}</p>
          </div>
        </div>

        <h1 className="mb-3">{curso.titulo}</h1>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs rounded-full border border-line px-2.5 py-1 text-fg-2"><CheckCircle2 className="w-3.5 h-3.5 text-brand" />{done.size} concluída{done.size === 1 ? '' : 's'}</span>
          <span className="inline-flex items-center gap-1.5 text-xs rounded-full border border-line px-2.5 py-1 text-fg-2"><PlayCircle className="w-3.5 h-3.5 text-fg-3" />{restantes} restante{restantes === 1 ? '' : 's'}</span>
          <span className="inline-flex items-center gap-1.5 text-xs rounded-full border border-line px-2.5 py-1 text-fg-2"><Clock className="w-3.5 h-3.5 text-fg-3" />{daysSince === null ? 'Primeiro acesso' : daysSince === 0 ? 'Acessou hoje' : `Há ${daysSince} dia${daysSince === 1 ? '' : 's'}`}</span>
        </div>
        <div className="flex items-center gap-3 max-w-md"><div className="flex-1"><ProgressBar value={pct} /></div><span className="text-sm text-brand font-medium tabular-nums">{pct}%</span></div>
      </div>


      <div className="grid lg:grid-cols-[320px_1fr] gap-0">
        <aside className="border-b lg:border-b-0 lg:border-r border-line lg:min-h-[calc(100vh-64px-120px)] max-h-[260px] lg:max-h-none overflow-y-auto scrollbar-thin">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider">Conteúdo</p>
              <span className="text-fg-3 text-[11px] tabular-nums">{done.size}/{aulas.length}</span>
            </div>
            {aulas.length === 0 ? <p className="text-fg-3 text-sm">Sem aulas</p> : (
              <ul className="space-y-1">
                {aulas.map((a) => {
                  const isCurrent = a.id === currentId;
                  const isDoneA = done.has(a.id);
                  return (
                    <li key={a.id}>
                      <button onClick={() => selectAula(a.id)} className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border', isCurrent ? 'bg-brand/10 border-brand/30 shadow-sm' : 'hover:bg-panel-2 hover:border-line border-transparent')}>
                        <span className={cn('w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-medium tabular-nums transition-colors', isDoneA ? 'bg-brand/15 text-brand' : isCurrent ? 'bg-brand text-brand-fg' : 'bg-panel-2 text-fg-3')}>
                          {isDoneA ? <CheckCircle2 className="w-4 h-4" /> : isCurrent ? <PlayCircle className="w-4 h-4" /> : a.ordem}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-fg-3 text-[11px]">Aula {a.ordem}</p>
                          <p className={cn('text-sm truncate', isCurrent ? 'text-fg font-medium' : 'text-fg-2')}>{a.titulo}</p>
                        </div>
                        {isDoneA && <Check className="w-3.5 h-3.5 text-brand flex-shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="p-4 sm:p-6 lg:p-8">
          {current ? (
            <>
              <div className="mb-6"><LessonVideoPlayer key={current.id} lessonId={current.id} hasNext={hasNext} onEnded={markCurrentDone} onNext={goNext} /></div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                <div className="min-w-0"><p className="text-fg-3 text-xs mb-1">Aula {current.ordem}</p><h2 className="break-words">{current.titulo}</h2></div>
                <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
                  <Button variant="secondary" onClick={() => setDuvidaOpen(true)} icon={<HelpCircle className="w-4 h-4" />}>Tirar dúvida</Button>
                  <Button variant={isDone ? 'primary' : 'secondary'} onClick={toggleDone} icon={<Check className="w-4 h-4" />}>{isDone ? 'Concluída' : 'Marcar como concluída'}</Button>
                </div>
              </div>
              {current.descricao && <p className="text-fg-2 leading-relaxed mb-8 whitespace-pre-line break-words">{current.descricao}</p>}
              <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-3 pt-6 border-t border-line">
                <Button variant="secondary" onClick={() => selectAula(aulas[currentIdx - 1].id)} disabled={currentIdx <= 0}>Aula anterior</Button>
                <Button variant="secondary" onClick={() => selectAula(aulas[currentIdx + 1].id)} disabled={currentIdx >= aulas.length - 1}>Próxima aula</Button>
              </div>
            </>
          ) : <p className="text-fg-3">Selecione uma aula</p>}
        </section>
      </div>

      {current && (
        <DuvidaModal open={duvidaOpen} aulaId={current.id} cursoId={curso.id} onClose={() => setDuvidaOpen(false)}
          onDone={() => { setDuvidaOpen(false); toast.success('Dúvida enviada! Acompanhe em "Dúvidas" no menu.'); }} />
      )}
    </div>
  );
}
