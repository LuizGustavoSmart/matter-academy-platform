import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink, PlayCircle, Users, MoreHorizontal, HelpCircle, ClipboardList, Percent, Clock, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, Skeleton, StatTile, Tabs, Button, IconButton, Switch, Badge, Avatar, DropdownMenu, Modal, Select, SearchInput, useToast, useConfirm } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { getYouTubeId } from '../../lib/youtube';
import { SignedImage } from '../../components/SignedImage';
import CursoAtividadesTab from '../admin/CursoAtividadesTab';
import CursoPresencaTab from '../admin/CursoPresencaTab';
import CursoAprovacoesTab from '../admin/CursoAprovacoesTab';
import { AulaModal, type Aula } from '../admin/CursoDetalhe';

type Turma = { id: string; nome: string };
type Curso = { id: string; titulo: string; descricao: string | null };
type Tab = 'dashboard' | 'aulas' | 'atividades' | 'duvidas' | 'presenca' | 'aprovacoes' | 'alunos';
type Duvida = { id: string; titulo: string; status: 'aberta' | 'resolvida'; created_at: string; alunoNome: string | null; alunoEmail: string };
type AlunoResumo = { id: string; email: string; nome: string | null; aulasAssistidas: number; atividadesEnviadas: number };
type NextAula = { titulo: string; dataHora: string; linkAoVivo: string | null; started: boolean };
type EmbDashboard = {
  aulasTotal: number; aulasFeitas: number; presencaMedia: number;
  atividadesTotal: number; atividadesDisponiveis: number; nextAula: NextAula | null;
};
const AULAS_POR_FAIXA = 12;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Ordena por "ordem", mas força qualquer item titulado "Projeto Final" para o fim da lista. */
function sortProjetoFinalLast<T extends { titulo: string }>(rows: T[]): T[] {
  const isFinal = (r: T) => r.titulo.trim().toLowerCase() === 'projeto final';
  return [...rows.filter((r) => !isFinal(r)), ...rows.filter(isFinal)];
}

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
  const [professorNome, setProfessorNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [alunoDetalhe, setAlunoDetalhe] = useState<AlunoResumo | null>(null);

  const [aulas, setAulas] = useState<Aula[]>([]);
  const [horarios, setHorarios] = useState<Record<string, string>>({});
  const [aulasLoading, setAulasLoading] = useState(false);
  const [createAulaOpen, setCreateAulaOpen] = useState(false);
  const [editAula, setEditAula] = useState<Aula | null>(null);

  const [duvidas, setDuvidas] = useState<Duvida[]>([]);
  const [duvidasLoading, setDuvidasLoading] = useState(false);

  const [alunosResumo, setAlunosResumo] = useState<AlunoResumo[]>([]);
  const [alunosLoading, setAlunosLoading] = useState(false);
  const [alunosTotais, setAlunosTotais] = useState({ aulas: 0, atividades: 0 });
  const [alunosBusca, setAlunosBusca] = useState('');
  const [alunosOrdem, setAlunosOrdem] = useState<'nome_az' | 'nome_za' | 'aulas_desc' | 'aulas_asc' | 'atividades_desc' | 'atividades_asc'>('nome_az');

  const [embDash, setEmbDash] = useState<EmbDashboard | null>(null);
  const [embDashLoading, setEmbDashLoading] = useState(false);

  const loadBase = async () => {
    setLoading(true);
    // professor_id ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: t }, { data: c }, { data: uts }, { data: ct }] = await Promise.all([
      supabase.from('turmas').select('id,nome').eq('id', turmaId!).maybeSingle(),
      supabase.from('cursos').select('id,titulo,descricao').eq('id', cursoId!).maybeSingle(),
      supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!),
      sb.from('curso_turmas').select('professor_id').eq('turma_id', turmaId!).eq('curso_id', cursoId!).maybeSingle(),
    ]);
    setTurma(t); setCurso(c);
    const userIds = (uts ?? []).map((r) => r.user_id);
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,role').in('id', userIds);
      setAlunosCount((profiles ?? []).filter((p) => p.role === 'student').length);
    } else setAlunosCount(0);
    if (ct?.professor_id) {
      const { data: prof } = await supabase.from('profiles').select('nome,sobrenome,email').eq('id', ct.professor_id).maybeSingle();
      setProfessorNome(prof ? ([prof.nome, prof.sobrenome].filter(Boolean).join(' ') || prof.email) : null);
    } else setProfessorNome(null);
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
    if (!userIds.length) { setAlunosResumo([]); setAlunosTotais({ aulas: 0, atividades: 0 }); setAlunosLoading(false); return; }
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
    setAlunosTotais({ aulas: aulaIds.length, atividades: atividadeIds.length });
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
      sb.from('atividades').select('id,publicada').eq('turma_id', turmaId!).eq('curso_id', cursoId!),
    ]);
    const presentesCount = (presencas ?? []).filter((p) => p.presente).length;
    const presencaMedia = aulasFeitas > 0 && alunosCount > 0 ? Math.round((presentesCount / (aulasFeitas * alunosCount)) * 100) : 0;

    const atividadesRows = (atividades ?? []) as { id: string; publicada: boolean }[];
    const atividadeIds = atividadesRows.map((a) => a.id);
    const atividadesDisponiveis = atividadesRows.filter((a) => a.publicada).length;

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

    setEmbDash({ aulasTotal, aulasFeitas, presencaMedia, atividadesTotal: atividadeIds.length, atividadesDisponiveis, nextAula });
    setEmbDashLoading(false);
  };

  useEffect(() => { if (canView) loadBase(); }, [turmaId, cursoId, canView]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isEmbaixador && tab === 'dashboard') loadEmbDashboard(); }, [tab, turmaId, cursoId, isEmbaixador, alunosCount]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (canView) loadAulas(); }, [turmaId, cursoId, canView]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const alunosFiltrados = useMemo(() => {
    const termo = alunosBusca.trim().toLowerCase();
    const nomeDe = (a: AlunoResumo) => a.nome || a.email.split('@')[0];
    return alunosResumo
      .filter((a) => !termo || nomeDe(a).toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo))
      .sort((a, b) => {
        if (alunosOrdem === 'nome_az') return nomeDe(a).localeCompare(nomeDe(b));
        if (alunosOrdem === 'nome_za') return nomeDe(b).localeCompare(nomeDe(a));
        if (alunosOrdem === 'aulas_desc') return b.aulasAssistidas - a.aulasAssistidas;
        if (alunosOrdem === 'aulas_asc') return a.aulasAssistidas - b.aulasAssistidas;
        if (alunosOrdem === 'atividades_desc') return b.atividadesEnviadas - a.atividadesEnviadas;
        return a.atividadesEnviadas - b.atividadesEnviadas;
      });
  }, [alunosResumo, alunosBusca, alunosOrdem]);

  if (profile && !canView) return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8"><Skeleton className="h-8 w-64 mb-6" /><Skeleton className="h-64 rounded-xl" /></div>;

  const aulasDisponiveis = aulas.filter((a) => a.publicada).length;

  const tabs = [
    { value: 'dashboard' as const, label: 'Dashboard' },
    { value: 'aulas' as const, label: 'Aulas', count: aulasDisponiveis },
    { value: 'atividades' as const, label: 'Atividades' },
    ...(isEmbaixador ? [{ value: 'duvidas' as const, label: 'Dúvidas' }] : []),
    { value: 'presenca' as const, label: 'Presença' },
    { value: 'aprovacoes' as const, label: 'Aprovações' },
    ...(isEmbaixador ? [{ value: 'alunos' as const, label: 'Alunos' }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => nav('/turmas')} className="inline-flex items-center gap-2 text-sm text-fg-3 hover:text-fg mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar para Cursos</button>
      <PageHeader title={curso?.titulo ?? '…'} subtitle={turma?.nome} className={professorNome ? 'mb-1' : undefined} />
      {professorNome && <p className="text-fg-3 text-sm mb-6">Professor: <span className="text-fg-2">{professorNome}</span></p>}

      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'dashboard' && (
        isEmbaixador ? (
          embDashLoading || !embDash ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-24 rounded-lg" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
              </div>
              <Skeleton className="h-48 rounded-lg" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <Card className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2"><PlayCircle className="w-4 h-4 text-fg-2" /><span className="text-fg-3 text-xs font-semibold uppercase tracking-wider">Aulas realizadas</span></div>
                    <p className="text-2xl font-display font-semibold text-fg tabular-nums">{embDash.aulasFeitas}<span className="text-fg-3 text-base font-normal">/{embDash.aulasTotal || '—'}</span></p>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.max(embDash.aulasTotal, AULAS_POR_FAIXA) }).map((_, i) => (
                      <div key={i} className={i < embDash.aulasFeitas ? 'h-2.5 flex-1 rounded-full bg-brand transition-colors' : 'h-2.5 flex-1 rounded-full bg-line/60 transition-colors'} />
                    ))}
                  </div>
                </Card>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Aulas restantes" value={Math.max(embDash.aulasTotal - embDash.aulasFeitas, 0)} icon={<Clock className="w-4 h-4" />} />
                  <StatTile label="Alunos matriculados" value={alunosCount} icon={<Users className="w-4 h-4" />} />
                  <StatTile label="Presença média" value={`${embDash.presencaMedia}%`} icon={<Percent className="w-4 h-4" />} />
                  <StatTile label="Atividades" value={`${embDash.atividadesDisponiveis}/${embDash.atividadesTotal || '—'}`} icon={<ClipboardList className="w-4 h-4" />} />
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
            <p className="text-fg-3 text-sm">Cronograma de aulas</p>
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

      {tab === 'atividades' && (
        isEmbaixador
          ? <AtividadesEngajamento turmaId={turmaId!} cursoId={cursoId!} alunosCount={alunosCount} />
          : <CursoAtividadesTab turmaId={turmaId!} cursoId={cursoId!} />
      )}
      {tab === 'presenca' && (
        isEmbaixador
          ? <PresencaBarList turmaId={turmaId!} cursoId={cursoId!} turmaNome={turma?.nome ?? ''} alunosCount={alunosCount} />
          : <CursoPresencaTab turmaId={turmaId!} cursoId={cursoId!} />
      )}
      {tab === 'aprovacoes' && <CursoAprovacoesTab turmaId={turmaId!} cursoId={cursoId!} readOnly={isEmbaixador} />}

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
              <>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <SearchInput value={alunosBusca} onChange={setAlunosBusca} placeholder="Buscar aluno..." className="flex-1" />
                  <Select value={alunosOrdem} onChange={(e) => setAlunosOrdem(e.target.value as typeof alunosOrdem)} className="sm:w-64">
                    <option value="nome_az">Nome A-Z</option>
                    <option value="nome_za">Nome Z-A</option>
                    <option value="aulas_desc">Mais aulas assistidas</option>
                    <option value="aulas_asc">Menos aulas assistidas</option>
                    <option value="atividades_desc">Mais atividades enviadas</option>
                    <option value="atividades_asc">Menos atividades enviadas</option>
                  </Select>
                </div>
                {alunosFiltrados.length === 0 ? <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhum aluno encontrado" /> : (
              <Card className="overflow-hidden">
                <ul>
                  {alunosFiltrados.map((a) => {
                    const pctAulas = alunosTotais.aulas ? Math.round((a.aulasAssistidas / alunosTotais.aulas) * 100) : 0;
                    const pctAtividades = alunosTotais.atividades ? Math.round((a.atividadesEnviadas / alunosTotais.atividades) * 100) : 0;
                    return (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 cursor-pointer transition-colors" onClick={() => setAlunoDetalhe(a)}>
                        <Avatar name={a.nome} email={a.email} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-fg text-sm font-medium truncate">{a.nome || a.email.split('@')[0]}</p>
                          <p className="text-fg-3 text-xs truncate">{a.email}</p>
                        </div>
                        <span className="flex items-center gap-1.5 text-sm text-fg-2 flex-shrink-0"><PlayCircle className="w-4 h-4 text-fg-3" />Aulas - {pad2(a.aulasAssistidas)}/{pad2(alunosTotais.aulas)} ({pctAulas}%)</span>
                        <span className="flex items-center gap-1.5 text-sm text-fg-2 flex-shrink-0"><ClipboardList className="w-4 h-4 text-fg-3" />Atividades - {pad2(a.atividadesEnviadas)}/{pad2(alunosTotais.atividades)} ({pctAtividades}%)</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
                )}
              </>
            )}
        </div>
      )}

      {!isEmbaixador && (
        <>
          <AulaModal open={createAulaOpen} aula={null} cursoId={cursoId!} turmaId={turmaId!} dataHoraAtual={null} nextOrdem={maxOrdem + 1} onClose={() => setCreateAulaOpen(false)} onDone={() => { setCreateAulaOpen(false); loadAulas(); }} />
          <AulaModal open={!!editAula} aula={editAula} cursoId={cursoId!} turmaId={turmaId!} dataHoraAtual={editAula ? horarios[editAula.id] ?? null : null} nextOrdem={maxOrdem + 1} onClose={() => setEditAula(null)} onDone={() => { setEditAula(null); loadAulas(); }} />
        </>
      )}

      {alunoDetalhe && <AlunoDetalheModal turmaId={turmaId!} cursoId={cursoId!} aluno={alunoDetalhe} onClose={() => setAlunoDetalhe(null)} />}
    </div>
  );
}

