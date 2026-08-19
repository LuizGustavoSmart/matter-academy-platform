import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink, PlayCircle, Users, MoreHorizontal, HelpCircle, ClipboardList, Percent, Clock, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, Skeleton, StatTile, Tabs, Button, IconButton, Switch, Badge, Avatar, DropdownMenu, useToast, useConfirm } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { getYouTubeId } from '../../lib/youtube';
import { SignedImage } from '../../components/SignedImage';
import CursoAtividadesTab from '../admin/CursoAtividadesTab';
import CursoPresencaTab from '../admin/CursoPresencaTab';
import { AulaModal, type Aula } from '../admin/CursoDetalhe';

type Turma = { id: string; nome: string };
type Curso = { id: string; titulo: string; descricao: string | null };
type Tab = 'dashboard' | 'aulas' | 'atividades' | 'duvidas' | 'presenca' | 'alunos';
type Duvida = { id: string; titulo: string; status: 'aberta' | 'resolvida'; created_at: string; alunoNome: string | null; alunoEmail: string };
type AlunoResumo = { id: string; email: string; nome: string | null; aulasAssistidas: number; atividadesEnviadas: number };
type NextAula = { titulo: string; dataHora: string; linkAoVivo: string | null; started: boolean };
type EmbDashboard = {
  aulasTotal: number; aulasFeitas: number; presencaMedia: number;
  atividadesTotal: number; entregasRecebidas: number; entregasEsperadas: number; nextAula: NextAula | null;
};

