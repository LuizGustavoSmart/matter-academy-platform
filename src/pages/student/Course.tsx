import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Check, HelpCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ProgressBar, Toast } from '../../components/ui';
import LessonVideoPlayer from '../../components/LessonVideoPlayer';
import DuvidaModal from './DuvidaModal';

type Aula = { id: string; titulo: string; descricao: string | null; ordem: number };
type Curso = { id: string; titulo: string; descricao: string | null };

export default function StudentCourse() {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const [curso, setCurso] = useState<Curso | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [duvidaOpen, setDuvidaOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id || !profile) return;
      const { data: c } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle();
      if (!c) { nav('/dashboard'); return; }
      setCurso(c);
      const { data: as } = await (supabase as any)
        .from('lessons_public')
        .select('id,titulo,descricao,ordem')
        .eq('curso_id', id)
        .order('ordem');
      setAulas((as ?? []) as Aula[]);
      const { data: ps } = await supabase.from('progresso').select('aula_id,concluido,updated_at').eq('user_id', profile.id);
      const doneSet = new Set((ps ?? []).filter((p) => p.concluido).map((p) => p.aula_id));
      setDone(doneSet);

      const courseAulaIds = new Set((as ?? []).map((a: Aula) => a.id));
      const requestedAula = searchParams.get('aula');
      if (requestedAula && courseAulaIds.has(requestedAula)) {
        setCurrentId(requestedAula);
        setLoading(false);
        return;
      }
      const lastAccessed = (ps ?? [])
        .filter((p) => courseAulaIds.has(p.aula_id))
        .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())[0];
      setCurrentId(lastAccessed?.aula_id ?? (as?.[0]?.id ?? null));
      setLoading(false);
    };
    load();
  }, [id, profile]);

  const current = useMemo(() => aulas.find((a) => a.id === currentId) ?? null, [aulas, currentId]);
  const currentIdx = useMemo(() => aulas.findIndex((a) => a.id === currentId), [aulas, currentId]);

  const selectAula = async (aulaId: string) => {
    setCurrentId(aulaId);
    if (profile) {
      await supabase.from('progresso').upsert(
        { user_id: profile.id, aula_id: aulaId, concluido: done.has(aulaId), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,aula_id' }
      );
    }
  };

  const toggleDone = async () => {
    if (!current || !profile) return;
    const newDone = !done.has(current.id);
    await supabase.from('progresso').upsert(
      { user_id: profile.id, aula_id: current.id, concluido: newDone, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,aula_id' }
    );
    const next = new Set(done);
    if (newDone) next.add(current.id); else next.delete(current.id);
    setDone(next);
  };

  const markCurrentDone = async () => {
    if (!current || !profile || done.has(current.id)) return;
    await supabase.from('progresso').upsert(
      { user_id: profile.id, aula_id: current.id, concluido: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,aula_id' }
    );
    setDone((prev) => new Set(prev).add(current.id));
  };

  const goNext = () => {
    const next = aulas[currentIdx + 1];
    if (next) selectAula(next.id);
  };

  if (loading) return <div className="max-w-6xl mx-auto px-6 py-12"><p className="meta">Carregando...</p></div>;
  if (!curso) return null;

  const pct = aulas.length ? Math.round((done.size / aulas.length) * 100) : 0;
  const isDone = current ? done.has(current.id) : false;
  const hasNext = currentIdx < aulas.length - 1;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="px-6 py-6 border-b border-[#1c1f26]">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-[#d6deed] hover:text-[#cbfb00] mb-3 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="mb-2">{curso.titulo}</h1>
        <div className="flex items-center gap-4 max-w-md">
          <div className="flex-1"><ProgressBar value={pct} /></div>
          <span className="text-sm text-[#cbfb00] font-medium">{pct}%</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-0">
        <aside className="border-r border-[#1c1f26] lg:min-h-[calc(100vh-64px-112px)] max-h-[600px] lg:max-h-none overflow-y-auto scrollbar-thin">
          <div className="p-4">
            <p className="meta uppercase tracking-wider mb-3">Conteúdo</p>
            {aulas.length === 0 ? <p className="meta">Sem aulas</p> : (
              <ul className="space-y-1">
                {aulas.map((a) => {
                  const isCurrent = a.id === currentId;
                  const isDoneA = done.has(a.id);
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => selectAula(a.id)}
                        className={`w-full flex items-start gap-3 px-3 py-3 rounded-md text-left transition-colors ${
                          isCurrent ? 'bg-[#cbfb00]/10 border border-[#cbfb00]/30' : 'hover:bg-[#111] border border-transparent'
                        }`}
                      >
                        {isDoneA ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#cbfb00]" /> : <Circle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#434d5e]" />}
                        <div className="min-w-0 flex-1">
                          <p className="meta">Aula {a.ordem}</p>
                          <p className={`text-sm truncate ${isCurrent ? 'text-white font-medium' : 'text-[#d6deed]'}`}>{a.titulo}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="p-6 lg:p-10">
          {current ? (
            <>
              <div className="mb-6">
                <LessonVideoPlayer
                  key={current.id}
                  lessonId={current.id}
                  hasNext={hasNext}
                  onEnded={markCurrentDone}
                  onNext={goNext}
                />
              </div>

              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="meta mb-1">Aula {current.ordem}</p>
                  <h2>{current.titulo}</h2>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setDuvidaOpen(true)}
                    icon={<HelpCircle className="w-4 h-4" />}
                  >
                    Tirar dúvida
                  </Button>
                  <Button
                    variant={isDone ? 'primary' : 'secondary'}
                    onClick={toggleDone}
                    icon={<Check className="w-4 h-4" />}
                  >
                    {isDone ? 'Concluída' : 'Marcar como concluída'}
                  </Button>
                </div>
              </div>

              {current.descricao && <p className="text-[#d6deed] leading-relaxed mb-8 whitespace-pre-line">{current.descricao}</p>}

              <div className="flex justify-between pt-6 border-t border-[#1c1f26]">
                <Button
                  variant="secondary"
                  onClick={() => selectAula(aulas[currentIdx - 1].id)}
                  disabled={currentIdx <= 0}
                >
                  Aula anterior
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => selectAula(aulas[currentIdx + 1].id)}
                  disabled={currentIdx >= aulas.length - 1}
                >
                  Próxima aula
                </Button>
              </div>
            </>
          ) : (
            <p className="meta">Selecione uma aula</p>
          )}
        </section>
      </div>

      {current && (
        <DuvidaModal
          open={duvidaOpen}
          aulaId={current.id}
          cursoId={curso.id}
          onClose={() => setDuvidaOpen(false)}
          onDone={() => {
            setDuvidaOpen(false);
            setToast('Dúvida enviada! Acompanhe em "Dúvidas" no menu.');
            setTimeout(() => setToast(null), 3500);
          }}
        />
      )}
      <Toast message={toast} tone="success" />
    </div>
  );
}