/* ═══════════════════ Presença por Aula (embaixador) ═══════════════════ */
function PresencaBarList({ turmaId, cursoId, turmaNome, alunosCount }: {
  turmaId: string; cursoId: string; turmaNome: string; alunosCount: number;
}) {
  type Row = { id: string; ordem: number; titulo: string; dataHora: string | null; presentes: number; publicada: boolean };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [aulaSelecionada, setAulaSelecionada] = useState<Row | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // aulas/aula_horarios ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: aulasList }, { data: hs }, { data: presencas }] = await Promise.all([
        sb.from('aulas').select('id,ordem,titulo,publicada').eq('curso_id', cursoId).order('ordem'),
        sb.from('aula_horarios').select('aula_id,data_hora').eq('turma_id', turmaId).eq('curso_id', cursoId),
        supabase.from('presencas').select('aula_id,presente').eq('turma_id', turmaId),
      ]);
      const horariosMap = new Map(((hs ?? []) as { aula_id: string; data_hora: string }[]).map((h) => [h.aula_id, h.data_hora]));
      const presentesPorAula: Record<string, number> = {};
      ((presencas ?? []) as { aula_id: string; presente: boolean }[]).forEach((p) => {
        if (p.presente) presentesPorAula[p.aula_id] = (presentesPorAula[p.aula_id] ?? 0) + 1;
      });
      setRows(((aulasList ?? []) as { id: string; ordem: number; titulo: string; publicada: boolean }[]).map((a) => ({
        id: a.id, ordem: a.ordem, titulo: a.titulo, dataHora: horariosMap.get(a.id) ?? null, presentes: presentesPorAula[a.id] ?? 0, publicada: a.publicada,
      })));
      setLoading(false);
    })();
  }, [turmaId, cursoId]);

  if (loading) return <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-md" />)}</div>;

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base mb-0.5">Presença por Aula — {turmaNome}</h2>
      <p className="text-fg-3 text-xs mb-5">% de inscritos presentes</p>
      {rows.length === 0 ? <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhuma aula cadastrada" /> : (
        <div className="space-y-4">
          {rows.map((r) => {
            if (!r.publicada) {
              return (
                <div key={r.id} className="px-2 py-1">
                  <div className="flex items-center justify-between text-sm gap-3">
                    <span className="text-fg-2 truncate">Aula {r.ordem}{r.dataHora ? ` – ${new Date(r.dataHora).toLocaleDateString('pt-BR')}` : ''}</span>
                    <span className="text-fg-3 italic flex-shrink-0">Aula ainda não disponível</span>
                  </div>
                </div>
              );
            }
            const pct = alunosCount ? Math.round((r.presentes / alunosCount) * 100) : 0;
            return (
              <button key={r.id} onClick={() => setAulaSelecionada(r)} className="block w-full text-left rounded-md -mx-2 px-2 py-1 hover:bg-panel-2/40 transition-colors">
                <div className="flex items-center justify-between text-sm mb-1.5 gap-3">
                  <span className="text-fg-2 truncate">Aula {r.ordem}{r.dataHora ? ` – ${new Date(r.dataHora).toLocaleDateString('pt-BR')}` : ''}</span>
                  <span className="text-brand font-medium tabular-nums flex-shrink-0">{r.presentes}/{alunosCount} ({pct}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-line/50 overflow-hidden">
                  <div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
      {aulaSelecionada && (
        <AulaAlunosModal turmaId={turmaId} cursoId={cursoId} aula={aulaSelecionada} onClose={() => setAulaSelecionada(null)} />
      )}
    </Card>
  );
}

/* ═══════════════════ Engajamento nas Atividades (embaixador) ═══════════════════ */
function AtividadesEngajamento({ turmaId, cursoId, alunosCount }: {
  turmaId: string; cursoId: string; alunosCount: number;
}) {
  type Row = { id: string; ordem: number; titulo: string; entregues: number };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<Row | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: atividades } = await supabase.from('atividades').select('id,ordem,titulo').eq('turma_id', turmaId).eq('curso_id', cursoId).order('ordem').order('created_at', { ascending: true });
      const atividadeIds = (atividades ?? []).map((a) => a.id);
      const { data: envios } = atividadeIds.length
        ? await supabase.from('atividade_envios').select('atividade_id,enviado_em').in('atividade_id', atividadeIds)
        : { data: [] };
      const entreguesPorAtividade: Record<string, number> = {};
      (envios ?? []).forEach((e) => { if (e.enviado_em) entreguesPorAtividade[e.atividade_id] = (entreguesPorAtividade[e.atividade_id] ?? 0) + 1; });
      const list = (atividades ?? []).map((a) => ({ id: a.id, ordem: a.ordem, titulo: a.titulo, entregues: entreguesPorAtividade[a.id] ?? 0 }));
      setRows(sortProjetoFinalLast(list));
      setLoading(false);
    })();
  }, [turmaId, cursoId]);

  if (loading) return <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-md" />)}</div>;

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base mb-5">Engajamento nas Atividades</h2>
      {rows.length === 0 ? <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Nenhuma atividade cadastrada" /> : (
        <div className="space-y-4">
          {rows.map((r) => {
            const pct = alunosCount ? Math.round((r.entregues / alunosCount) * 100) : 0;
            return (
              <button key={r.id} onClick={() => setAtividadeSelecionada(r)} className="flex items-center gap-4 w-full text-left rounded-md -mx-2 px-2 py-1 hover:bg-panel-2/40 transition-colors">
                <span className="text-fg-2 text-sm w-32 sm:w-40 flex-shrink-0 truncate">{r.titulo}</span>
                <div className="flex-1 h-2 rounded-full bg-line/50 overflow-hidden">
                  <div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-fg-3 text-xs tabular-nums flex-shrink-0 w-16 text-right">{r.entregues}/{alunosCount}</span>
              </button>
            );
          })}
        </div>
      )}
      {atividadeSelecionada && (
        <AtividadeAlunosModal turmaId={turmaId} cursoId={cursoId} atividade={atividadeSelecionada} onClose={() => setAtividadeSelecionada(null)} />
      )}
    </Card>
  );
}

