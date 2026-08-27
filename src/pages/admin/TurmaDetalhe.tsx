import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, PlayCircle, Users, BookOpen, GraduationCap, Calendar, Building2, DollarSign,
  Search, MoreHorizontal,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  Button, IconButton, Card, Modal, EmptyState, Skeleton, Badge, Avatar, StatTile, Tabs,
  SearchInput, Select, Field, Input, Textarea, Alert, FilterChip, DropdownMenu,
  TableWrap, THead, TBody, Tr, Th, Td, useToast, useConfirm,
} from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { statusLabel } from '../../lib/users';
import { TipoCobranca, TIPO_COBRANCA_LABEL, describeCobranca } from '../../lib/financeiro';
import { uploadCapa } from '../../lib/storage';
import { SignedImage } from '../../components/SignedImage';
import { FAIXA_OPTIONS, labelDaFaixa, ordemDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';

type Turma = { id: string; nome: string; codigo: string | null; descricao: string | null; observacao: string | null; data_inicio: string | null; capa_url: string | null; created_at: string | null; tipo_cobranca: TipoCobranca | null; valor: number | null };
type Curso = { id: string; titulo: string; descricao: string | null; observacao: string | null; capa_url: string | null; faixa: string | null };
type Tab = 'dashboard' | 'cursos' | 'participantes';
type ParticipanteRole = 'student' | 'professor' | 'monitor' | 'admin';
type Participante = { id: string; email: string; nome: string | null; role: ParticipanteRole; status: string; cursoTitulo: string | null };

const ROLE_LABEL: Record<ParticipanteRole, string> = { student: 'Aluno', professor: 'Professor', monitor: 'Monitor', admin: 'Admin' };
const ROLE_TONE: Record<ParticipanteRole, 'default' | 'warn' | 'info' | 'success'> = { student: 'default', professor: 'warn', monitor: 'info', admin: 'success' };
const STATUS_TONE: Record<string, 'success' | 'warn' | 'danger'> = { active: 'success', pending: 'warn', blocked: 'danger' };

function dateOnlyBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export default function TurmaDetalhe() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const faixaCapas = useFaixaCapas();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [turma, setTurma] = useState<Turma | null>(null);
  const [editTurmaOpen, setEditTurmaOpen] = useState(false);

  const [dashLoading, setDashLoading] = useState(true);
  const [alunosCount, setAlunosCount] = useState(0);
  const [professoresCount, setProfessoresCount] = useState(0);
  const [cursosCount, setCursosCount] = useState(0);
  const [aulasPerCurso, setAulasPerCurso] = useState<{ titulo: string; count: number }[]>([]);

  const [cursosLoading, setCursosLoading] = useState(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [aulaCounts, setAulaCounts] = useState<Record<string, number>>({});
  const [createCursoOpen, setCreateCursoOpen] = useState(false);
  const [editCurso, setEditCurso] = useState<Curso | null>(null);

  const [participantesLoading, setParticipantesLoading] = useState(false);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'' | ParticipanteRole>('');

  const loadDashboard = async () => {
    setDashLoading(true);
    // codigo/capa_url ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (supabase as any).from('turmas').select('*').eq('id', turmaId!).maybeSingle();
    setTurma(t as Turma | null);
    const { data: utData } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!);
    const userIds = (utData ?? []).map((r) => r.user_id);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id,role').in('id', userIds);
      setAlunosCount((profiles ?? []).filter((p) => p.role === 'student').length);
      setProfessoresCount((profiles ?? []).filter((p) => p.role === 'professor' || p.role === 'monitor').length);
    } else { setAlunosCount(0); setProfessoresCount(0); }
    const { data: cts } = await supabase.from('curso_turmas').select('curso_id').eq('turma_id', turmaId!);
    const cursoIds = (cts ?? []).map((r) => r.curso_id);
    setCursosCount(cursoIds.length);
    if (cursoIds.length > 0) {
      const [{ data: cs }, { data: as }] = await Promise.all([
        supabase.from('cursos').select('id,titulo').in('id', cursoIds),
        supabase.from('aulas').select('curso_id').in('curso_id', cursoIds),
      ]);
      const countMap: Record<string, number> = {};
      (as ?? []).forEach((a) => { countMap[a.curso_id] = (countMap[a.curso_id] ?? 0) + 1; });
      setAulasPerCurso((cs ?? []).map((c) => ({ titulo: c.titulo, count: countMap[c.id] ?? 0 })));
    } else setAulasPerCurso([]);
    setDashLoading(false);
  };

  const loadCursos = async () => {
    setCursosLoading(true);
    const { data: cts } = await supabase.from('curso_turmas').select('curso_id').eq('turma_id', turmaId!);
    const cursoIds = ((cts ?? []) as { curso_id: string }[]).map((r) => r.curso_id);
    if (cursoIds.length > 0) {
      // faixa/capa_url ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: cs }, { data: as }] = await Promise.all([
        (supabase as any).from('cursos').select('*').in('id', cursoIds),
        supabase.from('aulas').select('curso_id').in('curso_id', cursoIds),
      ]);
      setCursos(((cs ?? []) as Curso[]).sort((a, b) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa)));
      const counts: Record<string, number> = {};
      (as ?? []).forEach((a) => { counts[a.curso_id] = (counts[a.curso_id] ?? 0) + 1; });
      setAulaCounts(counts);
    } else { setCursos([]); setAulaCounts({}); }
    setCursosLoading(false);
  };

  const loadParticipantes = async () => {
    setParticipantesLoading(true);
    const { data: uts } = await supabase.from('user_turmas').select('user_id,curso_id').eq('turma_id', turmaId!);
    const userIds = [...new Set((uts ?? []).map((r) => r.user_id))];
    if (!userIds.length) { setParticipantes([]); setParticipantesLoading(false); return; }
    const cursoIds = [...new Set((uts ?? []).filter((r) => r.curso_id).map((r) => r.curso_id as string))];
    const [{ data: profiles }, { data: cs }] = await Promise.all([
      supabase.from('profiles').select('id,email,nome,role,status').in('id', userIds),
      cursoIds.length ? supabase.from('cursos').select('id,titulo').in('id', cursoIds) : Promise.resolve({ data: [] }),
    ]);
    const cursoMap = new Map((cs ?? []).map((c) => [c.id, c.titulo]));
    const cursoPorUser = new Map<string, string | null>();
    (uts ?? []).forEach((r) => { if (r.curso_id && !cursoPorUser.has(r.user_id)) cursoPorUser.set(r.user_id, cursoMap.get(r.curso_id) ?? null); });
    const rows: Participante[] = (profiles ?? []).map((p) => ({
      id: p.id, email: p.email, nome: p.nome, role: p.role as ParticipanteRole, status: p.status, cursoTitulo: cursoPorUser.get(p.id) ?? null,
    })).sort((a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email));
    setParticipantes(rows);
    setParticipantesLoading(false);
  };

  useEffect(() => { loadDashboard(); }, [turmaId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'cursos') loadCursos(); }, [tab, turmaId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'participantes') loadParticipantes(); }, [tab, turmaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const delCurso = async (c: Curso) => {
    const ok = await confirm({ title: 'Excluir curso', tone: 'danger', confirmLabel: 'Excluir', message: <>Excluir <strong className="text-fg">{c.titulo}</strong>? Todas as aulas serão removidas.</> });
    if (!ok) return;
    const { error } = await supabase.from('cursos').delete().eq('id', c.id);
    if (error) toast.error(error.message); else { toast.success('Curso excluído.'); loadCursos(); loadDashboard(); }
  };

  const delTurma = async () => {
    const ok = await confirm({ title: 'Excluir turma', tone: 'danger', confirmLabel: 'Excluir', requireText: turma?.nome, message: <>Excluir <strong className="text-fg">{turma?.nome}</strong>? Os vínculos com alunos e cursos serão removidos.</> });
    if (!ok) return;
    const { error } = await supabase.from('turmas').delete().eq('id', turmaId!);
    if (error) toast.error(error.message); else { toast.success('Turma excluída.'); nav('/admin/turmas'); }
  };

  const totalAulas = aulasPerCurso.reduce((s, c) => s + c.count, 0);
  const filteredParticipantes = participantes.filter((p) => {
    if (search && !p.email.toLowerCase().includes(search.toLowerCase()) && !(p.nome ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && p.role !== filterRole) return false;
    return true;
  });
  const hasFilters = !!(search || filterRole);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Turmas', to: '/admin/turmas' }, { label: turma?.nome ?? '…' }]}
        title={turma?.nome ?? '…'}
        subtitle={turma?.descricao || undefined}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditTurmaOpen(true)}>Editar</Button>
            <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={delTurma}>Excluir</Button>
          </>
        }
      />

      <Tabs className="mb-6" value={tab} onChange={setTab}
        tabs={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'cursos', label: 'Cursos', count: cursosCount }, { value: 'participantes', label: 'Participantes' }]} />

      {/* DASHBOARD */}
      {tab === 'dashboard' && (dashLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Alunos" value={alunosCount} icon={<Users className="w-4 h-4" />} />
            <StatTile label="Professores/monitores" value={professoresCount} icon={<GraduationCap className="w-4 h-4" />} />
            <StatTile label="Cursos" value={cursosCount} icon={<BookOpen className="w-4 h-4" />} />
            <StatTile label="Aulas (total)" value={totalAulas} icon={<PlayCircle className="w-4 h-4" />} />
          </div>
          {(() => {
            const cobranca = describeCobranca(turma?.tipo_cobranca, turma?.valor, alunosCount);
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoCard icon={<Calendar className="w-4 h-4" />} label="Início da turma" value={dateOnlyBR(turma?.data_inicio ?? null)} />
                <InfoCard icon={<Calendar className="w-4 h-4" />} label="Data de criação" value={turma?.created_at ? new Date(turma.created_at).toLocaleDateString('pt-BR') : '—'} />
                <InfoCard icon={<Building2 className="w-4 h-4" />} label="Empresa associada" value="—" placeholder placeholderText="—" />
                <InfoCard icon={<DollarSign className="w-4 h-4" />} label="Cobrança" value={cobranca.total} sub={cobranca.detalhe ?? undefined} placeholder={!turma?.tipo_cobranca} placeholderText="Não configurada" />
              </div>
            );
          })()}
          {aulasPerCurso.length > 0 && (
            <div>
              <h2 className="text-base mb-3">Aulas por curso</h2>
              <Card className="overflow-hidden">
                <ul>
                  {aulasPerCurso.map((item, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-3 border-b border-line last:border-0">
                      <span className="text-fg text-sm">{item.titulo}</span>
                      <Badge>{item.count} aula{item.count !== 1 ? 's' : ''}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      ))}

      {/* CURSOS */}
      {tab === 'cursos' && (
        <div>
          <div className="flex items-center justify-between mb-4 gap-3">
            <p className="text-fg-3 text-sm">Cursos vinculados a esta turma.</p>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateCursoOpen(true)}>Novo curso</Button>
          </div>
          {cursosLoading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div> :
            cursos.length === 0 ? <EmptyState icon={<BookOpen className="w-8 h-8" />} title="Nenhum curso nesta turma" description="Crie o primeiro curso para esta turma." action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateCursoOpen(true)}>Novo curso</Button>} /> : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cursos.map((c) => (
                  <Card key={c.id} className="p-0 overflow-hidden cursor-pointer hover:border-line-strong transition-colors relative" onClick={() => nav(`/admin/turmas/${turmaId}/cursos/${c.id}`)}>
                    <div className="absolute top-3.5 right-3.5 z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu
                        items={[{ label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => setEditCurso(c) }, { type: 'separator' }, { label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, tone: 'danger', onClick: () => delCurso(c) }]}
                        trigger={({ toggle, ref, open }) => <IconButton ref={ref} label="Ações do curso" onClick={toggle} className={open ? 'bg-panel-3 text-fg' : ''}><MoreHorizontal className="w-4 h-4" /></IconButton>}
                      />
                    </div>
                    <div className="relative h-40">
                      {resolveCapaUrl(c.capa_url, c.faixa, faixaCapas) ? (
                        <>
                          <SignedImage bucket="capas" path={resolveCapaUrl(c.capa_url, c.faixa, faixaCapas)} className="absolute inset-0 w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-brand/10 grid place-items-center"><BookOpen className="w-6 h-6 text-brand" /></div>
                      )}
                    </div>
                    <div className="p-4 pt-3">
                      {labelDaFaixa(c.faixa) && <Badge tone="outline" className="mb-2">{labelDaFaixa(c.faixa)}</Badge>}
                      <h3 className="mb-1 pr-8 line-clamp-1">{c.titulo}</h3>
                      <p className="text-fg-3 text-sm mb-3 line-clamp-2 min-h-[40px]">{c.descricao || 'Sem descrição'}</p>
                      <div className="flex items-center gap-1.5 text-sm text-fg-2"><PlayCircle className="w-4 h-4 text-fg-3" /> {aulaCounts[c.id] ?? 0} aulas</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>
      )}

      {/* PARTICIPANTES */}
      {tab === 'participantes' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar nome ou e-mail…" className="flex-1" />
            <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value as '' | ParticipanteRole)} className="sm:w-[180px]">
              <option value="">Todos os papéis</option>
              <option value="student">Aluno</option><option value="professor">Professor</option><option value="monitor">Monitor</option><option value="admin">Admin</option>
            </Select>
          </div>
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {search && <FilterChip label={<>Busca: <span className="text-fg">{search}</span></>} onRemove={() => setSearch('')} />}
              {filterRole && <FilterChip label={<>Papel: <span className="text-fg">{ROLE_LABEL[filterRole]}</span></>} onRemove={() => setFilterRole('')} />}
              <span className="text-fg-3 text-xs">{filteredParticipantes.length} de {participantes.length}</span>
            </div>
          )}
          {participantesLoading ? <Skeleton className="h-64 rounded-xl" /> :
            filteredParticipantes.length === 0 ? (
              hasFilters ? <EmptyState icon={<Search className="w-8 h-8" />} title="Nenhum resultado" description="Ajuste a busca ou os filtros." />
                : <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhum participante nesta turma" description="Vincule alunos, professores ou monitores em Usuários." />
            ) : (
              <Card className="overflow-hidden">
                <TableWrap>
                  <THead><Tr><Th>Participante</Th><Th>Papel</Th><Th>Status</Th><Th>Curso vinculado</Th></Tr></THead>
                  <TBody>
                    {filteredParticipantes.map((p) => (
                      <Tr key={p.id} className="hover:bg-panel-2/40 transition-colors">
                        <Td>
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={p.nome} email={p.email} size={32} />
                            <div className="min-w-0"><p className="text-fg truncate max-w-[200px]">{p.nome || p.email.split('@')[0]}</p><p className="text-fg-3 text-xs truncate max-w-[200px]">{p.email}</p></div>
                          </div>
                        </Td>
                        <Td><Badge tone={ROLE_TONE[p.role]} dot>{ROLE_LABEL[p.role]}</Badge></Td>
                        <Td><Badge tone={STATUS_TONE[p.status]} dot>{statusLabel(p.status)}</Badge></Td>
                        <Td className="text-fg-2">{p.cursoTitulo ?? <span className="text-fg-3 text-xs">—</span>}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </TableWrap>
              </Card>
            )}
        </div>
      )}

      <TurmaEditModal open={editTurmaOpen} turma={turma} onClose={() => setEditTurmaOpen(false)} onDone={() => { setEditTurmaOpen(false); loadDashboard(); }} />
      <CursoModal open={createCursoOpen} curso={null} turmaId={turmaId!} onClose={() => setCreateCursoOpen(false)} onDone={() => { setCreateCursoOpen(false); loadCursos(); loadDashboard(); }} />
      <CursoModal open={!!editCurso} curso={editCurso} turmaId={turmaId!} onClose={() => setEditCurso(null)} onDone={() => { setEditCurso(null); loadCursos(); loadDashboard(); }} />
    </div>
  );
}

