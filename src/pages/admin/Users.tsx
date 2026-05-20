import { useEffect, useMemo, useState } from 'react';
import { Plus, Copy, Check, Trash2, RefreshCw, Pencil, Search } from 'lucide-react';
import { supabase, callFn } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Badge, Modal, Empty, Toast } from '../../components/ui';

type Turma = { id: string; nome: string };
type Role = 'admin' | 'student' | 'professor';
type UserRow = {
  id: string; email: string; role: Role; status: string;
  created_at: string; invite_token: string | null;
  turmas: { id: string; nome: string }[];
};

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrador', student: 'Aluno', professor: 'Professor' };
const ROLE_TONE: Record<Role, 'success' | 'default' | 'warn'> = { admin: 'success', professor: 'warn', student: 'default' };

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
      turmas: (uts ?? [])
        .filter((r) => r.user_id === p.id)
        .map((r) => turmasMap.get(r.turma_id))
        .filter(Boolean) as Turma[],
    }));
    setUsers(rows);
    setTurmas(ts ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      if (filterRole && u.role !== filterRole) return false;
      if (filterTurma && !u.turmas.some((t) => t.id === filterTurma)) return false;
      return true;
    });
  }, [users, search, filterStatus, filterRole, filterTurma]);

  const showLink = (token: string) => {
    setLinkModal(`${window.location.origin}/ativar?token=${token}`);
  };

  const reinvite = async (u: UserRow) => {
    try {
      const r = await callFn('admin-users', 'reinvite', { user_id: u.id });
      showLink(r.invite_token);
      load();
    } catch (e) { setToast({ msg: (e as Error).message, tone: 'danger' }); }
  };

  const del = async (u: UserRow) => {
    if (u.id === current?.id) { setToast({ msg: 'Você não pode excluir sua própria conta', tone: 'danger' }); return; }
    if (!confirm(`Excluir ${u.email}? Esta ação não pode ser desfeita.`)) return;
    try {
      await callFn('admin-users', 'delete', { user_id: u.id });
      setToast({ msg: 'Usuário excluído', tone: 'success' });
      load();
    } catch (e) { setToast({ msg: (e as Error).message, tone: 'danger' }); }
  };

  const toggleBlock = async (u: UserRow) => {
    const newStatus = u.status === 'blocked' ? 'active' : 'blocked';
    try {
      await callFn('admin-users', 'update', { user_id: u.id, status: newStatus });
      load();
    } catch (e) { setToast({ msg: (e as Error).message, tone: 'danger' }); }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Usuários</h1>
          <p className="meta mt-1">Gerencie administradores, professores e alunos</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Novo usuário
        </Button>
      </div>

      <Card className="p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#434d5e]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar email..." className="!pl-9" />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="max-w-[180px]">
          <option value="">Todos os papéis</option>
          <option value="admin">Administrador</option>
          <option value="professor">Professor</option>
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
      </Card>

      {loading ? (
        <p className="meta">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Empty title="Nenhum usuário encontrado" description="Convide alunos ou professores para começar" />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1c1f26] text-left">
                <th className="px-4 py-3 font-medium text-[#d6deed]">Email</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Papel</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Status</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Turmas</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Criado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-[#1c1f26] last:border-0 hover:bg-[#111]">
                  <td className="px-4 py-3 text-white">{u.email}{u.id === current?.id && <span className="ml-2 meta">(você)</span>}</td>
                  <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
                  <td className="px-4 py-3">
                    {u.status === 'active' && <Badge tone="success">Ativo</Badge>}
                    {u.status === 'pending' && <Badge tone="warn">Pendente</Badge>}
                    {u.status === 'blocked' && <Badge tone="danger">Bloqueado</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.turmas.length === 0 ? <span className="meta">—</span> : u.turmas.map((t) => <Badge key={t.id}>{t.nome}</Badge>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 meta">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {u.status === 'pending' && u.invite_token && (
                        <Button variant="ghost" onClick={() => showLink(u.invite_token!)} icon={<Copy className="w-4 h-4" />}>Link</Button>
                      )}
                      <Button variant="ghost" onClick={() => reinvite(u)} icon={<RefreshCw className="w-4 h-4" />}>Reenviar</Button>
                      <Button variant="ghost" onClick={() => setEditOpen(u)} icon={<Pencil className="w-4 h-4" />}>Editar</Button>
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

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} turmas={turmas} onDone={(token) => { setCreateOpen(false); showLink(token); load(); }} />
      <EditUserModal user={editOpen} currentId={current?.id} onClose={() => setEditOpen(null)} turmas={turmas} onDone={() => { setEditOpen(null); load(); }} />

      <Modal open={!!linkModal} onClose={() => setLinkModal(null)} title="Link de ativação"
        footer={<Button variant="secondary" onClick={() => setLinkModal(null)}>Fechar</Button>}>
        <p className="mb-3">Copie e envie este link ao usuário. Válido por 7 dias.</p>
        <div className="border border-[#1c1f26] bg-black rounded-md p-3 text-sm text-[#cbfb00] break-all">{linkModal}</div>
        <Button variant="primary" className="mt-4" onClick={() => linkModal && copy(linkModal)} icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
          {copied ? 'Copiado' : 'Copiar link'}
        </Button>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} />
    </div>
  );
}

function CreateUserModal({ open, onClose, turmas, onDone }: { open: boolean; onClose: () => void; turmas: Turma[]; onDone: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setEmail(''); setRole('student'); setSelected([]); setErr(null); }
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

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  return (
    <Modal open={open} onClose={onClose} title="Convidar usuário"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Criar e gerar link</Button>
        </>
      }>
      <div className="space-y-4">
        <div>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label>Papel</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="student">Aluno</option>
            <option value="professor">Professor</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div>
          <label>Turmas</label>
          {turmas.length === 0 ? <p className="meta">Nenhuma turma criada ainda</p> : (
            <div className="space-y-2 max-h-48 overflow-y-auto border border-[#1c1f26] rounded-md p-3">
              {turmas.map((t) => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer !mb-0">
                  <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="!w-4 !h-4" />
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

function EditUserModal({ user, currentId, onClose, turmas, onDone }: { user: UserRow | null; currentId?: string; onClose: () => void; turmas: Turma[]; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setRole(user.role);
      setSelected(user.turmas.map((t) => t.id));
      setErr(null);
    }
  }, [user]);

  if (!user) return null;
  const isSelf = user.id === currentId;

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const submit = async () => {
    setErr(null);
    setLoading(true);
    try {
      await callFn('admin-users', 'update', {
        user_id: user.id,
        email: email !== user.email ? email : undefined,
        role: role !== user.role ? role : undefined,
        turma_ids: selected,
      });
      onDone();
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={!!user} onClose={onClose} title="Editar usuário"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Salvar</Button>
        </>
      }>
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
            <option value="admin">Administrador</option>
          </select>
          {isSelf && <p className="meta mt-1">Você não pode alterar seu próprio papel</p>}
        </div>
        <div>
          <label>Turmas</label>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-[#1c1f26] rounded-md p-3">
            {turmas.length === 0 ? <p className="meta">Nenhuma turma</p> : turmas.map((t) => (
              <label key={t.id} className="flex items-center gap-2 cursor-pointer !mb-0">
                <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="!w-4 !h-4" />
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
