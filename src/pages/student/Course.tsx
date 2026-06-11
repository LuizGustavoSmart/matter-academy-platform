import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Circle, ChevronLeft, ChevronRight,
  Check, BookOpen, Menu, X, Trophy, PlayCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ProgressBar } from '../../components/ui';
import { getYouTubeEmbed } from '../../lib/youtube';

type Aula = { id: string; titulo: string; descricao: string; youtube_url: string; ordem: number };
type Curso = { id: string; titulo: string; descricao: string };

export default function StudentCourse() {
  const { id } = useParams();
  const nav = useNavigate();
  const { profile } = useAuth();
  const [curso, setCurso] = useState<Curso | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOverview, setShowOverview] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id || !profile) return;
      const { data: c } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle();
      if (!c) { nav('/dashboard'); return; }
      setCurso(c);
      const { data: as } = await supabase.from('aulas').select('*').eq('curso_id', id).order('ordem');
      setAulas(as ?? []);
      const { data: ps } = await supabase.from('progresso').select('aula_id,concluido,updated_at').eq('user_id', profile.id);
      const doneSet = new Set((ps ?? []).filter((p) => p.concluido).map((p) => p.aula_id));
      setDone(doneSet);

      const courseAulaIds = new Set((as ?? []).map((a) => a.id));
      const lastAccessed = (ps ?? [])
        .filter((p) => courseAulaIds.has(p.aula_id))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

      // Se nunca acessou, exibe overview primeiro
      if (!lastAccessed) {
        setShowOverview(true);
        setCurrentId(as?.[0]?.id ?? null);
      } else {
        setCurrentId(lastAccessed.aula_id);
      }
      setLoading(false);
    };
    load();
  }, [id, profile]);

  const current = useMemo(() => aulas.find((a) => a.id === currentId) ?? null, [aulas, currentId]);
  const currentIdx = useMemo(() => aulas.findIndex((a) => a.id === currentId), [aulas, currentId]);
  const embed = current ? getYouTubeEmbed(current.youtube_url) : null;

  const selectAula = async (aulaId: string) => {
    setCurrentId(aulaId);
    setShowOverview(false);
    setSidebarOpen(false);
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
    if (newDone) {
      next.add(current.id);
      // Auto-avança para a próxima aula ao marcar como concluída
      if (currentIdx < aulas.length - 1) {
        setTimeout(() => selectAula(aulas[currentIdx + 1].id), 400);
      }
    } else {
      next.delete(current.id);
    }
    setDone(next);
  };

  if (loading) return <div className="max-w-6xl mx-auto px-6 py-12"><p className="meta">Carregando...</p></div>;
  if (!curso) return null;

  const pct = aulas.length ? Math.round((done.size / aulas.length) * 100) : 0;
  const isDone = current ? done.has(current.id) : false;
  const isCompleted = pct === 100 && aulas.length > 0;
  const firstUnfinished = aulas.find((a) => !done.has(a.id));
  const resumeLesson = firstUnfinished ?? aulas[0];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="px-4 lg:px-6 py-4 border-b border-[#1c1f26] flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-[#d6deed] hover:text-[#cbfb00] mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <h1 className="mb-2 truncate">{curso.titulo}</h1>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs"><ProgressBar value={pct} /></div>
            <span className="text-sm text-[#cbfb00] font-medium">{pct}%</span>
            <span className="meta hidden sm:block">{done.size}/{aulas.length} aulas</span>
          </div>
        </div>
        {/* Toggle sidebar mobile */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden mt-1 p-2 border border-[#434d5e] rounded-md text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors flex-shrink-0"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Banner de conclusão */}
      {isCompleted && !showOverview && (
        <div className="mx-4 lg:mx-6 mt-4 p-4 bg-[#cbfb00]/10 border border-[#cbfb00]/30 rounded-lg flex items-center gap-3">
          <Trophy className="w-6 h-6 text-[#cbfb00] flex-shrink-0" />
          <div>
            <p className="text-[#cbfb00] font-semibold">Curso concluído! 🎉</p>
            <p className="text-sm text-[#d6deed]">Você completou todas as {aulas.length} aulas.</p>
          </div>
        </div>
      )}

      <div className="relative grid lg:grid-cols-[320px_1fr]">
        {/* Overlay mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen
            ? 'fixed inset-y-0 left-0 z-40 w-80 bg-[#0a0a0a] overflow-y-auto scrollbar-thin shadow-2xl'
            : 'hidden'}
          lg:relative lg:flex lg:flex-col lg:w-auto lg:border-r lg:border-[#1c1f26]
          lg:min-h-[calc(100vh-64px-88px)] lg:max-h-none lg:overflow-y-auto lg:scrollbar-thin lg:shadow-none lg:bg-transparent
        `}>
          <div className="p-4">
            {/* Botão "Sobre o curso" */}
            <button
              onClick={() => { setShowOverview(true); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left mb-3 transition-colors text-sm border ${
                showOverview
                  ? 'bg-[#cbfb00]/10 border-[#cbfb00]/30 text-[#cbfb00]'
                  : 'border-transparent text-[#d6deed] hover:bg-[#111]'
              }`}
            >
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              Sobre o curso
            </button>

            <p className="meta uppercase tracking-wider mb-2 px-1">Aulas</p>
            {aulas.length === 0 ? <p className="meta px-1">Sem aulas</p> : (
              <ul className="space-y-1">
                {aulas.map((a) => {
                  const isCurrent = a.id === currentId && !showOverview;
                  const isDoneA = done.has(a.id);
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => selectAula(a.id)}
                        className={`w-full flex items-start gap-3 px-3 py-3 rounded-md text-left transition-colors border ${
                          isCurrent ? 'bg-[#cbfb00]/10 border-[#cbfb00]/30' : 'border-transparent hover:bg-[#111]'
                        }`}
                      >
                        {isDoneA
                          ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#cbfb00]" />
                          : <Circle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#434d5e]" />}
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

        {/* Conteúdo principal */}
        <section className="min-w-0 p-4 lg:p-10">
          {showOverview ? (
            /* Visão geral do curso */
            <div className="max-w-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-lg bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-[#cbfb00]" />
                </div>
                <div>
                  <h2 className="!text-white">{curso.titulo}</h2>
                  <p className="meta">{aulas.length} aulas · {pct}% concluído</p>
                </div>
              </div>

              {curso.descricao && (
                <p className="text-[#d6deed] leading-relaxed mb-8 whitespace-pre-line">{curso.descricao}</p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-[#0d0d0d] border border-[#1c1f26] rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{aulas.length}</p>
                  <p className="meta mt-1">Total</p>
                </div>
                <div className="p-4 bg-[#0d0d0d] border border-[#1c1f26] rounded-lg text-center">
                  <p className="text-2xl font-bold text-[#cbfb00]">{done.size}</p>
                  <p className="meta mt-1">Concluídas</p>
                </div>
                <div className="p-4 bg-[#0d0d0d] border border-[#1c1f26] rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{aulas.length - done.size}</p>
                  <p className="meta mt-1">Restantes</p>
                </div>
              </div>

              {resumeLesson && (
                <Button
                  variant="primary"
                  onClick={() => selectAula(resumeLesson.id)}
                  icon={<PlayCircle className="w-5 h-5" />}
                  className="!text-base !px-6 !py-3"
                >
                  {done.size === 0 ? 'Começar curso' : isCompleted ? 'Revisar curso' : 'Continuar de onde parou'}
                </Button>
              )}
            </div>
          ) : current ? (
            <>
              {/* Player */}
              <div className="aspect-video rounded-lg overflow-hidden border border-[#1c1f26] bg-black mb-6">
                {embed ? (
                  <iframe
                    src={embed}
                    title={current.titulo}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-[#434d5e] text-sm">Vídeo não disponível</div>
                )}
              </div>

              {/* Info da aula */}
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <div>
                  <p className="meta mb-1">Aula {current.ordem}</p>
                  <h2>{current.titulo}</h2>
                </div>
                <Button
                  variant={isDone ? 'primary' : 'secondary'}
                  onClick={toggleDone}
                  icon={<Check className="w-4 h-4" />}
                >
                  {isDone ? 'Concluída' : 'Marcar como concluída'}
                </Button>
              </div>

              {current.descricao && (
                <p className="text-[#d6deed] leading-relaxed mb-8 whitespace-pre-line">{current.descricao}</p>
              )}

              {/* Navegação */}
              <div className="flex justify-between pt-6 border-t border-[#1c1f26]">
                <Button
                  variant="secondary"
                  onClick={() => currentIdx > 0 && selectAula(aulas[currentIdx - 1].id)}
                  disabled={currentIdx <= 0}
                  icon={<ChevronLeft className="w-4 h-4" />}
                >
                  Aula anterior
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => currentIdx < aulas.length - 1 && selectAula(aulas[currentIdx + 1].id)}
                  disabled={currentIdx >= aulas.length - 1}
                >
                  Próxima aula <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <p className="meta">Selecione uma aula</p>
          )}
        </section>
      </div>
    </div>
  );
}