/** Busca os alunos matriculados na turma/curso, reaproveitada pelos dois modais abaixo. */
async function carregarAlunosDaTurma(turmaId: string, cursoId: string): Promise<{ id: string; nome: string | null; email: string }[]> {
  const { data: ut } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId).eq('curso_id', cursoId);
  const userIds = (ut ?? []).map((r) => r.user_id);
  if (!userIds.length) return [];
  const { data: profiles } = await supabase.from('profiles').select('id,email,nome,role').in('id', userIds);
  return (profiles ?? []).filter((p) => p.role === 'student').map((p) => ({ id: p.id, nome: p.nome, email: p.email }));
}

/* ═══════════════════ Alunos de uma aula (embaixador) ═══════════════════ */
function AulaAlunosModal({ turmaId, cursoId, aula, onClose }: {
  turmaId: string; cursoId: string; aula: { id: string; ordem: number; titulo: string; dataHora: string | null }; onClose: () => void;
}) {
  type AlunoPresenca = { id: string; nome: string | null; email: string; presente: boolean };
  const [alunos, setAlunos] = useState<AlunoPresenca[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<'nome_az' | 'nome_za' | 'presentes_primeiro' | 'ausentes_primeiro'>('nome_az');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [lista, { data: presencas }] = await Promise.all([
        carregarAlunosDaTurma(turmaId, cursoId),
        supabase.from('presencas').select('user_id,presente').eq('turma_id', turmaId).eq('aula_id', aula.id),
      ]);
      const presenteMap = new Map(((presencas ?? []) as { user_id: string; presente: boolean }[]).map((p) => [p.user_id, p.presente]));
      setAlunos(lista.map((a) => ({ ...a, presente: !!presenteMap.get(a.id) })));
      setLoading(false);
    })();
  }, [turmaId, cursoId, aula.id]);

  const presentes = alunos.filter((a) => a.presente).length;

  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const nomeDe = (a: AlunoPresenca) => a.nome || a.email.split('@')[0];
    return alunos
      .filter((a) => !termo || nomeDe(a).toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo))
      .sort((a, b) => {
        if (ordem === 'nome_az') return nomeDe(a).localeCompare(nomeDe(b));
        if (ordem === 'nome_za') return nomeDe(b).localeCompare(nomeDe(a));
        if (ordem === 'presentes_primeiro') return Number(b.presente) - Number(a.presente);
        return Number(a.presente) - Number(b.presente);
      });
  }, [alunos, busca, ordem]);

  return (
    <Modal open onClose={onClose} size="lg" title={`Aula ${aula.ordem} — ${aula.titulo}`}>
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-md" />)}</div>
      ) : alunos.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhum aluno nesta turma/curso" />
      ) : (
        <>
          <p className="text-fg-3 text-sm mb-4">{presentes} de {alunos.length} presentes</p>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar aluno..." className="flex-1" />
            <Select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className="sm:w-52">
              <option value="nome_az">Nome A-Z</option>
              <option value="nome_za">Nome Z-A</option>
              <option value="presentes_primeiro">Presentes primeiro</option>
              <option value="ausentes_primeiro">Ausentes primeiro</option>
            </Select>
          </div>
          {alunosFiltrados.length === 0 ? <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhum aluno encontrado" /> : (
          <ul className="-mx-5">
            {alunosFiltrados.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-line last:border-0">
                <Avatar name={a.nome} email={a.email} size={28} />
                <span className="flex-1 min-w-0 text-sm text-fg-2 truncate">{a.nome || a.email.split('@')[0]}</span>
                <Badge tone={a.presente ? 'success' : 'default'} className="flex-shrink-0">{a.presente ? 'Presente' : 'Ausente'}</Badge>
              </li>
            ))}
          </ul>
          )}
        </>
      )}
    </Modal>
  );
}

