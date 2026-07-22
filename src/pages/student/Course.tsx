import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Check, HelpCircle, CalendarDays } from 'lucide-react';
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
      const requestedAula = searchParams.get('aula');
      if (requestedAula && courseAulaIds.has(requestedAula)) { setCurrentId(requestedAula); setLoading(false); return; }
      const lastAccessed = (ps ?? []).filter((p) => courseAulaIds.has(p.aula_id)).sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())[0];
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="px-4 sm:px-6 py-6 border-b border-line">
        <div className="flex items-center justify-between mb-3">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
          <Link to={`/curso/${id}/cronograma`} className="inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-brand transition-colors"><CalendarDays className="w-4 h-4" /> Cronograma</Link>
        </div>
        <h1 className="mb-3">{curso.titulo}</h1>
        <div className="flex items-center gap-3 max-w-md"><div className="flex-1"><ProgressBar value={pct} /></div><span className="text-sm text-brand font-medium tabular-nums">{pct}%</span></div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-0">
        <aside className="border-b lg:border-b-0 lg:border-r border-line lg:min-h-[calc(100vh-64px-120px)] max-h-[260px] lg:max-h-none overflow-y-auto scrollbar-thin">
          <div className="p-4">
            <p className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider mb-3">Conteúdo</p>
            {aulas.length === 0 ? <p className="text-fg-3 text-sm">Sem aulas</p> : (
              <ul className="space-y-1">
                {aulas.map((a) => {
                  const isCurrent = a.id === currentId;
                  const isDoneA = done.has(a.id);
                  return (
                    <li key={a.id}>
                      <button onClick={() => selectAula(a.id)} className={cn('w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border', isCurrent ? 'bg-brand/10 border-brand/30' : 'hover:bg-panel-2 border-transparent')}>
                        {isDoneA ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand" /> : <Circle className="w-4 h-4 mt-0.5 flex-shrink-0 text-fg-3" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-fg-3 text-[11px]">Aula {a.ordem}</p>
                          <p className={cn('text-sm truncate', isCurrent ? 'text-fg font-medium' : 'text-fg-2')}>{a.titulo}</p>
                        </div>
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
