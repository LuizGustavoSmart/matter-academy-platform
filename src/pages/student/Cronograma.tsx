import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, ClipboardList, Clock, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, Empty, ProgressBar } from '../../components/ui';

type Curso = { id: string; titulo: string };
type Aula = { id: string; titulo: string; ordem: number };
type Atividade = {
  id: string;
  titulo: string;
  aula_id: string | null;
  prazo: string | null;
  nota_maxima: number;
};
type Envio = { atividade_id: string; enviado_em: string | null; nota: number | null; corrigido_em: string | null };

function deadlineInfo(prazo: string | null): { text: string; cls: string } {
  if (!prazo) return { text: 'Sem prazo', cls: 'text-[#8b929e]' };
  const diff = new Date(prazo).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return { text: 'Prazo encerrado', cls: 'text-red-400' };
  if (days === 0) return { text: 'Vence hoje', cls: 'text-amber-400' };
  if (days <= 3) return { text: `${days} dia(s) restante(s)`, cls: 'text-amber-400' };
  return { text: new Date(prazo).toLocaleDateString('pt-BR'), cls: 'text-[#8b929e]' };
}

function statusBadge(atividade: Atividade, envio: Envio | undefined) {
  if (envio?.corrigido_em) return <Badge tone="success">Corrigida — {envio.nota}/{atividade.nota_maxima}</Badge>;
  if (envio?.enviado_em) return <Badge>Enviada</Badge>;
  if (atividade.prazo && new Date(atividade.prazo) < new Date()) return <Badge tone="danger">Atrasada</Badge>;
  return <Badge tone="warn">Pendente</Badge>;
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

      const { data: as } = await (supabase as any)
        .from('lessons_public')
        .select('id,titulo,ordem')
        .eq('curso_id', id)
        .order('ordem');
      setAulas((as ?? []) as Aula[]);

      const { data: ps } = await supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true);
      setDone(new Set((ps ?? []).map((p) => p.aula_id)));

      const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id).eq('curso_id', id);
      const turmaIds = [...new Set((ut ?? []).map((r: any) => r.turma_id))];

      if (turmaIds.length) {
        const { data: ats } = await supabase
          .from('atividades')
          .select('id,titulo,aula_id,prazo,nota_maxima')
          .eq('curso_id', id)
          .in('turma_id', turmaIds);
        setAtividades((ats ?? []) as Atividade[]);

        const atividadeIds = (ats ?? []).map((a: any) => a.id);
        if (atividadeIds.length && isStudent) {
          const { data: es } = await supabase
            .from('atividade_envios')
            .select('atividade_id,enviado_em,nota,corrigido_em')
            .eq('aluno_id', profile.id)
            .in('atividade_id', atividadeIds);
          const map: Record<string, Envio> = {};
          (es ?? []).forEach((e: any) => { map[e.atividade_id] = e; });
          setEnvios(map);
        }
      }

      setLoading(false);
    })();
  }, [id, profile]);

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-12"><p className="meta">Carregando...</p></div>;
  if (!curso) return null;

  const atividadesPorAula: Record<string, Atividade[]> = {};
  const atividadesGerais: Atividade[] = [];
  atividades.forEach((a) => {
    if (a.aula_id) {
      (atividadesPorAula[a.aula_id] ??= []).push(a);
    } else {
      atividadesGerais.push(a);
    }
  });
  atividadesGerais.sort((a, b) => {
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
  });

  const pct = aulas.length ? Math.round((done.size / aulas.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link to={`/curso/${curso.id}`} className="inline-flex items-center gap-1 text-sm text-[#d6deed] hover:text-[#cbfb00] mb-3 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar ao curso
      </Link>

      <div className="mb-10">
        <h1 className="mb-2">Cronograma — {curso.titulo}</h1>
        <div className="flex items-center gap-4 max-w-md">
          <div className="flex-1"><ProgressBar value={pct} /></div>
          <span className="text-sm text-[#cbfb00] font-medium">{pct}% concluído</span>
        </div>
      </div>

      {aulas.length === 0 ? (
        <Empty icon={<PlayCircle className="w-10 h-10" />} title="Nenhuma aula neste curso" />
      ) : (
        <ol className="relative border-l border-[#1c1f26] ml-3 space-y-8">
          {aulas.map((aula) => {
            const isDone = done.has(aula.id);
            const relacionadas = atividadesPorAula[aula.id] ?? [];
            return (
              <li key={aula.id} className="ml-6">
                <span className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 ${
                  isDone ? 'bg-[#cbfb00] border-[#cbfb00]' : 'bg-black border-[#434d5e]'
                }`} />
                <button
                  onClick={() => nav(`/curso/${curso.id}?aula=${aula.id}`)}
                  className="flex items-center gap-2 text-left group"
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4 text-[#cbfb00] flex-shrink-0" /> : <Circle className="w-4 h-4 text-[#434d5e] flex-shrink-0" />}
                  <span className="meta">Aula {aula.ordem}</span>
                  <span className="text-white font-medium group-hover:text-[#cbfb00] transition-colors">{aula.titulo}</span>
                </button>

                {relacionadas.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {relacionadas.map((a) => {
                      const dl = deadlineInfo(a.prazo);
                      return (
                        <Link
                          key={a.id}
                          to={`/atividade/${a.id}`}
                          className="flex items-center justify-between gap-3 pl-6 py-2 border-l-2 border-[#1c1f26] hover:border-[#cbfb00]/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ClipboardList className="w-3.5 h-3.5 text-[#8b929e] flex-shrink-0" />
                            <span className="text-sm text-[#d6deed] truncate">{a.titulo}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs ${dl.cls}`}><Clock className="w-3 h-3 inline mr-1" />{dl.text}</span>
                            {isStudent && statusBadge(a, envios[a.id])}
                          </div>
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
          <p className="meta uppercase tracking-wider mb-4">Outras atividades do curso</p>
          <div className="space-y-2">
            {atividadesGerais.map((a) => {
              const dl = deadlineInfo(a.prazo);
              return (
                <Link
                  key={a.id}
                  to={`/atividade/${a.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-[#1c1f26] hover:border-[#cbfb00]/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ClipboardList className="w-4 h-4 text-[#8b929e] flex-shrink-0" />
                    <span className="text-sm text-white truncate">{a.titulo}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs ${dl.cls}`}><Clock className="w-3 h-3 inline mr-1" />{dl.text}</span>
                    {isStudent && statusBadge(a, envios[a.id])}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