/* ═══════════════════ Alunos de uma atividade (embaixador) ═══════════════════ */
function AtividadeAlunosModal({ turmaId, cursoId, atividade, onClose }: {
  turmaId: string; cursoId: string; atividade: { id: string; titulo: string }; onClose: () => void;
}) {
  type AlunoEnvio = { id: string; nome: string | null; email: string; enviadoEm: string | null };
  const [alunos, setAlunos] = useState<AlunoEnvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<'nome_az' | 'nome_za' | 'envio_recente' | 'envio_antigo' | 'entregues_primeiro' | 'pendentes_primeiro'>('nome_az');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [lista, { data: envios }] = await Promise.all([
        carregarAlunosDaTurma(turmaId, cursoId),
        supabase.from('atividade_envios').select('aluno_id,enviado_em').eq('atividade_id', atividade.id),
      ]);
      const envioMap = new Map(((envios ?? []) as { aluno_id: string; enviado_em: string | null }[]).map((e) => [e.aluno_id, e.enviado_em]));
      setAlunos(lista.map((a) => ({ ...a, enviadoEm: envioMap.get(a.id) ?? null })));
      setLoading(false);
    })();
  }, [turmaId, cursoId, atividade.id]);

  const entregues = alunos.filter((a) => a.enviadoEm).length;

  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const nomeDe = (a: AlunoEnvio) => a.nome || a.email.split('@')[0];
    return alunos
      .filter((a) => !termo || nomeDe(a).toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo))
      .sort((a, b) => {
        if (ordem === 'nome_az') return nomeDe(a).localeCompare(nomeDe(b));
        if (ordem === 'nome_za') return nomeDe(b).localeCompare(nomeDe(a));
        if (ordem === 'entregues_primeiro') return Number(!!b.enviadoEm) - Number(!!a.enviadoEm);
        if (ordem === 'pendentes_primeiro') return Number(!!a.enviadoEm) - Number(!!b.enviadoEm);
        const da = a.enviadoEm ? new Date(a.enviadoEm).getTime() : 0;
        const db = b.enviadoEm ? new Date(b.enviadoEm).getTime() : 0;
        return ordem === 'envio_recente' ? db - da : da - db;
      });
  }, [alunos, busca, ordem]);

  return (
    <Modal open onClose={onClose} size="lg" title={atividade.titulo}>
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-md" />)}</div>
      ) : alunos.length === 0 ? (
        <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Nenhum aluno nesta turma/curso" />
      ) : (
        <>
          <p className="text-fg-3 text-sm mb-4">{entregues} de {alunos.length} entregues</p>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar aluno..." className="flex-1" />
            <Select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className="sm:w-52">
              <option value="nome_az">Nome A-Z</option>
              <option value="nome_za">Nome Z-A</option>
              <option value="envio_recente">Envio mais recente</option>
              <option value="envio_antigo">Envio mais antigo</option>
              <option value="entregues_primeiro">Entregues primeiro</option>
              <option value="pendentes_primeiro">Pendentes primeiro</option>
            </Select>
          </div>
          {alunosFiltrados.length === 0 ? <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Nenhum aluno encontrado" /> : (
          <ul className="-mx-5">
            {alunosFiltrados.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-line last:border-0">
                <Avatar name={a.nome} email={a.email} size={28} />
                <span className="flex-1 min-w-0 text-sm text-fg-2 truncate">{a.nome || a.email.split('@')[0]}</span>
                <span className="text-fg-3 text-xs flex-shrink-0">
                  {a.enviadoEm ? `Entregue – ${new Date(a.enviadoEm).toLocaleDateString('pt-BR')}` : (
                    <Badge tone="default">Não entregue</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
          )}
        </>
      )}
    </Modal>
  );
}