function InfoCard({ icon, label, value, sub, placeholder, placeholderText = 'Em breve' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; placeholder?: boolean; placeholderText?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2 text-fg-3">{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
      <p className={placeholder ? 'text-fg-3 italic text-sm' : 'text-fg text-sm font-medium'}>{placeholder ? placeholderText : value}</p>
      {!placeholder && sub && <p className="text-fg-3 text-xs mt-0.5">{sub}</p>}
    </Card>
  );
}

function TurmaEditModal({ open, turma, onClose, onDone }: { open: boolean; turma: Turma | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [tipoCobranca, setTipoCobranca] = useState<'' | TipoCobranca>('');
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNome(turma?.nome ?? ''); setCodigo(turma?.codigo ?? ''); setDescricao(turma?.descricao ?? ''); setObservacao(turma?.observacao ?? ''); setDataInicio(turma?.data_inicio ?? '');
    setCapaFile(null);
    setTipoCobranca(turma?.tipo_cobranca ?? ''); setValor(turma?.valor != null ? String(turma.valor) : ''); setErr(null);
  }, [turma, open]);

  const valorLabel = tipoCobranca === 'por_aluno' ? 'Valor por aluno (R$)' : tipoCobranca === 'recorrente_mensal' ? 'Valor mensal (R$)' : 'Valor (R$)';

  const submit = async () => {
    setErr(null);
    if (!nome.trim()) { setErr('Informe o nome da turma.'); return; }
    if (tipoCobranca && (valor === '' || isNaN(parseFloat(valor)))) { setErr('Informe um valor válido para a cobrança.'); return; }
    setLoading(true);
    let capa_url = turma?.capa_url ?? null;
    if (capaFile) {
      try { const up = await uploadCapa(capaFile, 'turmas'); capa_url = up.path; }
      catch (e) { setLoading(false); setErr((e as Error).message); return; }
    }
    // codigo/capa_url ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('turmas').update({
      nome: nome.trim(), codigo: codigo.trim() || null, descricao: descricao.trim(), observacao: observacao.trim() || null, data_inicio: dataInicio || null,
      capa_url, tipo_cobranca: tipoCobranca || null, valor: tipoCobranca ? parseFloat(valor) : null,
    }).eq('id', turma!.id);
    setLoading(false);
    if (error) setErr(error.message); else { toast.success('Turma atualizada.'); onDone(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar turma"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome" required htmlFor="td-nome"><Input id="td-nome" value={nome} onChange={(e) => setNome(e.target.value)} data-autofocus /></Field>
          <Field label="Código" hint="Ex.: T002" htmlFor="td-codigo"><Input id="td-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="T002" /></Field>
        </div>
        <Field label="Descrição" htmlFor="td-desc"><Textarea id="td-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></Field>
        <Field label="Observação interna" hint="Visível apenas para professores, monitores e administradores" htmlFor="td-obs"><Textarea id="td-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder="Notas internas da equipe sobre esta turma" /></Field>
        <Field label="Data de início" htmlFor="td-data"><Input id="td-data" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="max-w-[200px]" /></Field>
        <Field label="Capa" hint="Opcional — usada nas listas" htmlFor="td-capa">
          <div className="flex items-center gap-3">
            {(capaFile || turma?.capa_url) && (
              <div className="w-16 h-9 rounded-md bg-black overflow-hidden flex-shrink-0 border border-line">
                {capaFile ? <img src={URL.createObjectURL(capaFile)} className="w-full h-full object-cover" alt="" /> : <SignedImage bucket="capas" path={turma!.capa_url} className="w-full h-full object-cover" />}
              </div>
            )}
            <Input id="td-capa" type="file" accept="image/*" onChange={(e) => setCapaFile(e.target.files?.[0] ?? null)} className="!py-2" />
          </div>
        </Field>
        <div className="border-t border-line pt-4">
          <Field label="Tipo de cobrança" htmlFor="td-tipo">
            <Select id="td-tipo" value={tipoCobranca} onChange={(e) => setTipoCobranca(e.target.value as '' | TipoCobranca)}>
              <option value="">Não configurada</option>
              <option value="fixo">{TIPO_COBRANCA_LABEL.fixo}</option>
              <option value="por_aluno">{TIPO_COBRANCA_LABEL.por_aluno}</option>
              <option value="recorrente_mensal">{TIPO_COBRANCA_LABEL.recorrente_mensal}</option>
            </Select>
          </Field>
        </div>
        {tipoCobranca && <Field label={valorLabel} htmlFor="td-valor"><Input id="td-valor" type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="max-w-[200px]" /></Field>}
      </div>
    </Modal>
  );
}

