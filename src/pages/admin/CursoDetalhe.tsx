import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink, PlayCircle, Users, Calendar, Clock, GraduationCap, MoreHorizontal, ClipboardCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  Button, IconButton, Card, Modal, EmptyState, Skeleton, ProgressBar, Avatar, StatTile, Tabs, Switch,
  Field, Input, Textarea, Select, Alert, DropdownMenu, useToast, useConfirm,
} from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { getYouTubeId } from '../../lib/youtube';
import { uploadAulaCapa } from '../../lib/storage';
import { SignedImage } from '../../components/SignedImage';
import CursoAtividadesTab from './CursoAtividadesTab';
import CursoPresencaTab, { PresencaAulaModal } from './CursoPresencaTab';
import { FAIXA_OPTIONS } from '../../lib/faixa';

type Turma = { id: string; nome: string };
type Curso = { id: string; titulo: string; descricao: string | null; link_ao_vivo: string | null; faixa: string | null };
type Aula = { id: string; curso_id: string; titulo: string; descricao: string | null; youtube_url: string; ordem: number; publicada: boolean; capa_url: string | null };
type Horario = { aula_id: string; data_hora: string };
type Aluno = { id: string; email: string; concluidas: number; total: number };
type Tab = 'dashboard' | 'aulas' | 'atividades' | 'presenca' | 'alunos';
type Professor = { id: string; nome: string | null; email: string };
type CursoTurmaInfo = {
  data_inicio: string | null; data_fim: string | null; professor_id: string | null;
  horario_inicio: string | null; horario_fim: string | null; dia_semana: string | null;
};

export const DIA_SEMANA_OPTIONS = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];
const DIA_SEMANA_LABEL: Record<string, string> = Object.fromEntries(DIA_SEMANA_OPTIONS.map((o) => [o.value, o.label]));

function dateOnlyBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export default function CursoDetalhe() {
  const { turmaId, cursoId } = useParams<{ turmaId: string; cursoId: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [turma, setTurma] = useState<Turma | null>(null);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [cursoTurmaInfo, setCursoTurmaInfo] = useState<CursoTurmaInfo | null>(null);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [editCursoOpen, setEditCursoOpen] = useState(false);

  const [dashLoading, setDashLoading] = useState(true);
  const [aulaCount, setAulaCount] = useState(0);
  const [alunosCount, setAlunosCount] = useState(0);

  const [aulas, setAulas] = useState<Aula[]>([]);
  const [horarios, setHorarios] = useState<Record<string, string>>({});
  const [aulasLoading, setAulasLoading] = useState(false);
  const [createAulaOpen, setCreateAulaOpen] = useState(false);
  const [editAula, setEditAula] = useState<Aula | null>(null);
  const [presencaAula, setPresencaAula] = useState<Aula | null>(null);

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunosLoading, setAlunosLoading] = useState(false);

  const loadBase = async () => {
    // link_ao_vivo/curso_turmas extras ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: t }, { data: c }, { data: ct }, { data: profs }] = await Promise.all([
      supabase.from('turmas').select('id,nome').eq('id', turmaId!).maybeSingle(),
      sb.from('cursos').select('*').eq('id', cursoId!).maybeSingle(),
      sb.from('curso_turmas').select('data_inicio,data_fim,professor_id,horario_inicio,horario_fim,dia_semana').eq('turma_id', turmaId!).eq('curso_id', cursoId!).maybeSingle(),
      supabase.from('profiles').select('id,nome,email').eq('role', 'professor').order('nome'),
    ]);
    setTurma(t); setCurso(c); setCursoTurmaInfo(ct ?? null); setProfessores(profs ?? []);
  };

  const loadDashboard = async () => {
    setDashLoading(true);
    const [{ data: as }, { data: utData }] = await Promise.all([
      supabase.from('aulas').select('id').eq('curso_id', cursoId!),
      supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!),
    ]);
    setAulaCount((as ?? []).length);
    const userIds = (utData ?? []).map((r) => r.user_id);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id,role').in('id', userIds);
      setAlunosCount((profiles ?? []).filter((p) => p.role === 'student').length);
    } else setAlunosCount(0);
    setDashLoading(false);
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
    setHorarios(Object.fromEntries(((hs ?? []) as Horario[]).map((h) => [h.aula_id, h.data_hora])));
    setAulasLoading(false);
  };

  const loadAlunos = async () => {
    setAlunosLoading(true);
    const { data: utData } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!);
    const userIds = (utData ?? []).map((r) => r.user_id);
    if (userIds.length === 0) { setAlunos([]); setAlunosLoading(false); return; }
    const { data: profiles } = await supabase.from('profiles').select('id,email,role').in('id', userIds);
    const students = (profiles ?? []).filter((p) => p.role === 'student');
    if (students.length === 0) { setAlunos([]); setAlunosLoading(false); return; }
    const { data: aulasData } = await supabase.from('aulas').select('id').eq('curso_id', cursoId!);
    const aulaIds = (aulasData ?? []).map((a) => a.id);
    const total = aulaIds.length;
    const studentIds = students.map((s) => s.id);
    const { data: prog } = total > 0
      ? await supabase.from('progresso').select('user_id,aula_id,concluido').in('user_id', studentIds).in('aula_id', aulaIds).eq('concluido', true)
      : { data: [] };
    const doneMap: Record<string, number> = {};
    (prog ?? []).forEach((p) => { doneMap[p.user_id] = (doneMap[p.user_id] ?? 0) + 1; });
    setAlunos(students.map((s) => ({ id: s.id, email: s.email, concluidas: doneMap[s.id] ?? 0, total })));
    setAlunosLoading(false);
  };

  useEffect(() => { loadBase(); loadDashboard(); }, [turmaId, cursoId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'aulas') loadAulas(); }, [tab, cursoId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'alunos') loadAlunos(); }, [tab, turmaId, cursoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const delAula = async (a: Aula) => {
    const ok = await confirm({ title: 'Excluir aula', tone: 'danger', confirmLabel: 'Excluir', message: <>Excluir <strong className="text-fg">{a.titulo}</strong>?</> });
    if (!ok) return;
    const { error } = await supabase.from('aulas').delete().eq('id', a.id);
    if (error) toast.error(error.message); else { toast.success('Aula excluída.'); loadAulas(); loadDashboard(); }
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

  const delCurso = async () => {
    const ok = await confirm({ title: 'Excluir curso', tone: 'danger', confirmLabel: 'Excluir', message: <>Excluir <strong className="text-fg">{curso?.titulo}</strong>? Todas as aulas serão removidas.</> });
    if (!ok) return;
    const { error } = await supabase.from('cursos').delete().eq('id', cursoId!);
    if (error) toast.error(error.message); else { toast.success('Curso excluído.'); nav(`/admin/turmas/${turmaId}`); }
  };

  const maxOrdem = useMemo(() => aulas.reduce((m, a) => Math.max(m, a.ordem), 0), [aulas]);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Turmas', to: '/admin/turmas' }, { label: turma?.nome ?? '…', to: `/admin/turmas/${turmaId}` }, { label: curso?.titulo ?? '…' }]}
        title={curso?.titulo ?? '…'}
        subtitle={curso?.descricao || undefined}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditCursoOpen(true)}>Editar</Button>
            <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={delCurso}>Excluir</Button>
          </>
        }
      />

      <Tabs className="mb-6" value={tab} onChange={setTab}
        tabs={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'aulas', label: 'Aulas', count: aulaCount }, { value: 'atividades', label: 'Atividades' }, { value: 'presenca', label: 'Presença' }, { value: 'alunos', label: 'Alunos' }]} />

      {/* DASHBOARD */}
      {tab === 'dashboard' && (dashLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Aulas" value={aulaCount} icon={<PlayCircle className="w-4 h-4" />} />
            <StatTile label="Alunos matriculados" value={alunosCount} icon={<Users className="w-4 h-4" />} />
            <InfoCard icon={<Calendar className="w-4 h-4" />} label="Data de início" value={dateOnlyBR(cursoTurmaInfo?.data_inicio ?? null)} placeholder={!cursoTurmaInfo?.data_inicio} />
            <InfoCard icon={<Calendar className="w-4 h-4" />} label="Data de fim" value={dateOnlyBR(cursoTurmaInfo?.data_fim ?? null)} placeholder={!cursoTurmaInfo?.data_fim} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoCard icon={<GraduationCap className="w-4 h-4" />} label="Professor responsável"
              value={(() => { const p = professores.find((x) => x.id === cursoTurmaInfo?.professor_id); return p ? (p.nome || p.email) : '—'; })()}
              placeholder={!cursoTurmaInfo?.professor_id} />
            <InfoCard icon={<Clock className="w-4 h-4" />} label="Horário das aulas"
              value={cursoTurmaInfo?.horario_inicio ? `${cursoTurmaInfo.horario_inicio.slice(0, 5)} às ${cursoTurmaInfo.horario_fim?.slice(0, 5) ?? '—'}` : '—'}
              placeholder={!cursoTurmaInfo?.horario_inicio} />
            <InfoCard icon={<Clock className="w-4 h-4" />} label="Dia da semana"
              value={cursoTurmaInfo?.dia_semana ? DIA_SEMANA_LABEL[cursoTurmaInfo.dia_semana] ?? cursoTurmaInfo.dia_semana : '—'}
              placeholder={!cursoTurmaInfo?.dia_semana} />
          </div>
        </div>
      ))}

      {/* AULAS */}
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
                          <IconButton label="Lançar presença" onClick={() => setPresencaAula(a)}><ClipboardCheck className="w-4 h-4" /></IconButton>
                          <IconButton label="Mover para cima" onClick={() => moveAula(a, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></IconButton>
                          <IconButton label="Mover para baixo" onClick={() => moveAula(a, 1)} disabled={i === aulas.length - 1}><ArrowDown className="w-4 h-4" /></IconButton>
                          <DropdownMenu
                            items={[
                              ...(a.youtube_url ? [{ label: 'Abrir no YouTube', icon: <ExternalLink className="w-4 h-4" />, onClick: () => window.open(a.youtube_url, '_blank', 'noopener') }] : []),
                              { label: 'Lançar presença', icon: <ClipboardCheck className="w-4 h-4" />, onClick: () => setPresencaAula(a) },
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

      {/* ATIVIDADES */}
      {tab === 'atividades' && <CursoAtividadesTab turmaId={turmaId!} cursoId={cursoId!} />}

      {/* PRESENÇA */}
      {tab === 'presenca' && <CursoPresencaTab turmaId={turmaId!} cursoId={cursoId!} />}

      {/* ALUNOS */}
      {tab === 'alunos' && (
        <div>
          <p className="text-fg-3 text-sm mb-4">Progresso dos alunos neste curso.</p>
          {alunosLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
            alunos.length === 0 ? <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhum aluno nesta turma" description="Vincule alunos a esta turma em Usuários." /> : (
              <Card className="overflow-hidden">
                <ul>
                  {alunos.map((a) => {
                    const pct = a.total > 0 ? Math.round((a.concluidas / a.total) * 100) : 0;
                    return (
                      <li key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0">
                        <Avatar email={a.email} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-fg text-sm truncate">{a.email}</p>
                          <div className="flex items-center gap-2 mt-1.5"><ProgressBar value={pct} /><span className="text-xs text-fg-3 whitespace-nowrap">{a.concluidas}/{a.total}</span></div>
                        </div>
                        <span className="text-sm font-medium text-brand tabular-nums">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
        </div>
      )}

      <CursoEditModal open={editCursoOpen} curso={curso} turmaId={turmaId!} info={cursoTurmaInfo} professores={professores} onClose={() => setEditCursoOpen(false)} onDone={() => { setEditCursoOpen(false); loadBase(); }} />
      <AulaModal open={createAulaOpen} aula={null} cursoId={cursoId!} turmaId={turmaId!} dataHoraAtual={null} nextOrdem={maxOrdem + 1} onClose={() => setCreateAulaOpen(false)} onDone={() => { setCreateAulaOpen(false); loadAulas(); loadDashboard(); }} />
      <AulaModal open={!!editAula} aula={editAula} cursoId={cursoId!} turmaId={turmaId!} dataHoraAtual={editAula ? horarios[editAula.id] ?? null : null} nextOrdem={maxOrdem + 1} onClose={() => setEditAula(null)} onDone={() => { setEditAula(null); loadAulas(); }} />
      {presencaAula && (
        <PresencaAulaModal turmaId={turmaId!} cursoId={cursoId!} aula={presencaAula} onClose={() => setPresencaAula(null)} />
      )}
    </div>
  );
}

function InfoCard({ icon, label, value, placeholder = true }: { icon: React.ReactNode; label: string; value?: string; placeholder?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2 text-fg-3">{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
      <p className={placeholder ? 'text-fg-3 italic text-sm' : 'text-fg text-sm font-medium'}>{placeholder ? 'Em breve' : (value ?? '—')}</p>
    </Card>
  );
}

function CursoEditModal({ open, curso, turmaId, info, professores, onClose, onDone }: {
  open: boolean; curso: Curso | null; turmaId: string; info: CursoTurmaInfo | null; professores: Professor[]; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [linkAoVivo, setLinkAoVivo] = useState('');
  const [faixa, setFaixa] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [professorId, setProfessorId] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioFim, setHorarioFim] = useState('');
  const [diaSemana, setDiaSemana] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitulo(curso?.titulo ?? ''); setDescricao(curso?.descricao ?? ''); setLinkAoVivo(curso?.link_ao_vivo ?? ''); setFaixa(curso?.faixa ?? '');
    setDataInicio(info?.data_inicio ?? ''); setDataFim(info?.data_fim ?? ''); setProfessorId(info?.professor_id ?? '');
    setHorarioInicio(info?.horario_inicio?.slice(0, 5) ?? ''); setHorarioFim(info?.horario_fim?.slice(0, 5) ?? '');
    setDiaSemana(info?.dia_semana ?? ''); setErr(null);
  }, [curso, info, open]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Informe o título do curso.'); return; }
    setLoading(true);
    // link_ao_vivo/curso_turmas extras ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb.from('cursos').update({
      titulo: titulo.trim(), descricao: descricao.trim(), link_ao_vivo: linkAoVivo.trim() || null, faixa: faixa || null,
    }).eq('id', curso!.id);
    if (error) { setLoading(false); setErr(error.message); return; }

    const { error: ctErr } = await sb.from('curso_turmas').upsert({
      turma_id: turmaId, curso_id: curso!.id,
      data_inicio: dataInicio || null, data_fim: dataFim || null, professor_id: professorId || null,
      horario_inicio: horarioInicio || null, horario_fim: horarioFim || null, dia_semana: diaSemana || null,
    }, { onConflict: 'turma_id,curso_id' });
    setLoading(false);
    if (ctErr) setErr(ctErr.message); else { toast.success('Curso atualizado.'); onDone(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar curso"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Título" required htmlFor="cd-tit"><Input id="cd-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} data-autofocus /></Field>
        <Field label="Descrição" htmlFor="cd-desc"><Textarea id="cd-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></Field>
        <Field label="Faixa" hint="Define a ordem fixa em que os blocos aparecem" htmlFor="cd-faixa">
          <Select id="cd-faixa" value={faixa} onChange={(e) => setFaixa(e.target.value)}>
            <option value="">Não definida</option>
            {FAIXA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Link da aula ao vivo" hint="Reutilizado em todas as aulas deste curso" htmlFor="cd-link"><Input id="cd-link" value={linkAoVivo} onChange={(e) => setLinkAoVivo(e.target.value)} placeholder="https://meet.google.com/..." /></Field>

        <div className="border-t border-line pt-4 grid grid-cols-2 gap-4">
          <Field label="Data de início" htmlFor="cd-dini"><Input id="cd-dini" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></Field>
          <Field label="Data de fim" htmlFor="cd-dfim"><Input id="cd-dfim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></Field>
        </div>
        <Field label="Professor responsável" htmlFor="cd-prof">
          <Select id="cd-prof" value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
            <option value="">Não definido</option>
            {professores.map((p) => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Horário — início" htmlFor="cd-hini"><Input id="cd-hini" type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} /></Field>
          <Field label="Horário — fim" htmlFor="cd-hfim"><Input id="cd-hfim" type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} /></Field>
        </div>
        <Field label="Dia da semana" htmlFor="cd-dia">
          <Select id="cd-dia" value={diaSemana} onChange={(e) => setDiaSemana(e.target.value)}>
            <option value="">Não definido</option>
            {DIA_SEMANA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

/** Converte um timestamptz ISO para o formato aceito por <input type="datetime-local">, no horário local. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AulaModal({ open, aula, cursoId, turmaId, dataHoraAtual, nextOrdem, onClose, onDone }: {
  open: boolean; aula: Aula | null; cursoId: string; turmaId: string; dataHoraAtual: string | null; nextOrdem: number; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [url, setUrl] = useState('');
  const [ordem, setOrdem] = useState(1);
  const [dataHora, setDataHora] = useState('');
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitulo(aula?.titulo ?? ''); setDescricao(aula?.descricao ?? ''); setUrl(aula?.youtube_url ?? '');
    setOrdem(aula?.ordem ?? nextOrdem); setDataHora(toDatetimeLocal(dataHoraAtual)); setCapaFile(null); setErr(null);
  }, [aula, nextOrdem, dataHoraAtual, open]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Informe o título da aula.'); return; }
    if (url && !getYouTubeId(url)) { setErr('URL do YouTube inválida.'); return; }
    setLoading(true);
    let capa_url = aula?.capa_url ?? null;
    if (capaFile) {
      try {
        const up = await uploadAulaCapa(capaFile, `${cursoId}`);
        capa_url = up.path;
      } catch (e) { setLoading(false); setErr((e as Error).message); return; }
    }
    const payload = { titulo: titulo.trim(), descricao: descricao.trim(), youtube_url: url.trim(), ordem, curso_id: cursoId, capa_url };
    // capa_url ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedAula, error } = aula
      ? await (supabase as any).from('aulas').update(payload).eq('id', aula.id).select().single()
      : await (supabase as any).from('aulas').insert(payload).select().single();
    if (error || !savedAula) { setLoading(false); setErr(error?.message ?? 'Erro ao salvar aula.'); return; }

    // aula_horarios ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    if (dataHora) {
      const { error: hErr } = await sb.from('aula_horarios').upsert(
        { turma_id: turmaId, curso_id: cursoId, aula_id: savedAula.id, data_hora: new Date(dataHora).toISOString() },
        { onConflict: 'turma_id,aula_id' }
      );
      if (hErr) { setLoading(false); setErr(hErr.message); return; }
    } else if (aula) {
      await sb.from('aula_horarios').delete().eq('turma_id', turmaId).eq('aula_id', aula.id);
    }

    setLoading(false);
    toast.success(aula ? 'Aula atualizada.' : 'Aula criada.');
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={aula ? 'Editar aula' : 'Nova aula'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Título" required htmlFor="cda-tit"><Input id="cda-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} data-autofocus /></Field>
        <Field label="URL do YouTube" htmlFor="cda-url"><Input id="cda-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Ordem" htmlFor="cda-ord"><Input id="cda-ord" type="number" value={ordem} onChange={(e) => setOrdem(parseInt(e.target.value) || 1)} min={1} /></Field>
          <Field label="Data e horário" hint="Desta turma" htmlFor="cda-dh"><Input id="cda-dh" type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} /></Field>
        </div>
        <Field label="Descrição" htmlFor="cda-desc"><Textarea id="cda-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></Field>
        <Field label="Capa da aula" hint="Opcional — usada nas listas" htmlFor="cda-capa">
          <div className="flex items-center gap-3">
            {(capaFile || aula?.capa_url) && (
              <div className="w-16 h-9 rounded-md bg-black overflow-hidden flex-shrink-0 border border-line">
                {capaFile ? <img src={URL.createObjectURL(capaFile)} className="w-full h-full object-cover" alt="" /> : <SignedImage bucket="aulas" path={aula!.capa_url} className="w-full h-full object-cover" />}
              </div>
            )}
            <Input id="cda-capa" type="file" accept="image/*" onChange={(e) => setCapaFile(e.target.files?.[0] ?? null)} className="!py-2" />
          </div>
        </Field>
      </div>
    </Modal>
  );
}