/* ═══════════════════ Detalhe do aluno (embaixador) ═══════════════════ */
function AlunoDetalheModal({ turmaId, cursoId, aluno, onClose }: {
  turmaId: string; cursoId: string; aluno: AlunoResumo; onClose: () => void;
}) {
  type AtividadeRow = { id: string; titulo: string; enviadoEm: string | null };
  type AulaRow = { id: string; titulo: string; dataHora: string | null; presente: boolean };
  const [atividades, setAtividades] = useState<AtividadeRow[]>([]);
  const [aulas, setAulas] = useState<AulaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // aulas/aula_horarios ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: ats }, { data: aulasList }, { data: hs }, { data: presencas }] = await Promise.all([
        supabase.from('atividades').select('id,ordem,titulo').eq('turma_id', turmaId).eq('curso_id', cursoId).order('ordem').order('created_at', { ascending: true }),
        sb.from('aulas').select('id,ordem,titulo').eq('curso_id', cursoId).order('ordem'),
        sb.from('aula_horarios').select('aula_id,data_hora').eq('turma_id', turmaId).eq('curso_id', cursoId),
        supabase.from('presencas').select('aula_id,presente').eq('turma_id', turmaId).eq('user_id', aluno.id),
      ]);
      const atividadeIds = (ats ?? []).map((a) => a.id);
      const { data: envios } = atividadeIds.length
        ? await supabase.from('atividade_envios').select('atividade_id,enviado_em').eq('aluno_id', aluno.id).in('atividade_id', atividadeIds)
        : { data: [] };
      const envioMap = new Map((envios ?? []).map((e) => [e.atividade_id, e.enviado_em]));
      setAtividades(sortProjetoFinalLast((ats ?? []).map((a) => ({ id: a.id, titulo: a.titulo, enviadoEm: envioMap.get(a.id) ?? null }))));

      const horariosMap = new Map(((hs ?? []) as { aula_id: string; data_hora: string }[]).map((h) => [h.aula_id, h.data_hora]));
      const presencaMap = new Map(((presencas ?? []) as { aula_id: string; presente: boolean }[]).map((p) => [p.aula_id, p.presente]));
      setAulas(((aulasList ?? []) as { id: string; titulo: string }[]).map((a) => ({
        id: a.id, titulo: a.titulo, dataHora: horariosMap.get(a.id) ?? null, presente: !!presencaMap.get(a.id),
      })));
      setLoading(false);
    })();
  }, [turmaId, cursoId, aluno.id]);

  const atividadesEntregues = atividades.filter((a) => a.enviadoEm).length;
  const pctAtividades = atividades.length ? Math.round((atividadesEntregues / atividades.length) * 100) : 0;
  const aulasPresentes = aulas.filter((a) => a.presente).length;
  const pctAulas = aulas.length ? Math.round((aulasPresentes / aulas.length) * 100) : 0;

  return (
    <Modal open onClose={onClose} size="lg" title={aluno.nome || aluno.email}>
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-md" />)}</div>
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-md" />)}</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider mb-2">
              Atividades - {pad2(atividadesEntregues)}/{pad2(atividades.length)} ({pctAtividades}%)
            </h3>
            {atividades.length === 0 ? <p className="text-fg-3 text-sm">Nenhuma atividade.</p> : (
              <ul className="space-y-1.5">
                {atividades.map((a) => (
                  <li key={a.id} className="text-sm text-fg-2">
                    {a.titulo}{a.enviadoEm ? ` – ${new Date(a.enviadoEm).toLocaleDateString('pt-BR')}` : ''} –{' '}
                    <span className={a.enviadoEm ? 'text-ok font-medium' : 'text-fg-3'}>{a.enviadoEm ? 'Entregue' : 'Não entregue'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider mb-2">
              Presença - {pad2(aulasPresentes)}/{pad2(aulas.length)} ({pctAulas}%)
            </h3>
            {aulas.length === 0 ? <p className="text-fg-3 text-sm">Nenhuma aula.</p> : (
              <ul className="space-y-1.5">
                {aulas.map((a) => (
                  <li key={a.id} className="text-sm text-fg-2">
                    {a.titulo}{a.dataHora ? ` – ${new Date(a.dataHora).toLocaleDateString('pt-BR')}` : ''} –{' '}
                    <span className={a.presente ? 'text-ok font-medium' : 'text-danger'}>{a.presente ? 'Presente' : 'Ausente'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
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
