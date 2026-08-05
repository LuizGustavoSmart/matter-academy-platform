import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, ClipboardList, Clock, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, EmptyState, ProgressBar, Skeleton, cn } from '../../components/ui';

type Curso = { id: string; titulo: string };
type Aula = { id: string; titulo: string; ordem: number };
type Atividade = { id: string; titulo: string; aula_id: string | null; prazo: string | null; nota_maxima: number };
type Envio = { atividade_id: string; enviado_em: string | null; nota: number | null; corrigido_em: string | null };

function deadlineInfo(prazo: string | null): { text: string; cls: string } {
  if (!prazo) return { text: 'Sem prazo', cls: 'text-fg-3' };
  const days = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: 'Prazo encerrado', cls: 'text-danger' };
  if (days === 0) return { text: 'Vence hoje', cls: 'text-warn' };
  if (days <= 3) return { text: `${days} dia(s) restante(s)`, cls: 'text-warn' };
  return { text: new Date(prazo).toLocaleDateString('pt-BR'), cls: 'text-fg-3' };
}

function statusBadge(atividade: Atividade, envio: Envio | undefined) {
  if (envio?.corrigido_em) return <Badge tone="success" dot>Corrigida — {envio.nota}/{atividade.nota_maxima}</Badge>;
  if (envio?.enviado_em) return <Badge tone="info" dot>Enviada</Badge>;
  if (atividade.prazo && new Date(atividade.prazo) < new Date()) return <Badge tone="danger" dot>Atrasada</Badge>;
  return <Badge tone="warn" dot>Pendente</Badge>;
}

export default function Cronograma() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const isStudent = profile?.role === 'student';

  const [curso, setCurso] = useState<Curso | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [envios, setEnvios] = useState<Record<string, Envio>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !profile) return;
    (async () => {
      setLoading(true);
      const { data: c } = await supabase.from('cursos').select('id,titulo').eq('id', id).maybeSingle();
      if (!c) { nav('/dashboard'); return; }
      setCurso(c);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: as } = await (supabase as any).from('lessons_public').select('id,titulo,ordem').eq('curso_id', id).order('ordem');
      setAulas((as ?? []) as Aula[]);
      const { data: ps } = await supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true);
      setDone(new Set((ps ?? []).map((p) => p.aula_id)));
      const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id).eq('curso_id', id);
      const turmaIds = [...new Set((ut ?? []).map((r) => r.turma_id))];
      if (turmaIds.length) {
        const { data: ats } = await supabase.from('atividades').select('id,titulo,aula_id,prazo,nota_maxima').eq('curso_id', id).in('turma_id', turmaIds);
        setAtividades((ats ?? []) as Atividade[]);
        const atividadeIds = (ats ?? []).map((a) => a.id);
        if (atividadeIds.length && isStudent) {
          const { data: es } = await supabase.from('atividade_envios').select('atividade_id,enviado_em,nota,corrigido_em').eq('aluno_id', profile.id).in('atividade_id', atividadeIds);
          const map: Record<string, Envio> = {};
          (es ?? []).forEach((e) => { map[e.atividade_id] = e as Envio; });
          setEnvios(map);
        }
      }
      setLoading(false);
    })();
  }, [id, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8"><Skeleton className="h-8 w-64 mb-6" /><Skeleton className="h-80 rounded-xl" /></div>;
  if (!curso) return null;

  const atividadesPorAula: Record<string, Atividade[]> = {};
  const atividadesGerais: Atividade[] = [];
  atividades.forEach((a) => { if (a.aula_id) (atividadesPorAula[a.aula_id] ??= []).push(a); else atividadesGerais.push(a); });
  atividadesGerais.sort((a, b) => { if (!a.prazo) return 1; if (!b.prazo) return -1; return new Date(a.prazo).getTime() - new Date(b.prazo).getTime(); });
  const pct = aulas.length ? Math.round((done.size / aulas.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link to={`/curso/${curso.id}`} className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg mb-3 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar ao curso</Link>
      <header className="mb-8">
        <h1 className="mb-3">Cronograma — {curso.titulo}</h1>
        <div className="flex items-center gap-3 max-w-md"><div className="flex-1"><ProgressBar value={pct} /></div><span className="text-sm text-brand font-medium tabular-nums">{pct}% concluído</span></div>
      </header>

      {aulas.length === 0 ? (
        <EmptyState icon={<PlayCircle className="w-8 h-8" />} title="Nenhuma aula neste curso" />
      ) : (
        <ol className="relative border-l border-line ml-3 space-y-8">
          {aulas.map((aula) => {
            const isDone = done.has(aula.id);
            const relacionadas = atividadesPorAula[aula.id] ?? [];
            return (
              <li key={aula.id} className="ml-6">
                <span className={cn('absolute -left-[9px] w-4 h-4 rounded-full border-2', isDone ? 'bg-brand border-brand' : 'bg-canvas border-line-strong')} />
                <button onClick={() => nav(`/curso/${curso.id}?aula=${aula.id}`)} className="flex items-center gap-2 text-left group">
                  {isDone ? <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0" /> : <Circle className="w-4 h-4 text-fg-3 flex-shrink-0" />}
                  <span className="text-fg-3 text-xs">Aula {aula.ordem}</span>
                  <span className="text-fg font-medium group-hover:text-brand transition-colors">{aula.titulo}</span>
                </button>
                {relacionadas.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {relacionadas.map((a) => {
                      const dl = deadlineInfo(a.prazo);
                      return (
                        <Link key={a.id} to={`/atividade/${a.id}`} className="flex items-center justify-between gap-3 pl-6 py-2 border-l-2 border-line hover:border-brand/40 transition-colors">
                          <span className="flex items-center gap-2 min-w-0"><ClipboardList className="w-3.5 h-3.5 text-fg-3 flex-shrink-0" /><span className="text-sm text-fg-2 truncate">{a.titulo}</span></span>
                          <span className="flex items-center gap-2 flex-shrink-0"><span className={cn('text-xs', dl.cls)}><Clock className="w-3 h-3 inline mr-1" />{dl.text}</span>{isStudent && statusBadge(a, envios[a.id])}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {atividadesGerais.length > 0 && (
        <div className="mt-12">
          <p className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider mb-4">Outras atividades do curso</p>
          <div className="space-y-2">
            {atividadesGerais.map((a) => {
              const dl = deadlineInfo(a.prazo);
              return (
                <Link key={a.id} to={`/atividade/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-line hover:border-brand/40 transition-colors">
                  <span className="flex items-center gap-2 min-w-0"><ClipboardList className="w-4 h-4 text-fg-3 flex-shrink-0" /><span className="text-sm text-fg truncate">{a.titulo}</span></span>
                  <span className="flex items-center gap-2 flex-shrink-0"><span className={cn('text-xs', dl.cls)}><Clock className="w-3 h-3 inline mr-1" />{dl.text}</span>{isStudent && statusBadge(a, envios[a.id])}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
