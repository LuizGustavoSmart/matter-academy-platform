import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink, PlayCircle, Users, MoreHorizontal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, Skeleton, StatTile, Tabs, Button, IconButton, Switch, DropdownMenu, useToast, useConfirm } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { getYouTubeId } from '../../lib/youtube';
import { SignedImage } from '../../components/SignedImage';
import CursoAtividadesTab from '../admin/CursoAtividadesTab';
import CursoPresencaTab from '../admin/CursoPresencaTab';
import { AulaModal, type Aula } from '../admin/CursoDetalhe';

type Turma = { id: string; nome: string };
type Curso = { id: string; titulo: string; descricao: string | null };
type Tab = 'dashboard' | 'aulas' | 'atividades' | 'presenca';

export default function TurmaCursoDetalhe() {
  const { turmaId, cursoId } = useParams<{ turmaId: string; cursoId: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';
  const [tab, setTab] = useState<Tab>('dashboard');
  const [turma, setTurma] = useState<Turma | null>(null);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [alunosCount, setAlunosCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [aulas, setAulas] = useState<Aula[]>([]);
  const [horarios, setHorarios] = useState<Record<string, string>>({});
  const [aulasLoading, setAulasLoading] = useState(false);
  const [createAulaOpen, setCreateAulaOpen] = useState(false);
  const [editAula, setEditAula] = useState<Aula | null>(null);

  const loadBase = async () => {
    setLoading(true);
    const [{ data: t }, { data: c }, { data: uts }] = await Promise.all([
      supabase.from('turmas').select('id,nome').eq('id', turmaId!).maybeSingle(),
      supabase.from('cursos').select('id,titulo,descricao').eq('id', cursoId!).maybeSingle(),
      supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!),
    ]);
    setTurma(t); setCurso(c);
    const userIds = (uts ?? []).map((r) => r.user_id);
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,role').in('id', userIds);
      setAlunosCount((profiles ?? []).filter((p) => p.role === 'student').length);
    } else setAlunosCount(0);
    setLoading(false);
  };

  const loadAulas = async () => {
    setAulasLoading(true);
    // publicada ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data }, { data: hs }] = await Promise.all([
      sb.from('aulas').select('*').eq('curso_id', cursoId!).order('ordem'),
      sb.from('aula_horarios').select('aula_id,data_hora').eq('turma_id', turmaId!).eq('curso_id', cursoId!),
    ]);
    setAulas(data ?? []);
    setHorarios(Object.fromEntries(((hs ?? []) as { aula_id: string; data_hora: string }[]).map((h) => [h.aula_id, h.data_hora])));
    setAulasLoading(false);
  };

  useEffect(() => { if (isStaff) loadBase(); }, [turmaId, cursoId, isStaff]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isStaff && tab === 'aulas') loadAulas(); }, [tab, cursoId, isStaff]); // eslint-disable-line react-hooks/exhaustive-deps

  const delAula = async (a: Aula) => {
    const ok = await confirm({ title: 'Excluir aula', tone: 'danger', confirmLabel: 'Excluir', message: <>Excluir <strong className="text-fg">{a.titulo}</strong>?</> });
    if (!ok) return;
    const { error } = await supabase.from('aulas').delete().eq('id', a.id);
    if (error) toast.error(error.message); else { toast.success('Aula excluída.'); loadAulas(); }
  };

  const togglePublicada = async (a: Aula) => {
    setAulas((prev) => prev.map((x) => (x.id === a.id ? { ...x, publicada: !a.publicada } : x)));
    // publicada ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('aulas').update({ publicada: !a.publicada }).eq('id', a.id);
    if (error) { toast.error(error.message); loadAulas(); }
    else toast.success(a.publicada ? 'Aula ocultada dos alunos.' : 'Aula liberada para os alunos.');
  };

  const moveAula = async (a: Aula, dir: -1 | 1) => {
    const idx = aulas.findIndex((x) => x.id === a.id);
    const other = aulas[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from('aulas').update({ ordem: other.ordem }).eq('id', a.id),
      supabase.from('aulas').update({ ordem: a.ordem }).eq('id', other.id),
    ]);
    loadAulas();
  };

  const maxOrdem = useMemo(() => aulas.reduce((m, a) => Math.max(m, a.ordem), 0), [aulas]);

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
          <StatTile label="Aulas" value={aulas.length || '—'} icon={<PlayCircle className="w-4 h-4" />} />
          <StatTile label="Alunos matriculados" value={alunosCount} icon={<Users className="w-4 h-4" />} />
        </div>
      )}

      {tab === 'aulas' && (
        <div>
          <div className="flex items-center justify-between mb-4 gap-3">
            <p className="text-fg-3 text-sm">Aulas deste curso.</p>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateAulaOpen(true)}>Nova aula</Button>
          </div>
          {aulasLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
            aulas.length === 0 ? <EmptyState icon={<PlayCircle className="w-8 h-8" />} title="Nenhuma aula" description="Adicione a primeira aula deste curso." action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateAulaOpen(true)}>Nova aula</Button>} /> : (
              <Card className="overflow-hidden">
                <ul>
                  {aulas.map((a, i) => {
                    const ytId = getYouTubeId(a.youtube_url);
                    return (
                      <li key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 transition-colors">
                        <div className="w-20 h-11 rounded-md bg-black overflow-hidden flex-shrink-0 border border-line">
                          {a.capa_url ? (
                            <SignedImage bucket="aulas" path={a.capa_url} className="w-full h-full object-cover" alt="" />
                          ) : ytId ? (
                            <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} className="w-full h-full object-cover" alt="" loading="lazy" />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-fg text-sm font-medium truncate">{a.ordem}. {a.titulo}</p>
                          <p className="text-fg-3 text-xs truncate">
                            {horarios[a.id] ? new Date(horarios[a.id]).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem data/horário agendado'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch checked={a.publicada} onChange={() => togglePublicada(a)} label={<span className="text-xs whitespace-nowrap">{a.publicada ? 'Visível' : 'Oculta'}</span>} />
                          <IconButton label="Mover para cima" onClick={() => moveAula(a, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></IconButton>
                          <IconButton label="Mover para baixo" onClick={() => moveAula(a, 1)} disabled={i === aulas.length - 1}><ArrowDown className="w-4 h-4" /></IconButton>
                          <DropdownMenu
                            items={[
                              ...(a.youtube_url ? [{ label: 'Abrir no YouTube', icon: <ExternalLink className="w-4 h-4" />, onClick: () => window.open(a.youtube_url, '_blank', 'noopener') }] : []),
                              { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => setEditAula(a) },
                              { type: 'separator' as const },
                              { label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, tone: 'danger' as const, onClick: () => delAula(a) },
                            ]}
                            trigger={({ toggle, ref, open }) => <IconButton ref={ref} label="Ações da aula" onClick={toggle} className={open ? 'bg-panel-3 text-fg' : ''}><MoreHorizontal className="w-4 h-4" /></IconButton>}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
        </div>
      )}

      {tab === 'atividades' && <CursoAtividadesTab turmaId={turmaId!} cursoId={cursoId!} />}
      {tab === 'presenca' && <CursoPresencaTab turmaId={turmaId!} cursoId={cursoId!} />}

      <AulaModal open={createAulaOpen} aula={null} cursoId={cursoId!} turmaId={turmaId!} dataHoraAtual={null} nextOrdem={maxOrdem + 1} onClose={() => setCreateAulaOpen(false)} onDone={() => { setCreateAulaOpen(false); loadAulas(); }} />
      <AulaModal open={!!editAula} aula={editAula} cursoId={cursoId!} turmaId={turmaId!} dataHoraAtual={editAula ? horarios[editAula.id] ?? null : null} nextOrdem={maxOrdem + 1} onClose={() => setEditAula(null)} onDone={() => { setEditAula(null); loadAulas(); }} />
    </div>
  );
}