function CursoModal({ open, curso, turmaId, onClose, onDone }: { open: boolean; curso: Curso | null; turmaId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [faixa, setFaixa] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setTitulo(curso?.titulo ?? ''); setDescricao(curso?.descricao ?? ''); setObservacao(curso?.observacao ?? ''); setFaixa(curso?.faixa ?? ''); setCapaFile(null); setErr(null); }, [curso, open]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Informe o título do curso.'); return; }
    setLoading(true);
    let capa_url = curso?.capa_url ?? null;
    if (capaFile) {
      try { const up = await uploadCapa(capaFile, 'cursos'); capa_url = up.path; }
      catch (e) { setLoading(false); setErr((e as Error).message); return; }
    }
    const payload = { titulo: titulo.trim(), descricao: descricao.trim(), observacao: observacao.trim() || null, capa_url, faixa: faixa || null };
    // capa_url ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    if (curso) {
      const { error } = await sb.from('cursos').update(payload).eq('id', curso.id);
      if (error) { setErr(error.message); setLoading(false); return; }
    } else {
      const { data, error } = await sb.from('cursos').insert(payload).select('id').maybeSingle();
      if (error || !data) { setErr(error?.message ?? 'Erro ao criar curso'); setLoading(false); return; }
      await supabase.from('curso_turmas').insert({ curso_id: data.id, turma_id: turmaId });
    }
    setLoading(false);
    toast.success(curso ? 'Curso atualizado.' : 'Curso criado.');
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={curso ? 'Editar curso' : 'Novo curso'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Título" required htmlFor="tdc-tit"><Input id="tdc-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} data-autofocus /></Field>
        <Field label="Descrição" htmlFor="tdc-desc"><Textarea id="tdc-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></Field>
        <Field label="Observação interna" hint="Visível apenas para professores, monitores e administradores" htmlFor="tdc-obs"><Textarea id="tdc-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder="Notas internas da equipe sobre este curso" /></Field>
        <Field label="Faixa" hint="Define a ordem fixa em que os blocos aparecem" htmlFor="tdc-faixa">
          <Select id="tdc-faixa" value={faixa} onChange={(e) => setFaixa(e.target.value)}>
            <option value="">Não definida</option>
            {FAIXA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Capa" hint="Opcional — usada nas listas" htmlFor="tdc-capa">
          <div className="flex items-center gap-3">
            {(capaFile || curso?.capa_url) && (
              <div className="w-16 h-9 rounded-md bg-black overflow-hidden flex-shrink-0 border border-line">
                {capaFile ? <img src={URL.createObjectURL(capaFile)} className="w-full h-full object-cover" alt="" /> : <SignedImage bucket="capas" path={curso!.capa_url} className="w-full h-full object-cover" />}
              </div>
            )}
            <Input id="tdc-capa" type="file" accept="image/*" onChange={(e) => setCapaFile(e.target.files?.[0] ?? null)} className="!py-2" />
          </div>
        </Field>
      </div>
    </Modal>
  );
}
