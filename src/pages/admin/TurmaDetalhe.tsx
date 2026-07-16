import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Pencil, Trash2, PlayCircle, Users, BookOpen, GraduationCap, Calendar, Building2, DollarSign, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Modal, Empty, Toast, Badge } from '../../components/ui';
import { TipoCobranca, TIPO_COBRANCA_LABEL, describeCobranca } from '../../lib/financeiro';

type Turma = {
  id: string; nome: string; descricao: string | null; data_inicio: string | null; created_at: string | null;
  tipo_cobranca: TipoCobranca | null; valor: number | null;
};
type Curso = { id: string; titulo: string; descricao: string | null };
type Tab = 'dashboard' | 'cursos' | 'participantes';
type ParticipanteRole = 'student' | 'professor' | 'monitor' | 'admin';
type Participante = {
  id: string;
  email: string;
  nome: string | null;
  role: ParticipanteRole;
  status: string;
  cursoTitulo: string | null;
};

const ROLE_LABEL: Record<ParticipanteRole, string> = {
  student: 'Aluno', professor: 'Professor', monitor: 'Monitor', admin: 'Admin',
};
const ROLE_TONE: Record<ParticipanteRole, 'default' | 'warn' | 'success'> = {
  student: 'default', professor: 'warn', monitor: 'success', admin: 'default',
};

function dateOnlyBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export default function TurmaDetalhe() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [turma, setTurma] = useState<Turma | null>(null);
  const [editTurmaOpen, setEditTurmaOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Dashboard
  const [dashLoading, setDashLoading] = useState(true);
  const [alunosCount, setAlunosCount] = useState(0);
  const [professoresCount, setProfessoresCount] = useState(0);
  const [cursosCount, setCursosCount] = useState(0);
  const [aulasPerCurso, setAulasPerCurso] = useState<{ titulo: string; count: number }[]>([]);

  // Cursos tab
  const [cursosLoading, setCursosLoading] = useState(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [aulaCounts, setAulaCounts] = useState<Record<string, number>>({});
  const [createCursoOpen, setCreateCursoOpen] = useState(false);
  const [editCurso, setEditCurso] = useState<Curso | null>(null);

  // Participantes tab
  const [participantesLoading, setParticipantesLoading] = useState(false);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'' | ParticipanteRole>('');

  const loadDashboard = async () => {
    setDashLoading(true);
    const { data: t } = await supabase.from('turmas').select('*').eq('id', turmaId!).maybeSingle();
    setTurma(t as Turma | null);

    // Usuários da turma por role
    const { data: utData } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!);
    const userIds = (utData ?? []).map((r) => r.user_id);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id,role').in('id', userIds);
      setAlunosCount((profiles ?? []).filter((p) => p.role === 'student').length);
      setProfessoresCount((profiles ?? []).filter((p) => p.role === 'professor').length);
    } else {
      setAlunosCount(0);
      setProfessoresCount(0);
    }

    // Cursos e aulas
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
    } else {
      setAulasPerCurso([]);
    }

    setDashLoading(false);
  };

  const loadCursos = async () => {
    setCursosLoading(true);
    const { data: cts } = await supabase.from('curso_turmas').select('curso_id').eq('turma_id', turmaId!);
    const cursoIds = (cts ?? []).map((r) => r.curso_id);
    if (cursoIds.length > 0) {
      const [{ data: cs }, { data: as }] = await Promise.all([
        supabase.from('cursos').select('*').in('id', cursoIds).order('created_at', { ascending: false }),
        supabase.from('aulas').select('curso_id').in('curso_id', cursoIds),
      ]);
      setCursos(cs ?? []);
      const counts: Record<string, number> = {};
      (as ?? []).forEach((a) => { counts[a.curso_id] = (counts[a.curso_id] ?? 0) + 1; });
      setAulaCounts(counts);
    } else {
      setCursos([]);
      setAulaCounts({});
    }
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
    (uts ?? []).forEach((r) => {
      if (r.curso_id && !cursoPorUser.has(r.user_id)) cursoPorUser.set(r.user_id, cursoMap.get(r.curso_id) ?? null);
    });

    const rows: Participante[] = (profiles ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      nome: p.nome,
      role: p.role,
      status: p.status,
      cursoTitulo: cursoPorUser.get(p.id) ?? null,
    })).sort((a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email));

    setParticipantes(rows);
    setParticipantesLoading(false);
  };

  useEffect(() => { loadDashboard(); }, [turmaId]);
  useEffect(() => { if (tab === 'cursos') loadCursos(); }, [tab, turmaId]);
  useEffect(() => { if (tab === 'participantes') loadParticipantes(); }, [tab, turmaId]);

  const delCurso = async (e: React.MouseEvent, c: Curso) => {
    e.stopPropagation();
    if (!confirm(`Excluir curso "${c.titulo}"? Todas as aulas serão removidas.`)) return;
    const { error } = await supabase.from('cursos').delete().eq('id', c.id);
    if (error) setToast(error.message);
    else { setToast('Curso excluído'); loadCursos(); loadDashboard(); }
  };

  const delTurma = async () => {
    if (!confirm(`Excluir turma "${turma?.nome}"? Os vínculos com alunos e cursos serão removidos.`)) return;
    const { error } = await supabase.from('turmas').delete().eq('id', turmaId!);
    if (error) setToast(error.message);
    else nav('/admin/turmas');
  };

  const totalAulas = aulasPerCurso.reduce((s, c) => s + c.count, 0);

  const filteredParticipantes = participantes.filter((p) => {
    if (search && !p.email.toLowerCase().includes(search.toLowerCase()) && !(p.nome ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && p.role !== filterRole) return false;
    return true;
  });
  const hasFilters = !!(search || filterRole);
  const clearFilters = () => { setSearch(''); setFilterRole(''); };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#d6deed] mb-6">
        <button onClick={() => nav('/admin/turmas')} className="hover:text-white transition-colors">Turmas</button>
        <ChevronRight className="w-4 h-4 text-[#434d5e]" />
        <span className="text-white">{turma?.nome ?? '...'}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1>{turma?.nome ?? '...'}</h1>
          <p className="meta mt-1">{turma?.descricao || '—'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditTurmaOpen(true)}>Editar</Button>
          <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={delTurma}>Excluir</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1c1f26]">
        {([
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'cursos', label: 'Cursos' },
          { key: 'participantes', label: 'Participantes' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-[#cbfb00] text-[#cbfb00]'
                : 'border-transparent text-[#d6deed] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        dashLoading ? <p className="meta">Carregando...</p> : (
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Users className="w-5 h-5 text-[#cbfb00]" />} label="Alunos" value={alunosCount} />
              <StatCard icon={<GraduationCap className="w-5 h-5 text-[#cbfb00]" />} label="Professores" value={professoresCount} />
              <StatCard icon={<BookOpen className="w-5 h-5 text-[#cbfb00]" />} label="Cursos" value={cursosCount} />
              <StatCard icon={<PlayCircle className="w-5 h-5 text-[#cbfb00]" />} label="Aulas (total)" value={totalAulas} />
            </div>

            {/* Info cards */}
            {(() => {
              const cobranca = describeCobranca(turma?.tipo_cobranca, turma?.valor, alunosCount);
              return (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoCard icon={<Calendar className="w-4 h-4" />} label="Início da turma" value={dateOnlyBR(turma?.data_inicio ?? null)} />
                  <InfoCard icon={<Calendar className="w-4 h-4" />} label="Data de criação" value={turma?.created_at ? new Date(turma.created_at).toLocaleDateString('pt-BR') : '—'} />
                  <InfoCard icon={<Building2 className="w-4 h-4" />} label="Empresa associada" value="—" placeholder />
                  <InfoCard
                    icon={<DollarSign className="w-4 h-4" />}
                    label="Cobrança"
                    value={cobranca.total}
                    sub={cobranca.detalhe ?? undefined}
                    placeholder={!turma?.tipo_cobranca}
                    placeholderText="Não configurada"
                  />
                </div>
              );
            })()}

            {/* Aulas por curso */}
            {aulasPerCurso.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-[#d6deed] uppercase tracking-wider">Aulas por curso</h3>
                <Card>
                  <ul>
                    {aulasPerCurso.map((item, i) => (
                      <li key={i} className="flex items-center justify-between px-4 py-3 border-b border-[#1c1f26] last:border-0">
                        <span className="text-white text-sm">{item.titulo}</span>
                        <Badge>{item.count} aula{item.count !== 1 ? 's' : ''}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        )
      )}

      {/* ── CURSOS ── */}
      {tab === 'cursos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="meta">Cursos exclusivos desta turma</p>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateCursoOpen(true)}>Novo curso</Button>
          </div>

          {cursosLoading ? <p className="meta">Carregando...</p> :
            cursos.length === 0 ? <Empty title="Nenhum curso nesta turma" description="Crie o primeiro curso para esta turma" /> : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cursos.map((c) => (
                  <Card
                    key={c.id}
                    className="p-5 cursor-pointer hover:border-[#434d5e] transition-colors relative"
                    onClick={() => nav(`/admin/turmas/${turmaId}/cursos/${c.id}`)}
                  >
                    {/* Ícones de ação */}
                    <div className="absolute top-4 right-4 flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditCurso(c); }}
                        className="p-1.5 rounded text-[#d6deed] hover:bg-[#434d5e]/30 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => delCurso(e, c)}
                        className="p-1.5 rounded text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="mb-1 pr-16">{c.titulo}</h3>
                    <p className="text-sm mb-4 line-clamp-2 min-h-[40px]">{c.descricao || '—'}</p>
                    <div className="flex items-center gap-1 text-sm text-[#d6deed]">
                      <PlayCircle className="w-4 h-4 text-[#434d5e]" /> {aulaCounts[c.id] ?? 0} aulas
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ── PARTICIPANTES ── */}
      {tab === 'participantes' && (
        <div>
          <Card className="p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#434d5e]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nome ou email..."
                  className="!pl-9"
                />
              </div>
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as '' | ParticipanteRole)} className="max-w-[180px]">
                <option value="">Todos os papéis</option>
                <option value="student">Aluno</option>
                <option value="professor">Professor</option>
                <option value="monitor">Monitor</option>
                <option value="admin">Admin</option>
              </select>
              {hasFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-[#8b929e] hover:text-[#d6deed] transition-colors whitespace-nowrap">
                  <X className="w-3.5 h-3.5" /> Limpar filtros
                </button>
              )}
            </div>
            {hasFilters && !participantesLoading && (
              <p className="text-xs text-[#8b929e] mt-3 border-t border-[#1c1f26] pt-3">
                Mostrando <span className="text-white font-medium">{filteredParticipantes.length}</span> de{' '}
                <span className="text-white font-medium">{participantes.length}</span> participantes
              </p>
            )}
          </Card>

          {participantesLoading ? (
            <Card className="p-10 text-center"><p className="meta">Carregando...</p></Card>
          ) : filteredParticipantes.length === 0 ? (
            hasFilters ? (
              <Empty icon={<Search className="w-8 h-8" />} title="Nenhum resultado para este filtro" description="Tente ajustar a busca ou clique em 'Limpar filtros'" />
            ) : (
              <Empty icon={<Users className="w-8 h-8" />} title="Nenhum participante nesta turma" description="Vincule alunos, professores ou monitores em Usuários" />
            )
          ) : (
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1c1f26] text-left">
                    <th className="px-4 py-3 font-medium text-[#d6deed]">Nome</th>
                    <th className="px-4 py-3 font-medium text-[#d6deed]">Papel</th>
                    <th className="px-4 py-3 font-medium text-[#d6deed]">Status</th>
                    <th className="px-4 py-3 font-medium text-[#d6deed]">Curso vinculado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipantes.map((p) => (
                    <tr key={p.id} className="border-b border-[#1c1f26] last:border-0 hover:bg-[#111] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-white block truncate max-w-[220px]">{p.nome || p.email}</span>
                        {p.nome && <span className="text-[#8b929e] text-xs">{p.email}</span>}
                      </td>
                      <td className="px-4 py-3"><Badge tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Badge></td>
                      <td className="px-4 py-3">
                        {p.status === 'active'  && <Badge tone="success">Ativo</Badge>}
                        {p.status === 'pending' && <Badge tone="warn">Pendente</Badge>}
                        {p.status === 'blocked' && <Badge tone="danger">Bloqueado</Badge>}
                      </td>
                      <td className="px-4 py-3 text-[#d6deed]">{p.cursoTitulo ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* Modais */}
      <TurmaEditModal
        open={editTurmaOpen}
        turma={turma}
        onClose={() => setEditTurmaOpen(false)}
        onDone={() => { setEditTurmaOpen(false); loadDashboard(); }}
      />
      <CursoModal
        open={createCursoOpen}
        curso={null}
        turmaId={turmaId!}
        onClose={() => setCreateCursoOpen(false)}
        onDone={() => { setCreateCursoOpen(false); loadCursos(); loadDashboard(); }}
      />
      <CursoModal
        open={!!editCurso}
        curso={editCurso}
        turmaId={turmaId!}
        onClose={() => setEditCurso(null)}
        onDone={() => { setEditCurso(null); loadCursos(); loadDashboard(); }}
      />
      <Toast message={toast} />
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-[#cbfb00]/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-[#d6deed]">{label}</p>
      </div>
    </Card>
  );
}

function InfoCard({ icon, label, value, sub, placeholder, placeholderText = 'Em breve' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; placeholder?: boolean; placeholderText?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2 text-[#434d5e]">{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
      <p className={`text-sm font-medium ${placeholder ? 'text-[#434d5e] italic' : 'text-white'}`}>
        {placeholder ? placeholderText : value}
      </p>
      {!placeholder && sub && <p className="text-xs text-[#8b929e] mt-0.5">{sub}</p>}
    </Card>
  );
}

function TurmaEditModal({ open, turma, onClose, onDone }: { open: boolean; turma: Turma | null; onClose: () => void; onDone: () => void }) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [tipoCobranca, setTipoCobranca] = useState<'' | TipoCobranca>('');
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNome(turma?.nome ?? '');
    setDescricao(turma?.descricao ?? '');
    setDataInicio(turma?.data_inicio ?? '');
    setTipoCobranca(turma?.tipo_cobranca ?? '');
    setValor(turma?.valor != null ? String(turma.valor) : '');
    setErr(null);
  }, [turma, open]);

  const valorLabel =
    tipoCobranca === 'por_aluno' ? 'Valor por aluno (R$)'
    : tipoCobranca === 'recorrente_mensal' ? 'Valor mensal (R$)'
    : 'Valor (R$)';

  const submit = async () => {
    setErr(null);
    if (!nome.trim()) { setErr('Nome obrigatório'); return; }
    if (tipoCobranca && (valor === '' || isNaN(parseFloat(valor)))) {
      setErr('Informe um valor válido para a cobrança'); return;
    }
    setLoading(true);
    const { error } = await supabase.from('turmas').update({
      nome: nome.trim(),
      descricao: descricao.trim(),
      data_inicio: dataInicio || null,
      tipo_cobranca: tipoCobranca || null,
      valor: tipoCobranca ? parseFloat(valor) : null,
    }).eq('id', turma!.id);
    setLoading(false);
    if (error) setErr(error.message);
    else onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar turma"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Salvar</Button>
        </>
      }>
      <div className="space-y-4">
        <div><label>Nome</label><input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><label>Descrição</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></div>
        <div><label>Data de início</label><input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
        <div className="border-t border-[#1c1f26] pt-4">
          <label>Tipo de cobrança</label>
          <select value={tipoCobranca} onChange={(e) => setTipoCobranca(e.target.value as '' | TipoCobranca)}>
            <option value="">Não configurada</option>
            <option value="fixo">{TIPO_COBRANCA_LABEL.fixo}</option>
            <option value="por_aluno">{TIPO_COBRANCA_LABEL.por_aluno}</option>
            <option value="recorrente_mensal">{TIPO_COBRANCA_LABEL.recorrente_mensal}</option>
          </select>
        </div>
        {tipoCobranca && (
          <div>
            <label>{valorLabel}</label>
            <input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
        )}
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}

function CursoModal({ open, curso, turmaId, onClose, onDone }: {
  open: boolean; curso: Curso | null; turmaId: string; onClose: () => void; onDone: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitulo(curso?.titulo ?? '');
    setDescricao(curso?.descricao ?? '');
    setErr(null);
  }, [curso, open]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Título obrigatório'); return; }
    setLoading(true);
    const payload = { titulo: titulo.trim(), descricao: descricao.trim() };
    if (curso) {
      const { error } = await supabase.from('cursos').update(payload).eq('id', curso.id);
      if (error) { setErr(error.message); setLoading(false); return; }
    } else {
      const { data, error } = await supabase.from('cursos').insert(payload).select('id').maybeSingle();
      if (error || !data) { setErr(error?.message ?? 'Erro ao criar curso'); setLoading(false); return; }
      await supabase.from('curso_turmas').insert({ curso_id: data.id, turma_id: turmaId });
    }
    setLoading(false);
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={curso ? 'Editar curso' : 'Novo curso'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Salvar</Button>
        </>
      }>
      <div className="space-y-4">
        <div><label>Título</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label>Descrição</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
