import { useEffect, useMemo, useState } from 'react';
import { Plus, Copy, Check, Trash2, RefreshCw, Pencil, Search, Users, X } from 'lucide-react';
import { supabase, callFn } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Badge, Modal, Empty, Toast } from '../../components/ui';

type Turma = { id: string; nome: string };
type Role = 'admin' | 'student' | 'professor' | 'monitor';
type UserRow = {
  id: string; email: string; role: Role; status: string;
  created_at: string; invite_token: string | null;
  turmas: { id: string; nome: string }[];
};

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador', student: 'Aluno', professor: 'Professor', monitor: 'Monitor',
};
const ROLE_TONE: Record<Role, 'success' | 'default' | 'warn'> = {
  admin: 'success', professor: 'warn', monitor: 'warn', student: 'default',
};

export default function AdminUsers() {
  const { profile: current } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterTurma, setFilterTurma] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<UserRow | null>(null);
  const [linkModal, setLinkModal] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'danger' | 'success' } | null>(null);
  const [copied, setCopied] = useState(false);

  const showToast = (msg: string, tone: 'danger' | 'success') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    const [{ data: ps }, { data: ts }, { data: uts }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('turmas').select('id,nome').order('nome'),
      supabase.from('user_turmas').select('user_id,turma_id'),
    ]);
    const turmasMap = new Map((ts ?? []).map((t) => [t.id, t]));
    const rows: UserRow[] = (ps ?? []).map((p: any) => ({
      ...p,
      turmas: [...new Map(
        (uts ?? [])
          .filter((r) => r.user_id === p.id)
          .map((r) => turmasMap.get(r.turma_id))
          .filter(Boolean)
          .map((t: any) => [t.id, t])
      ).values()] as Turma[],
    }));
    setUsers(rows);
    setTurmas(ts ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* ── Stats derivadas de TODOS os usuários (não filtrados) ── */
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    pending: users.filter((u) => u.status === 'pending').length,
    blocked: users.filter((u) => u.status === 'blocked').length,
  }), [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      if (filterRole && u.role !== filterRole) return false;
      if (filterTurma && !u.turmas.some((t) => t.id === filterTurma)) return false;
      return true;
    });
  }, [users, search, filterStatus, filterRole, filterTurma]);

  const hasFilters = !!(search || filterStatus || filterRole || filterTurma);

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterRole('');
    setFilterTurma('');
  };

  const showLink = (token: string) => {
    setLinkModal(`${window.location.origin}/ativar?token=${token}`);
  };

  const reinvite = async (u: UserRow) => {
    try {
      const r = await callFn('admin-users', 'reinvite', { user_id: u.id });
      showLink(r.invite_token);
      load();
    } catch (e) { showToast((e as Error).message, 'danger'); }
  };

  const del = async (u: UserRow) => {
    if (u.id === current?.id) { showToast('Você não pode excluir sua própria conta', 'danger'); return; }
    if (!confirm(`Excluir ${u.email}? Esta ação não pode ser desfeita.`)) return;
    try {
      await callFn('admin-users', 'delete', { user_id: u.id });
      showToast('Usuário excluído', 'success');
      load();
    } catch (e) { showToast((e as Error).message, 'danger'); }
  };

  const toggleBlock = async (u: UserRow) => {
    const newStatus = u.status === 'blocked' ? 'active' : 'blocked';
    try {
      await callFn('admin-users', 'update', { user_id: u.id, status: newStatus });
      load();
    } catch (e) { showToast((e as Error).message, 'danger'); }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Configuração dos cards de stats ── */
  const STAT_CARDS = [
    { label: 'Total',      value: stats.total,   filterValue: '',        valueClass: 'text-white' },
    { label: 'Ativos',     value: stats.active,  filterValue: 'active',  valueClass: 'text-[#cbfb00]' },
    { label: 'Pendentes',  value: stats.pending, filterValue: 'pending', valueClass: 'text-yellow-400' },
    { label: 'Bloqueados', value: stats.blocked, filterValue: 'blocked', valueClass: 'text-red-400' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Usuários</h1>
          <p className="meta mt-1">Gerencie administradores, professores e alunos</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Novo usuário
        </Button>
      </div>

      {/* ── Cards de resumo ── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {STAT_CARDS.map((card) => {
            const isSelected = card.filterValue !== '' && filterStatus === card.filterValue;
            return (
              <button
                key={card.label}
                onClick={() => {
                  if (card.filterValue === '') {
                    setFilterStatus('');
                  } else {
                    setFilterStatus(isSelected ? '' : card.filterValue);
                  }
                }}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-[#cbfb00]/5 border-[#cbfb00]/40'
                    : 'bg-[#0d0d0d] border-[#1c1f26] hover:border-[#434d5e]'
                }`}
              >
                <p className={`text-2xl font-bold mb-1 ${card.valueClass}`}>{card.value}</p>
                <p className="text-[#8b929e] text-xs font-medium uppercase tracking-wider">{card.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Barra de filtros ── */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#434d5e]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar email..."
              className="!pl-9"
            />
          </div>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="max-w-[180px]">
            <option value="">Todos os papéis</option>
            <option value="admin">Administrador</option>
            <option value="professor">Professor</option>
            <option value="monitor">Monitor</option>
            <option value="student">Aluno</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="max-w-[180px]">
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="active">Ativo</option>
            <option value="blocked">Bloqueado</option>
          </select>
          <select value={filterTurma} onChange={(e) => setFilterTurma(e.target.value)} className="max-w-[220px]">
            <option value="">Todas as turmas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs text-[#8b929e] hover:text-[#d6deed] transition-colors whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        {hasFilters && !loading && (
          <p className="text-xs text-[#8b929e] mt-3 border-t border-[#1c1f26] pt-3">
            Mostrando{' '}
            <span className="text-white font-medium">{filtered.length}</span>
            {' '}de{' '}
            <span className="text-white font-medium">{users.length}</span>
            {' '}usuários
          </p>
        )}
      </Card>

      {/* ── Conteúdo principal ── */}
      {loading ? (
        <Card className="p-10 text-center">
          <p className="meta">Carregando usuários...</p>
        </Card>
      ) : filtered.length === 0 ? (
        hasFilters ? (
          <Empty
            icon={<Search className="w-8 h-8" />}
            title="Nenhum resultado para este filtro"
            description="Tente ajustar a busca ou clique em 'Limpar filtros'"
          />
        ) : (
          <Empty
            icon={<Users className="w-8 h-8" />}
            title="Nenhum usuário cadastrado"
            description="Clique em 'Novo usuário' para convidar alunos, professores ou administradores"
          />
        )
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1c1f26] text-left">
                <th className="px-4 py-3 font-medium text-[#d6deed]">Email</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Papel</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Status</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Turmas</th>
                <th className="px-4 py-3 font-medium text-[#d6deed] hidden md:table-cell">Cadastro</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-[#1c1f26] last:border-0 hover:bg-[#111] transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-white block truncate max-w-[200px]">{u.email}</span>
                    {u.id === current?.id && (
                      <span className="text-[#8b929e] text-xs">você</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.status === 'active'  && <Badge tone="success">Ativo</Badge>}
                    {u.status === 'pending' && <Badge tone="warn">Pendente</Badge>}
                    {u.status === 'blocked' && <Badge tone="danger">Bloqueado</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.turmas.length === 0
                        ? <span className="text-[#434d5e] text-xs">—</span>
                        : u.turmas.map((t) => <Badge key={t.id}>{t.nome}</Badge>)
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[#8b929e] text-xs">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {u.status === 'pending' && u.invite_token && (
                        <Button variant="ghost" onClick={() => showLink(u.invite_token!)} icon={<Copy className="w-4 h-4" />}>
                          Link
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => reinvite(u)} icon={<RefreshCw className="w-4 h-4" />}>
                        Reenviar
                      </Button>
                      <Button variant="ghost" onClick={() => setEditOpen(u)} icon={<Pencil className="w-4 h-4" />}>
                        Editar
                      </Button>
                      {u.id !== current?.id && (
                        <>
                          <Button variant="ghost" onClick={() => toggleBlock(u)}>
                            {u.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                          </Button>
                          <Button variant="danger" onClick={() => del(u)} icon={<Trash2 className="w-4 h-4" />} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Modais ── */}
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        turmas={turmas}
        onDone={(token) => { setCreateOpen(false); showLink(token); load(); }}
        onBulkDone={(ok, total) => {
          setCreateOpen(false);
          load();
          showToast(`${ok} de ${total} convites enviados`, ok === total ? 'success' : 'danger');
        }}
      />
      <EditUserModal
        user={editOpen}
        currentId={current?.id}
        onClose={() => setEditOpen(null)}
        turmas={turmas}
        onDone={() => { setEditOpen(null); load(); }}
      />

      <Modal
        open={!!linkModal}
        onClose={() => setLinkModal(null)}
        title="Link de ativação"
        footer={<Button variant="secondary" onClick={() => setLinkModal(null)}>Fechar</Button>}
      >
        <p className="mb-3">Copie e envie este link ao usuário. Válido por 7 dias.</p>
        <div className="border border-[#1c1f26] bg-black rounded-md p-3 text-sm text-[#cbfb00] break-all">
          {linkModal}
        </div>
        <Button
          variant="primary"
          className="mt-4"
          onClick={() => linkModal && copy(linkModal)}
          icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        >
          {copied ? 'Copiado' : 'Copiar link'}
        </Button>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Tipos compartilhados dos modais                                */
/* ─────────────────────────────────────────────────────────────── */
type CursoInfo = { id: string; titulo: string };
type TurmaSelection = { turma_id: string; curso_ids: string[] };
type BulkResult = { email: string; ok: boolean; err?: string };

async function loadCoursesByTurma(): Promise<Record<string, CursoInfo[]>> {
  const [{ data: cts }, { data: cs }] = await Promise.all([
    supabase.from('curso_turmas').select('turma_id,curso_id'),
    supabase.from('cursos').select('id,titulo'),
  ]);
  const cursoMap = new Map((cs ?? []).map((c) => [c.id, c]));
  const byTurma: Record<string, CursoInfo[]> = {};
  (cts ?? []).forEach((ct) => {
    const curso = cursoMap.get(ct.curso_id);
    if (!curso) return;
    if (!byTurma[ct.turma_id]) byTurma[ct.turma_id] = [];
    byTurma[ct.turma_id].push(curso);
  });
  return byTurma;
}

function parseEmails(text: string): string[] {
  return [...new Set(
    text.split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  )];
}

/* ─────────────────────────────────────────────────────────────── */
/*  TurmaCoursePicker — seletor aninhado Turma > Cursos           */
/* ─────────────────────────────────────────────────────────────── */
function TurmaCoursePicker({
  turmas, coursesByTurma, value, onChange, showCourses,
}: {
  turmas: Turma[];
  coursesByTurma: Record<string, CursoInfo[]>;
  value: TurmaSelection[];
  onChange: (v: TurmaSelection[]) => void;
  showCourses: boolean;
}) {
  const isTurmaSelected = (tid: string) => value.some((v) => v.turma_id === tid);
  const getCursoIds = (tid: string) => value.find((v) => v.turma_id === tid)?.curso_ids ?? [];

  const toggleTurma = (tid: string) => {
    if (isTurmaSelected(tid)) {
      onChange(value.filter((v) => v.turma_id !== tid));
    } else {
      onChange([...value, { turma_id: tid, curso_ids: [] }]);
    }
  };

  const toggleCurso = (tid: string, cid: string) => {
    onChange(value.map((v) => {
      if (v.turma_id !== tid) return v;
      const curso_ids = v.curso_ids.includes(cid)
        ? v.curso_ids.filter((c) => c !== cid)
        : [...v.curso_ids, cid];
      return { ...v, curso_ids };
    }));
  };

  if (turmas.length === 0) return <p className="meta">Nenhuma turma criada ainda</p>;

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto border border-[#1c1f26] rounded-md p-3">
      {turmas.map((t) => {
        const selected = isTurmaSelected(t.id);
        const courses = coursesByTurma[t.id] ?? [];
        const selectedCursoIds = getCursoIds(t.id);
        const missingCourse = showCourses && selected && selectedCursoIds.length === 0;

        return (
          <div key={t.id}>
            <label className="flex items-center gap-2 cursor-pointer !mb-0">
              <input type="checkbox" checked={selected} onChange={() => toggleTurma(t.id)} className="!w-4 !h-4" />
              <span className="text-white text-sm font-medium">{t.nome}</span>
              {missingCourse && (
                <span className="text-red-400 text-xs">selecione ao menos 1 curso</span>
              )}
            </label>

            {selected && showCourses && (
              <div className="ml-6 mt-2 space-y-1.5 pb-1">
                {courses.length === 0 ? (
                  <p className="text-[#434d5e] text-xs italic">Nenhum curso nesta turma</p>
                ) : courses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer !mb-0">
                    <input
                      type="checkbox"
                      checked={selectedCursoIds.includes(c.id)}
                      onChange={() => toggleCurso(t.id, c.id)}
                      className="!w-3.5 !h-3.5"
                    />
                    <span className="text-[#d6deed] text-xs">{c.titulo}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Modal: Criar usuário                                           */
/* ─────────────────────────────────────────────────────────────── */
function CreateUserModal({
  open, onClose, turmas, onDone, onBulkDone,
}: {
  open: boolean;
  onClose: () => void;
  turmas: Turma[];
  onDone: (token: string) => void;
  onBulkDone: (ok: number, total: number) => void;
}) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  /* single */
  const [email, setEmail] = useState('');
  const [selection, setSelection] = useState<TurmaSelection[]>([]);
  const [coursesByTurma, setCoursesByTurma] = useState<Record<string, CursoInfo[]>>({});

  /* bulk */
  const [bulkText, setBulkText]         = useState('');
  const [bulkResults, setBulkResults]   = useState<BulkResult[]>([]);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal]       = useState(0);

  /* common */
  const [role, setRole]     = useState<Role>('student');
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode('single'); setEmail(''); setBulkText('');
      setBulkResults([]); setBulkProgress(0); setBulkTotal(0);
      setRole('student'); setSelection([]); setErr(null);
      loadCoursesByTurma().then(setCoursesByTurma);
    }
  }, [open]);

  const isStudent = role === 'student';

  const submitSingle = async () => {
    setErr(null);
    if (!email.trim()) { setErr('Email obrigatório'); return; }
    if (isStudent) {
      if (selection.length === 0) { setErr('Selecione ao menos uma turma'); return; }
      if (selection.some((s) => s.curso_ids.length === 0)) {
        setErr('Selecione ao menos um curso para cada turma escolhida'); return;
      }
    }
    setLoading(true);
    try {
      const payload = isStudent
        ? { email: email.trim(), role, turma_cursos: selection.flatMap((s) => s.curso_ids.map((cid) => ({ turma_id: s.turma_id, curso_id: cid }))) }
        : { email: email.trim(), role, turma_ids: selection.map((s) => s.turma_id) };
      const r = await callFn('admin-users', 'create', payload);
      onDone(r.invite_token);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitBulk = async () => {
    const emails = parseEmails(bulkText);
    if (emails.length === 0) { setErr('Nenhum email válido encontrado'); return; }
    if (isStudent) {
      if (selection.length === 0) { setErr('Selecione ao menos uma turma'); return; }
      if (selection.some((s) => s.curso_ids.length === 0)) {
        setErr('Selecione ao menos um curso para cada turma escolhida'); return;
      }
    }
    setErr(null);
    setLoading(true);
    setBulkTotal(emails.length);
    setBulkProgress(0);
    const results: BulkResult[] = [];
    for (let i = 0; i < emails.length; i++) {
      try {
        const payload = isStudent
          ? { email: emails[i], role, turma_cursos: selection.flatMap((s) => s.curso_ids.map((cid) => ({ turma_id: s.turma_id, curso_id: cid }))) }
          : { email: emails[i], role, turma_ids: selection.map((s) => s.turma_id) };
        await callFn('admin-users', 'create', payload);
        results.push({ email: emails[i], ok: true });
      } catch (e) {
        results.push({ email: emails[i], ok: false, err: (e as Error).message });
      }
      setBulkProgress(i + 1);
      setBulkResults([...results]);
    }
    setLoading(false);
  };

  const bulkDone   = bulkResults.length > 0 && !loading;
  const bulkOk     = bulkResults.filter((r) => r.ok).length;
  const emailCount = parseEmails(bulkText).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convidar usuário"
      footer={
        bulkDone ? (
          <Button variant="primary" onClick={() => onBulkDone(bulkOk, bulkResults.length)}>
            Concluir
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button
              variant="primary"
              loading={loading}
              onClick={mode === 'single' ? submitSingle : submitBulk}
            >
              {mode === 'single'
                ? 'Criar e gerar link'
                : `Convidar${emailCount > 0 ? ` ${emailCount}` : ''}`
              }
            </Button>
          </>
        )
      }
    >
      {/* Tabs */}
      <div className="flex rounded-md border border-[#1c1f26] mb-4 overflow-hidden">
        {(['single', 'bulk'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setErr(null); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors
              ${mode === m ? 'bg-[#cbfb00] text-black' : 'text-[#d6deed] hover:bg-[#434d5e]/20'}`}
          >
            {m === 'single' ? 'Individual' : 'Em lote'}
          </button>
        ))}
      </div>

      {/* Bulk results */}
      {bulkDone ? (
        <div>
          <div className={`p-3 rounded-md mb-3 text-sm font-medium ${
            bulkOk === bulkResults.length
              ? 'bg-[#cbfb00]/10 text-[#cbfb00] border border-[#cbfb00]/30'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          }`}>
            {bulkOk} de {bulkResults.length} convites enviados com sucesso
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {bulkResults.map((r) => (
              <div
                key={r.email}
                className={`flex items-center justify-between text-xs p-2 rounded ${
                  r.ok ? 'text-[#d6deed]' : 'text-red-400 bg-red-500/5'
                }`}
              >
                <span className="truncate">{r.email}</span>
                <span className="ml-2 flex-shrink-0">{r.ok ? '✓' : r.err ?? 'Erro'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {mode === 'single' ? (
            <div>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          ) : (
            <div>
              <label>Emails (um por linha)</label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={5}
                placeholder={"aluno1@exemplo.com\naluno2@exemplo.com\naluno3@exemplo.com"}
                className="w-full resize-none"
              />
              {emailCount > 0 && !loading && (
                <p className="text-xs text-[#8b929e] mt-1">{emailCount} email(s) válido(s)</p>
              )}
              {loading && bulkTotal > 0 && (
                <p className="text-xs text-[#cbfb00] mt-1">
                  Enviando... {bulkProgress}/{bulkTotal}
                </p>
              )}
            </div>
          )}

          <div>
            <label>Papel</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="student">Aluno</option>
              <option value="professor">Professor</option>
              <option value="monitor">Monitor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div>
            <label>{isStudent ? 'Turmas e cursos' : 'Turmas'}</label>
            <TurmaCoursePicker
              turmas={turmas}
              coursesByTurma={coursesByTurma}
              value={selection}
              onChange={setSelection}
              showCourses={isStudent}
            />
            {isStudent && (
              <p className="text-[#434d5e] text-xs mt-1.5">O aluno terá acesso somente aos cursos selecionados.</p>
            )}
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Modal: Editar usuário                                          */
/* ─────────────────────────────────────────────────────────────── */
function EditUserModal({
  user, currentId, onClose, turmas, onDone,
}: {
  user: UserRow | null;
  currentId?: string;
  onClose: () => void;
  turmas: Turma[];
  onDone: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [selection, setSelection] = useState<TurmaSelection[]>([]);
  const [coursesByTurma, setCoursesByTurma] = useState<Record<string, CursoInfo[]>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email);
    setRole(user.role);
    setErr(null);

    (async () => {
      const [byTurma, { data: ut }] = await Promise.all([
        loadCoursesByTurma(),
        supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', user.id),
      ]);
      setCoursesByTurma(byTurma);

      const grouped: Record<string, string[]> = {};
      (ut ?? []).forEach((row: any) => {
        if (!grouped[row.turma_id]) grouped[row.turma_id] = [];
        if (row.curso_id) grouped[row.turma_id].push(row.curso_id);
      });
      setSelection(Object.entries(grouped).map(([turma_id, curso_ids]) => ({ turma_id, curso_ids })));
    })();
  }, [user]);

  if (!user) return null;
  const isSelf = user.id === currentId;
  const isStudent = role === 'student';

  const submit = async () => {
    setErr(null);
    if (isStudent) {
      if (selection.length === 0) { setErr('Selecione ao menos uma turma'); return; }
      if (selection.some((s) => s.curso_ids.length === 0)) {
        setErr('Selecione ao menos um curso para cada turma escolhida'); return;
      }
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        email: email !== user.email ? email : undefined,
        role: role !== user.role ? role : undefined,
      };
      if (isStudent) {
        payload.turma_cursos = selection.flatMap((s) =>
          s.curso_ids.map((cid) => ({ turma_id: s.turma_id, curso_id: cid }))
        );
      } else {
        payload.turma_ids = selection.map((s) => s.turma_id);
      }
      await callFn('admin-users', 'update', payload);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title="Editar usuário"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label>Papel</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
            <option value="student">Aluno</option>
            <option value="professor">Professor</option>
            <option value="monitor">Monitor</option>
            <option value="admin">Administrador</option>
          </select>
          {isSelf && <p className="meta mt-1">Você não pode alterar seu próprio papel</p>}
        </div>
        <div>
          <label>{isStudent ? 'Turmas e cursos' : 'Turmas'}</label>
          <TurmaCoursePicker
            turmas={turmas}
            coursesByTurma={coursesByTurma}
            value={selection}
            onChange={setSelection}
            showCourses={isStudent}
          />
          {isStudent && (
            <p className="text-[#434d5e] text-xs mt-1.5">O aluno terá acesso somente aos cursos selecionados.</p>
          )}
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
