import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, PlayCircle, Users, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, Skeleton, StatTile, Tabs } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { getYouTubeId } from '../../lib/youtube';
import CursoAtividadesTab from '../admin/CursoAtividadesTab';
import CursoPresencaTab from '../admin/CursoPresencaTab';

type Turma = { id: string; nome: string };
type Curso = { id: string; titulo: string; descricao: string | null };
type Aula = { id: string; titulo: string; ordem: number; youtube_url: string };
type Tab = 'dashboard' | 'aulas' | 'atividades' | 'presenca';

export default function TurmaCursoDetalhe() {
  const { turmaId, cursoId } = useParams<{ turmaId: string; cursoId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';
  const [tab, setTab] = useState<Tab>('dashboard');
  const [turma, setTurma] = useState<Turma | null>(null);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [horarios, setHorarios] = useState<Record<string, string>>({});
  const [alunosCount, setAlunosCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStaff) return;
    (async () => {
      setLoading(true);
      // publicada ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: t }, { data: c }, { data: as }, { data: hs }, { data: uts }] = await Promise.all([
        supabase.from('turmas').select('id,nome').eq('id', turmaId!).maybeSingle(),
        supabase.from('cursos').select('id,titulo,descricao').eq('id', cursoId!).maybeSingle(),
        sb.from('aulas').select('id,titulo,ordem,youtube_url').eq('curso_id', cursoId!).order('ordem'),
        sb.from('aula_horarios').select('aula_id,data_hora').eq('turma_id', turmaId!).eq('curso_id', cursoId!),
        supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!),
      ]);
      setTurma(t); setCurso(c); setAulas((as ?? []) as Aula[]);
      setHorarios(Object.fromEntries(((hs ?? []) as { aula_id: string; data_hora: string }[]).map((h) => [h.aula_id, h.data_hora])));
      const userIds = (uts ?? []).map((r) => r.user_id);
      if (userIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('id,role').in('id', userIds);
        setAlunosCount((profiles ?? []).filter((p) => p.role === 'student').length);
      } else setAlunosCount(0);
      setLoading(false);
    })();
  }, [turmaId, cursoId, isStaff]);

  if (profile && !isStaff) return <Navigate to="/dashboard" replace />;
  if (loading) return <div><Skeleton className="h-8 w-64 mb-6" /><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div>
      <button onClick={() => nav(`/turmas/${turmaId}`)} className="inline-flex items-center gap-2 text-sm text-fg-3 hover:text-fg mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar para a turma</button>
      <PageHeader title={curso?.titulo ?? '…'} subtitle={turma?.nome} />

      <Tabs className="mb-6" value={tab} onChange={setTab}
        tabs={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'aulas', label: 'Aulas', count: aulas.length }, { value: 'atividades', label: 'Atividades' }, { value: 'presenca', label: 'Presença' }]} />

      {tab === 'dashboard' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Aulas" value={aulas.length} icon={<PlayCircle className="w-4 h-4" />} />
          <StatTile label="Alunos matriculados" value={alunosCount} icon={<Users className="w-4 h-4" />} />
        </div>
      )}

      {tab === 'aulas' && (
        aulas.length === 0 ? <EmptyState icon={<PlayCircle className="w-8 h-8" />} title="Nenhuma aula cadastrada" /> : (
          <Card className="overflow-hidden">
            <ul>
              {aulas.map((a) => {
                const ytId = getYouTubeId(a.youtube_url);
                return (
                  <li key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 transition-colors">
                    <div className="w-20 h-11 rounded-md bg-black overflow-hidden flex-shrink-0 border border-line">
                      {ytId && <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} className="w-full h-full object-cover" alt="" loading="lazy" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-fg text-sm font-medium truncate">{a.ordem}. {a.titulo}</p>
                      <p className="text-fg-3 text-xs truncate">
                        {horarios[a.id] ? new Date(horarios[a.id]).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem data/horário agendado'}
                      </p>
                    </div>
                    {a.youtube_url && (
                      <a href={a.youtube_url} target="_blank" rel="noopener" className="text-fg-3 hover:text-fg p-2 rounded-md transition-colors flex-shrink-0"><ExternalLink className="w-4 h-4" /></a>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )
      )}

      {tab === 'atividades' && <CursoAtividadesTab turmaId={turmaId!} cursoId={cursoId!} />}
      {tab === 'presenca' && <CursoPresencaTab turmaId={turmaId!} cursoId={cursoId!} />}
    </div>
  );
}