export default function TurmaCursoDetalhe() {
  const { turmaId, cursoId } = useParams<{ turmaId: string; cursoId: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';
  const isEmbaixador = profile?.role === 'embaixador';
  const canView = isStaff || isEmbaixador;
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

  const [duvidas, setDuvidas] = useState<Duvida[]>([]);
  const [duvidasLoading, setDuvidasLoading] = useState(false);

  const [alunosResumo, setAlunosResumo] = useState<AlunoResumo[]>([]);
  const [alunosLoading, setAlunosLoading] = useState(false);

  const [embDash, setEmbDash] = useState<EmbDashboard | null>(null);
  const [embDashLoading, setEmbDashLoading] = useState(false);

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

  const loadDuvidas = async () => {
    setDuvidasLoading(true);
    const { data } = await supabase.from('duvidas').select('id,titulo,status,created_at,aluno_id').eq('turma_id', turmaId!).eq('curso_id', cursoId!).order('created_at', { ascending: false });
    const alunoIds = [...new Set((data ?? []).map((d) => d.aluno_id))];
    const { data: profiles } = alunoIds.length ? await supabase.from('profiles').select('id,nome,email').in('id', alunoIds) : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setDuvidas((data ?? []).map((d) => ({
      id: d.id, titulo: d.titulo, status: d.status as Duvida['status'], created_at: d.created_at,
      alunoNome: profileMap.get(d.aluno_id)?.nome ?? null, alunoEmail: profileMap.get(d.aluno_id)?.email ?? '',
    })));
    setDuvidasLoading(false);
  };

  const loadAlunos = async () => {
    setAlunosLoading(true);
    const { data: uts } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!).eq('curso_id', cursoId!);
    const userIds = (uts ?? []).map((r) => r.user_id);
    if (!userIds.length) { setAlunosResumo([]); setAlunosLoading(false); return; }
    const [{ data: profiles }, { data: aulasData }] = await Promise.all([
      supabase.from('profiles').select('id,email,nome,role').in('id', userIds),
      supabase.from('aulas').select('id').eq('curso_id', cursoId!),
    ]);
    const students = (profiles ?? []).filter((p) => p.role === 'student');
    const aulaIds = (aulasData ?? []).map((a) => a.id);
    const studentIds = students.map((s) => s.id);
    const [{ data: prog }, { data: ats }] = await Promise.all([
      aulaIds.length ? supabase.from('progresso').select('user_id,aula_id,concluido').in('user_id', studentIds).in('aula_id', aulaIds).eq('concluido', true) : Promise.resolve({ data: [] }),
      supabase.from('atividades').select('id').eq('turma_id', turmaId!).eq('curso_id', cursoId!),
    ]);
    const atividadeIds = (ats ?? []).map((a) => a.id);
    const { data: envios } = atividadeIds.length
      ? await supabase.from('atividade_envios').select('aluno_id,atividade_id,enviado_em').in('atividade_id', atividadeIds).in('aluno_id', studentIds)
      : { data: [] };
    const aulasPorAluno: Record<string, number> = {};
    (prog ?? []).forEach((p) => { aulasPorAluno[p.user_id] = (aulasPorAluno[p.user_id] ?? 0) + 1; });
    const enviosPorAluno: Record<string, number> = {};
    (envios ?? []).forEach((e) => { if (e.enviado_em) enviosPorAluno[e.aluno_id] = (enviosPorAluno[e.aluno_id] ?? 0) + 1; });
    setAlunosResumo(students.map((s) => ({
      id: s.id, email: s.email, nome: s.nome, aulasAssistidas: aulasPorAluno[s.id] ?? 0, atividadesEnviadas: enviosPorAluno[s.id] ?? 0,
    })));
    setAlunosLoading(false);
  };

  const loadEmbDashboard = async () => {
    setEmbDashLoading(true);
    // publicada/link_ao_vivo/aula_horarios ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: aulasList }, { data: hs }, { data: cursoRow }] = await Promise.all([
      sb.from('aulas').select('id,titulo').eq('curso_id', cursoId!),
      sb.from('aula_horarios').select('aula_id,data_hora').eq('turma_id', turmaId!).eq('curso_id', cursoId!),
      sb.from('cursos').select('link_ao_vivo').eq('id', cursoId!).maybeSingle(),
    ]);
    const aulasRows = (aulasList ?? []) as { id: string; titulo: string }[];
    const aulaIds = aulasRows.map((a) => a.id);
    const tituloMap = new Map(aulasRows.map((a) => [a.id, a.titulo]));
    const horariosMap = new Map(((hs ?? []) as { aula_id: string; data_hora: string }[]).map((h) => [h.aula_id, h.data_hora]));
    const now = Date.now();
    const aulasTotal = aulaIds.length;
    const aulasFeitas = aulaIds.filter((id) => {
      const dh = horariosMap.get(id);
      return dh && new Date(dh).getTime() <= now;
    }).length;

    const [{ data: presencas }, { data: atividades }] = await Promise.all([
      aulaIds.length ? supabase.from('presencas').select('aula_id,presente').eq('turma_id', turmaId!).in('aula_id', aulaIds) : Promise.resolve({ data: [] }),
      supabase.from('atividades').select('id').eq('turma_id', turmaId!).eq('curso_id', cursoId!),
    ]);
    const presentesCount = (presencas ?? []).filter((p) => p.presente).length;
    const presencaMedia = aulasFeitas > 0 && alunosCount > 0 ? Math.round((presentesCount / (aulasFeitas * alunosCount)) * 100) : 0;

    const atividadeIds = (atividades ?? []).map((a) => a.id);
    const { data: envios } = atividadeIds.length
      ? await supabase.from('atividade_envios').select('atividade_id,enviado_em').in('atividade_id', atividadeIds)
      : { data: [] };
    const entregasRecebidas = (envios ?? []).filter((e) => e.enviado_em).length;
    const entregasEsperadas = atividadeIds.length * alunosCount;

    type Chosen = { id: string; dh: string };
    let started: Chosen | null = null;
    let next: Chosen | null = null;
    for (const [id, dh] of horariosMap) {
      const t = new Date(dh).getTime();
      if (t <= now && now - t < 60 * 60 * 1000) {
        if (!started || t > new Date((started as Chosen).dh).getTime()) started = { id, dh };
      } else if (t > now) {
        if (!next || t < new Date((next as Chosen).dh).getTime()) next = { id, dh };
      }
    }
    const chosen = started ?? next;
    const nextAula: NextAula | null = chosen ? {
      titulo: tituloMap.get(chosen.id) ?? 'Aula',
      dataHora: chosen.dh,
      linkAoVivo: cursoRow?.link_ao_vivo ?? null,
      started: !!started,
    } : null;

    setEmbDash({ aulasTotal, aulasFeitas, presencaMedia, atividadesTotal: atividadeIds.length, entregasRecebidas, entregasEsperadas, nextAula });
    setEmbDashLoading(false);
  };

  useEffect(() => { if (canView) loadBase(); }, [turmaId, cursoId, canView]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isEmbaixador && tab === 'dashboard') loadEmbDashboard(); }, [tab, turmaId, cursoId, isEmbaixador, alunosCount]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (canView && tab === 'aulas') loadAulas(); }, [tab, cursoId, canView]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (canView && tab === 'duvidas') loadDuvidas(); }, [tab, turmaId, cursoId, canView]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (canView && tab === 'alunos') loadAlunos(); }, [tab, turmaId, cursoId, canView]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (profile && !canView) return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8"><Skeleton className="h-8 w-64 mb-6" /><Skeleton className="h-64 rounded-xl" /></div>;

  const tabs = [
    { value: 'dashboard' as const, label: 'Dashboard' },
    { value: 'aulas' as const, label: 'Aulas', count: aulas.length },
    { value: 'atividades' as const, label: 'Atividades' },
    ...(isEmbaixador ? [{ value: 'duvidas' as const, label: 'Dúvidas' }] : []),
    { value: 'presenca' as const, label: 'Presença' },
    ...(isEmbaixador ? [{ value: 'alunos' as const, label: 'Alunos' }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => nav('/turmas')} className="inline-flex items-center gap-2 text-sm text-fg-3 hover:text-fg mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar para Cursos</button>
      <PageHeader title={curso?.titulo ?? '…'} subtitle={turma?.nome} />

      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'dashboard' && (
        isEmbaixador ? (
          embDashLoading || !embDash ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Aulas realizadas" value={`${embDash.aulasFeitas}/${embDash.aulasTotal || '—'}`} icon={<PlayCircle className="w-4 h-4" />} />
                  <StatTile label="Aulas restantes" value={Math.max(embDash.aulasTotal - embDash.aulasFeitas, 0)} icon={<Clock className="w-4 h-4" />} />
                  <StatTile label="Alunos matriculados" value={alunosCount} icon={<Users className="w-4 h-4" />} />
                  <StatTile label="Presença média" value={`${embDash.presencaMedia}%`} icon={<Percent className="w-4 h-4" />} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatTile label="Atividades" value={embDash.atividadesTotal} icon={<ClipboardList className="w-4 h-4" />} />
                  <StatTile label="Entregas recebidas" value={`${embDash.entregasRecebidas}/${embDash.entregasEsperadas || '—'}`} icon={<ClipboardList className="w-4 h-4" />} />
                </div>
              </div>
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4"><Video className="w-4 h-4 text-fg-2" /><h2 className="text-base">Próxima aula</h2></div>
                {!embDash.nextAula ? (
                  <p className="text-fg-3 text-sm py-2">Nenhuma aula agendada por enquanto.</p>
                ) : embDash.nextAula.started ? (
                  <div className="flex flex-col items-center text-center py-2">
                    <p className="text-danger text-lg font-display font-semibold">A aula já começou!</p>
                    {embDash.nextAula.linkAoVivo && (
                      <a href={embDash.nextAula.linkAoVivo} target="_blank" rel="noopener" className="mt-4 inline-flex items-center justify-center gap-2 w-full h-9 rounded-md text-sm font-semibold bg-brand text-brand-ink hover:bg-brand-hover transition-colors">Acesse aqui</a>
                    )}
                    <p className="text-fg-3 text-xs mt-4 truncate max-w-full">{embDash.nextAula.titulo}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center py-2">
                    <p className="text-fg-3 text-xs">Próxima aula acontece em:</p>
                    <NextAulaCountdown dataHora={embDash.nextAula.dataHora} />
                    <p className="text-fg-3 text-xs mt-3 truncate max-w-full">{embDash.nextAula.titulo}</p>
                  </div>
                )}
              </Card>
            </div>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile label="Aulas" value={aulas.length || '—'} icon={<PlayCircle className="w-4 h-4" />} />
            <StatTile label="Alunos matriculados" value={alunosCount} icon={<Users className="w-4 h-4" />} />
          </div>
        )
      )}

      {tab === 'aulas' && (
        <div>
          <div className="flex items-center justify-between mb-4 gap-3">
            <p className="text-fg-3 text-sm">Aulas deste curso.</p>
            {!isEmbaixador && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateAulaOpen(true)}>Nova aula</Button>}
          </div>
          {aulasLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
            aulas.length === 0 ? <EmptyState icon={<PlayCircle className="w-8 h-8" />} title="Nenhuma aula" description={isEmbaixador ? 'Nenhuma aula cadastrada ainda.' : 'Adicione a primeira aula deste curso.'} action={!isEmbaixador ? <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateAulaOpen(true)}>Nova aula</Button> : undefined} /> : (
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
                        {isEmbaixador ? (
                          <Badge tone={a.publicada ? 'success' : 'default'} className="flex-shrink-0">{a.publicada ? 'Visível' : 'Não disponível'}</Badge>
                        ) : (
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
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
        </div>
      )}

      {tab === 'atividades' && <CursoAtividadesTab turmaId={turmaId!} cursoId={cursoId!} readOnly={isEmbaixador} />}
      {tab === 'presenca' && <CursoPresencaTab turmaId={turmaId!} cursoId={cursoId!} readOnly={isEmbaixador} />}

      {tab === 'duvidas' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <StatTile label="Dúvidas abertas" value={duvidas.filter((d) => d.status === 'aberta').length} icon={<HelpCircle className="w-4 h-4" />} />
          </div>
          {duvidasLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
            duvidas.length === 0 ? <EmptyState icon={<HelpCircle className="w-8 h-8" />} title="Nenhuma dúvida enviada nesta turma/curso" /> : (
              <Card className="overflow-hidden">
                <ul>
                  {duvidas.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-fg text-sm font-medium truncate">{d.titulo}</p>
                        <p className="text-fg-3 text-xs mt-0.5 truncate">{d.alunoNome || d.alunoEmail} · {new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <Badge tone={d.status === 'resolvida' ? 'success' : 'warn'} dot className="flex-shrink-0">{d.status === 'resolvida' ? 'Resolvida' : 'Aberta'}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
        </div>
      )}

      {tab === 'alunos' && (
        <div>
          {alunosLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
            alunosResumo.length === 0 ? <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhum aluno nesta turma/curso" /> : (
              <Card className="overflow-hidden">
                <ul>
                  {alunosResumo.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
                      <Avatar name={a.nome} email={a.email} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="text-fg text-sm font-medium truncate">{a.nome || a.email.split('@')[0]}</p>
                        <p className="text-fg-3 text-xs truncate">{a.email}</p>
                      </div>
                      <span className="flex items-center gap-1.5 text-sm text-fg-2 flex-shrink-0"><PlayCircle className="w-4 h-4 text-fg-3" />{a.aulasAssistidas} aulas</span>
                      <span className="flex items-center gap-1.5 text-sm text-fg-2 flex-shrink-0"><ClipboardList className="w-4 h-4 text-fg-3" />{a.atividadesEnviadas} atividades</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
        </div>
      )}

      {!isEmbaixador && (
        <>
          <AulaModal open={createAulaOpen} aula={null} cursoId={cursoId!} turmaId={turmaId!} dataHoraAtual={null} nextOrdem={maxOrdem + 1} onClose={() => setCreateAulaOpen(false)} onDone={() => { setCreateAulaOpen(false); loadAulas(); }} />
          <AulaModal open={!!editAula} aula={editAula} cursoId={cursoId!} turmaId={turmaId!} dataHoraAtual={editAula ? horarios[editAula.id] ?? null : null} nextOrdem={maxOrdem + 1} onClose={() => setEditAula(null)} onDone={() => { setEditAula(null); loadAulas(); }} />
        </>
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
