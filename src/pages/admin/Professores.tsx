import { useEffect, useMemo, useState } from 'react';
import { Plus, Copy, Check, Trash2, RefreshCw, Pencil, Search, GraduationCap, X } from 'lucide-react';
import { supabase, callFn } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Badge, Modal, Empty, Toast } from '../../components/ui';

type Turma = { id: string; nome: string };
type StaffRole = 'professor' | 'monitor';
type StaffRow = {
  id: string; email: string; role: StaffRole; status: string;
  created_at: string; invite_token: string | null;
  turmas: { id: string; nome: string }[];
};

const ROLE_LABEL: Record<StaffRole, string> = { professor: 'Professor', monitor: 'Monitor' };
const ROLE_TONE: Record<StaffRole, 'warn' | 'default'> = { professor: 'warn', monitor: 'default' };

export default function AdminProfessores() {
  const { profile: current } = useAuth();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'' | StaffRole>('');
  const [filterTurma, setFilterTurma] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<StaffRow | null>(null);
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
      supabase
        .from('profiles')
        .select('*')
        .in('role', ['professor', 'monitor'])
        .order('created_at', { ascending: false }),
      supabase.from('turmas').select('id,nome').order('nome'),
      supabase.from('user_turmas').select('user_id,turma_id'),
    ]);
    const turmasMap = new Map((ts ?? []).map((t) => [t.id, t]));
    const rows: StaffRow[] = (ps ?? []).map((p: any) => ({
      ...p,
      turmas: (uts ?? [])
        .filter((r) => r.user_id === p.id)
        .map((r) => turmasMap.get(r.turma_id))
        .filter(Boolean) as Turma[],
    }));
    setStaff(rows);
    setTurmas(ts ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    professores: staff.filter((s) => s.role === 'professor').length,
    monitores:   staff.filter((s) => s.role === 'monitor').length,
  }), [staff]);

  /* ── Filtros ── */
  const filtered = useMemo(() => staff.filter((s) => {
    if (search && !s.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && s.role !== filterRole) return false;
    if (filterTurma && !s.turmas.some((t) => t.id === filterTurma)) return false;
    return true;
  }), [staff, search, filterRole, filterTurma]);

  const hasFilters = !!(search || filterRole || filterTurma);
  const clearFilters = () => { setSearch(''); setFilterRole(''); setFilterTurma(''); };

  /* ── Ações ── */
  const showLink = (token: string) =>
    setLinkModal(`${window.location.origin}/ativar?token=${token}`);

  const reinvite = async (s: StaffRow) => {
    try {
      const r = await callFn('admin-users', 'reinvite', { user_id: s.id });
      showLink(r.invite_token);
      load();
    } catch (e) { showToast((e as Error).message, 'danger'); }
  };

  const del = async (s: StaffRow) => {
    if (!confirm(`Excluir ${s.email}? Esta ação não pode ser desfeita.`)) return;
    try {
      await callFn('admin-users', 'delete', { user_id: s.id });
      showToast('Usuário excluído', 'success');
      load();
    } catch (e) { showToast((e as Error).message, 'danger'); }
  };

  const toggleBlock = async (s: StaffRow) => {
    const newStatus = s.status === 'blocked' ? 'active' : 'blocked';
    try {
      await callFn('admin-users', 'update', { user_id: s.id, status: newStatus });
      load();
    } catch (e) { showToast((e as Error).message, 'danger'); }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Professores & Monitores</h1>
          <p className="meta mt-1">Gerencie professores e monitores da plataforma</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateOpen(true)}
        >
          Novo membro
        </Button>
      </div>

      {/* ── Stats cards ── */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {([
            { label: 'Professores', value: stats.professores, filterValue: 'professor' as StaffRole, valueClass: 'text-yellow-400' },
            { label: 'Monitores',   value: stats.monitores,   filterValue: 'monitor'   as StaffRole, valueClass: 'text-[#d6deed]' },
          ] as const).map((card) => {
            const isSelected = filterRole === card.filterValue;
            return (
              <button
                key={card.label}
                onClick={() => setFilterRole(isSelected ? '' : card.filterValue)}
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

      {/* ── Filtros ── */}
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
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as '' | StaffRole)}
            className="max-w-[180px]"
          >
            <option value="">Todos os papéis</option>
            <option value="professor">Professor</option>
            <option value="monitor">Monitor</option>
          </select>
          <select
            value={filterTurma}
            onChange={(e) => setFilterTurma(e.target.value)}
            className="max-w-[220px]"
          >
            <option value="">Todas as turmas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs text-[#8b929e] hover:text-[#d6deed] transition-colors whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </button>
          )}
        </div>
        {hasFilters && !loading && (
          <p className="text-xs text-[#8b929e] mt-3 border-t border-[#1c1f26] pt-3">
            Mostrando{' '}
            <span className="text-white font-medium">{filtered.length}</span>
            {' '}de{' '}
            <span className="text-white font-medium">{staff.length}</span>
            {' '}membros
          </p>
        )}
      </Card>

      {/* ── Tabela ── */}
      {loading ? (
        <Card className="p-10 text-center"><p className="meta">Carregando...</p></Card>
      ) : filtered.length === 0 ? (
        hasFilters ? (
          <Empty
            icon={<Search className="w-8 h-8" />}
            title="Nenhum resultado para este filtro"
            description="Tente ajustar a busca ou clique em 'Limpar filtros'"
          />
        ) : (
          <Empty
            icon={<GraduationCap className="w-8 h-8" />}
            title="Nenhum professor ou monitor cadastrado"
            description="Clique em 'Novo membro' para convidar um professor ou monitor"
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
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[#1c1f26] last:border-0 hover:bg-[#111] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-white block truncate max-w-[200px]">{s.email}</span>
                    {s.id === current?.id && <span className="text-[#8b929e] text-xs">você</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[s.role]}>{ROLE_LABEL[s.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {s.status === 'active'  && <Badge tone="success">Ativo</Badge>}
                    {s.status === 'pending' && <Badge tone="warn">Pendente</Badge>}
                    {s.status === 'blocked' && <Badge tone="danger">Bloqueado</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.turmas.length === 0
                        ? <span className="text-[#434d5e] text-xs">—</span>
                        : s.turmas.map((t) => <Badge key={t.id}>{t.nome}</Badge>)
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[#8b929e] text-xs">
                    {new Date(s.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {s.status === 'pending' && s.invite_token && (
                        <Button variant="ghost" onClick={() => showLink(s.invite_token!)} icon={<Copy className="w-4 h-4" />}>
                          Link
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => reinvite(s)} icon={<RefreshCw className="w-4 h-4" />}>
                        Reenviar
                      </Button>
                      <Button variant="ghost" onClick={() => setEditOpen(s)} icon={<Pencil className="w-4 h-4" />}>
                        Editar
                      </Button>
                      {s.id !== current?.id && (
                        <>
                          <Button variant="ghost" onClick={() => toggleBlock(s)}>
                            {s.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                          </Button>
                          <Button variant="danger" onClick={() => del(s)} icon={<Trash2 className="w-4 h-4" />} />
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
      <CreateStaffModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        turmas={turmas}
        onDone={(token) => { setCreateOpen(false); showLink(token); load(); }}
      />
      <EditStaffModal
        member={editOpen}
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
        <p className="mb-3">Copie e envie este link ao membro. Ele continua válido até a senha ser definida.</p>
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
/*  Modal: Criar professor / monitor                               */
/* ─────────────────────────────────────────────────────────────── */
function CreateStaffModal({
  open, onClose, turmas, onDone,
}: {
  open: boolean; onClose: () => void; turmas: Turma[]; onDone: (token: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('professor');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setEmail(''); setRole('professor'); setSelected([]); setErr(null); }
  }, [open]);

  const submit = async () => {
    setErr(null);
    if (!email.trim()) { setErr('Email obrigatório'); return; }
    setLoading(true);
    try {
      const r = await callFn('admin-users', 'create', { email: email.trim(), role, turma_ids: selected });
      onDone(r.invite_token);
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  const toggle = (id: string) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convidar professor ou monitor"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Criar e gerar link</Button>
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
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            <option value="professor">Professor</option>
            <option value="monitor">Monitor</option>
          </select>
        </div>
        <div>
          <label>Turmas</label>
          {turmas.length === 0 ? (
            <p className="meta">Nenhuma turma criada ainda</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto border border-[#1c1f26] rounded-md p-3">
              {turmas.map((t) => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer !mb-0">
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    onChange={() => toggle(t.id)}
                    className="!w-4 !h-4"
                  />
                  <span className="text-white text-sm">{t.nome}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Modal: Editar professor / monitor                              */
/* ─────────────────────────────────────────────────────────────── */
function EditStaffModal({
  member, currentId, onClose, turmas, onDone,
}: {
  member: StaffRow | null; currentId?: string; onClose: () => void; turmas: Turma[]; onDone: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('professor');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setEmail(member.email);
      setRole(member.role);
      setSelected(member.turmas.map((t) => t.id));
      setErr(null);
    }
  }, [member]);

  if (!member) return null;
  const isSelf = member.id === currentId;

  const toggle = (id: string) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const submit = async () => {
    setErr(null);
    setLoading(true);
    try {
      await callFn('admin-users', 'update', {
        user_id: member.id,
        email: email !== member.email ? email : undefined,
        role: role !== member.role ? role : undefined,
        turma_ids: selected,
      });
      onDone();
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Modal
      open={!!member}
      onClose={onClose}
      title="Editar membro"
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
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} disabled={isSelf}>
            <option value="professor">Professor</option>
            <option value="monitor">Monitor</option>
          </select>
          {isSelf && <p className="meta mt-1">Você não pode alterar seu próprio papel</p>}
        </div>
        <div>
          <label>Turmas</label>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-[#1c1f26] rounded-md p-3">
            {turmas.length === 0 ? (
              <p className="meta">Nenhuma turma</p>
            ) : turmas.map((t) => (
              <label key={t.id} className="flex items-center gap-2 cursor-pointer !mb-0">
                <input
                  type="checkbox"
                  checked={selected.includes(t.id)}
                  onChange={() => toggle(t.id)}
                  className="!w-4 !h-4"
                />
                <span className="text-white text-sm">{t.nome}</span>
              </label>
            ))}
          </div>
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
