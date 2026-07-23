import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import {
  Plus, Upload, Search, Users as UsersIcon, SlidersHorizontal, X, Copy, Check,
  RefreshCw, Ban, ShieldCheck, Trash2, AlertCircle, Download, FileDown,
} from 'lucide-react';
import { supabase, callFn } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Button, IconButton, SearchInput, Select, Modal, EmptyState, TableSkeleton, Alert,
  Pagination, FilterChip, StatTile, useToast, useConfirm,
} from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { ROLE_LABEL, fullName, normalizePhone, type Role } from '../../lib/users';
import { loadCoursesByTurma, type Turma, type CursoInfo } from './users/pickers';
import type { UserRow } from './users/types';
import { UsersTableDesktop, UsersCardsMobile, type SortKey, type RowActions } from './users/UsersTable';
import { UserFormDrawer } from './users/UserFormDrawer';
import { downloadEmptyTemplate, exportUsersToXlsx } from './users/importValidation';

// Carregado sob demanda (traz o SheetJS/xlsx) só quando o admin abre a importação.
const ImportWizard = lazy(() => import('./users/ImportWizard').then((m) => ({ default: m.ImportWizard })));

const PAGE_SIZE = 12;
const STATUS_ORDER: Record<string, number> = { pending: 0, active: 1, blocked: 2 };

export default function AdminUsers() {
  const { profile: current } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [coursesByTurma, setCoursesByTurma] = useState<Record<string, CursoInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTurma, setFilterTurma] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'created_at', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [drawer, setDrawer] = useState<{ mode: 'create' | 'edit'; user?: UserRow } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [linkModal, setLinkModal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [{ data: ps, error: pe }, { data: ts }, { data: uts }, byTurma] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('turmas').select('id,nome').order('nome'),
        supabase.from('user_turmas').select('user_id,turma_id'),
        loadCoursesByTurma(),
      ]);
      if (pe) throw pe;
      const turmasMap = new Map((ts ?? []).map((t) => [t.id, t]));
      const rows: UserRow[] = (ps ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string, email: p.email as string,
        nome: (p.nome as string) ?? null, sobrenome: (p.sobrenome as string) ?? null,
        telefone: (p.telefone as string) ?? null, empresa: (p.empresa as string) ?? null,
        role: p.role as Role, status: p.status as UserRow['status'],
        created_at: (p.created_at as string) ?? new Date().toISOString(),
        invite_token: (p.invite_token as string) ?? null,
        turmas: [...new Map((uts ?? []).filter((r) => r.user_id === p.id).map((r) => turmasMap.get(r.turma_id)).filter(Boolean).map((t) => [t!.id, t!])).values()] as Turma[],
      }));
      setUsers(rows); setTurmas(ts ?? []); setCoursesByTurma(byTurma);
    } catch (e) {
      setError((e as Error).message || 'Falha ao carregar usuários.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, filterRole, filterStatus, filterTurma]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    pending: users.filter((u) => u.status === 'pending').length,
    blocked: users.filter((u) => u.status === 'blocked').length,
  }), [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = normalizePhone(search).replace(/\D/g, '');
    return users.filter((u) => {
      if (q) {
        const phoneDigits = (u.telefone ?? '').replace(/\D/g, '');
        const hitPhone = qDigits.length >= 3 && phoneDigits.includes(qDigits);
        if (
          !u.email.toLowerCase().includes(q)
          && !fullName(u.nome, u.sobrenome).toLowerCase().includes(q)
          && !(u.empresa ?? '').toLowerCase().includes(q)
          && !hitPhone
        ) return false;
      }
      if (filterRole && u.role !== filterRole) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      if (filterTurma && !u.turmas.some((t) => t.id === filterTurma)) return false;
      return true;
    });
  }, [users, search, filterRole, filterStatus, filterTurma]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sort.key === 'nome') { av = fullName(a.nome, a.sobrenome) || a.email; bv = fullName(b.nome, b.sobrenome) || b.email; }
      else if (sort.key === 'email') { av = a.email; bv = b.email; }
      else if (sort.key === 'telefone') { av = (a.telefone ?? '').replace(/\D/g, ''); bv = (b.telefone ?? '').replace(/\D/g, ''); }
      else if (sort.key === 'status') { av = STATUS_ORDER[a.status] ?? 9; bv = STATUS_ORDER[b.status] ?? 9; }
      else { av = a.created_at; bv = b.created_at; }
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'pt-BR');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);


  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = !!(search || filterRole || filterStatus || filterTurma);
  const clearFilters = () => { setSearch(''); setFilterRole(''); setFilterStatus(''); setFilterTurma(''); };

  const toggleSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'created_at' ? 'desc' : 'asc' }));

  /* ── seleção ── */
  const pageIds = pageRows.map((u) => u.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = pageIds.some((id) => selected.has(id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allSelected) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id)); return n; });
  const clearSelection = () => setSelected(new Set());

  /* ── ações individuais ── */
  const showLink = (token: string) => setLinkModal(`${window.location.origin}/ativar?token=${token}`);
  const copyLinkText = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const actions: RowActions = {
    edit: (u) => setDrawer({ mode: 'edit', user: u }),
    copyLink: (u) => u.invite_token && showLink(u.invite_token),
    reinvite: async (u) => {
      try { const r = await callFn('admin-users', 'reinvite', { user_id: u.id }); showLink(r.invite_token); toast.success('Convite reenviado.'); load(); }
      catch (e) { toast.error((e as Error).message); }
    },
    toggleBlock: async (u) => {
      const next = u.status === 'blocked' ? 'active' : 'blocked';
      try { await callFn('admin-users', 'update', { user_id: u.id, status: next }); toast.success(next === 'blocked' ? 'Usuário bloqueado.' : 'Usuário desbloqueado.'); load(); }
      catch (e) { toast.error((e as Error).message); }
    },
    remove: async (u) => {
      if (u.id === current?.id) { toast.error('Você não pode excluir sua própria conta.'); return; }
      const ok = await confirm({ title: 'Excluir usuário', tone: 'danger', confirmLabel: 'Excluir',
        message: <>Excluir <strong className="text-fg">{u.email}</strong>? Esta ação é permanente e remove todos os vínculos.</> });
      if (!ok) return;
      try { await callFn('admin-users', 'delete', { user_id: u.id }); toast.success('Usuário excluído.'); load(); }
      catch (e) { toast.error((e as Error).message); }
    },
  };

  /* ── ações em massa ── */
  const targets = () => users.filter((u) => selected.has(u.id) && u.id !== current?.id);
  const runBulk = async (label: string, fn: (u: UserRow) => Promise<void>) => {
    const list = targets();
    if (!list.length) { toast.info('Nenhum usuário elegível na seleção.'); return; }
    const id = toast.show(`${label} ${list.length} usuário(s)…`, { tone: 'loading', duration: 0 });
    let ok = 0, fail = 0;
    for (const u of list) { try { await fn(u); ok++; } catch { fail++; } }
    toast.dismiss(id);
    toast.show(`${label}: ${ok} concluído(s)${fail ? `, ${fail} com erro` : ''}.`, { tone: fail ? 'warn' : 'success' });
    clearSelection(); load();
  };

  const bulkReinvite = () => runBulk('Reenviando convite para', async (u) => { await callFn('admin-users', 'reinvite', { user_id: u.id }); });
  const bulkBlock = () => runBulk('Bloqueando', async (u) => { await callFn('admin-users', 'update', { user_id: u.id, status: 'blocked' }); });
  const bulkUnblock = () => runBulk('Desbloqueando', async (u) => { await callFn('admin-users', 'update', { user_id: u.id, status: 'active' }); });
  const bulkDelete = async () => {
    const list = targets();
    if (!list.length) { toast.info('Nenhum usuário elegível na seleção.'); return; }
    const ok = await confirm({ title: 'Excluir usuários', tone: 'danger', confirmLabel: `Excluir ${list.length}`, requireText: 'EXCLUIR',
      message: <>Excluir <strong className="text-fg">{list.length}</strong> usuário(s)? Esta ação é permanente.</> });
    if (!ok) return;
    runBulk('Excluindo', async (u) => { await callFn('admin-users', 'delete', { user_id: u.id }); });
  };

  const selectedCount = targets().length;

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie administradores, professores, monitores e alunos."
        actions={
          <>
            <Button variant="secondary" icon={<FileDown className="w-4 h-4" />} onClick={downloadEmptyTemplate}>Baixar template</Button>
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={() => exportUsersToXlsx(sorted)}>Exportar</Button>
            <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => setImportOpen(true)}>Importar planilha</Button>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setDrawer({ mode: 'create' })}>Novo usuário</Button>
          </>
        }
      />

      {/* Indicadores clicáveis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile label="Total" value={stats.total} icon={<UsersIcon className="w-4 h-4" />} active={!filterStatus} onClick={() => setFilterStatus('')} />
        <StatTile label="Ativos" value={stats.active} tone="ok" active={filterStatus === 'active'} onClick={() => setFilterStatus(filterStatus === 'active' ? '' : 'active')} />
        <StatTile label="Pendentes" value={stats.pending} tone="warn" active={filterStatus === 'pending'} onClick={() => setFilterStatus(filterStatus === 'pending' ? '' : 'pending')} />
        <StatTile label="Bloqueados" value={stats.blocked} tone="danger" active={filterStatus === 'blocked'} onClick={() => setFilterStatus(filterStatus === 'blocked' ? '' : 'blocked')} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, e-mail ou empresa…" className="flex-1" />
        <div className="hidden sm:flex gap-2.5">
          <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-[168px]">
            <option value="">Todos os papéis</option>
            {(['admin', 'professor', 'monitor', 'student'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
          <Select value={filterTurma} onChange={(e) => setFilterTurma(e.target.value)} className="w-[180px]">
            <option value="">Todas as turmas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Select>
        </div>
        <Button variant="secondary" className="sm:hidden" icon={<SlidersHorizontal className="w-4 h-4" />} onClick={() => setShowFilters((v) => !v)}>Filtros</Button>
      </div>

      {/* Filtros mobile */}
      {showFilters && (
        <div className="sm:hidden grid grid-cols-2 gap-2.5 mb-3">
          <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">Todos os papéis</option>
            {(['admin', 'professor', 'monitor', 'student'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option><option value="active">Ativo</option><option value="blocked">Bloqueado</option>
          </Select>
          <Select value={filterTurma} onChange={(e) => setFilterTurma(e.target.value)} className="col-span-2">
            <option value="">Todas as turmas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Select>
        </div>
      )}

      {/* Chips de filtros ativos */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {search && <FilterChip label={<>Busca: <span className="text-fg">{search}</span></>} onRemove={() => setSearch('')} />}
          {filterRole && <FilterChip label={<>Papel: <span className="text-fg">{ROLE_LABEL[filterRole as Role]}</span></>} onRemove={() => setFilterRole('')} />}
          {filterStatus && <FilterChip label={<>Status: <span className="text-fg">{filterStatus === 'active' ? 'Ativo' : filterStatus === 'pending' ? 'Pendente' : 'Bloqueado'}</span></>} onRemove={() => setFilterStatus('')} />}
          {filterTurma && <FilterChip label={<>Turma: <span className="text-fg">{turmas.find((t) => t.id === filterTurma)?.nome}</span></>} onRemove={() => setFilterTurma('')} />}
          <button onClick={clearFilters} className="text-fg-3 hover:text-fg text-xs inline-flex items-center gap-1"><X className="w-3.5 h-3.5" />Limpar tudo</button>
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : error ? (
        <Alert tone="danger" title="Não foi possível carregar os usuários" action={<Button size="sm" variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={load}>Tentar novamente</Button>}>{error}</Alert>
      ) : sorted.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={<Search className="w-8 h-8" />} title="Nenhum resultado" description="Ajuste a busca ou os filtros para encontrar usuários." action={<Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>} />
        ) : (
          <EmptyState icon={<UsersIcon className="w-8 h-8" />} title="Nenhum usuário cadastrado" description="Crie um usuário individualmente ou importe uma planilha para começar."
            action={<div className="flex gap-2"><Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => setImportOpen(true)}>Importar</Button><Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setDrawer({ mode: 'create' })}>Novo usuário</Button></div>} />
        )
      ) : (
        <>
          <UsersTableDesktop rows={pageRows} currentId={current?.id} selected={selected} onToggle={toggle} onToggleAll={toggleAll} allSelected={allSelected} someSelected={someSelected} sort={sort} onSort={toggleSort} actions={actions} />
          <UsersCardsMobile rows={pageRows} currentId={current?.id} selected={selected} onToggle={toggle} actions={actions} />
          <div className="mt-4"><Pagination page={page} pageCount={pageCount} onPage={setPage} total={sorted.length} pageSize={PAGE_SIZE} /></div>
        </>
      )}

      {/* Barra de ações em massa */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(720px,calc(100vw-2rem))] ma-anim-toast">
          <div className="flex items-center gap-2 ma-glass ma-glass-strong rounded-xl px-3 py-2.5">
            <span className="text-sm text-fg font-medium px-1">{selected.size} selecionado(s)</span>
            <span className="text-fg-3 text-xs hidden sm:inline">{selectedCount !== selected.size && `(${selectedCount} elegíveis)`}</span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" icon={<RefreshCw className="w-4 h-4" />} onClick={bulkReinvite}>Reenviar</Button>
            <Button size="sm" variant="ghost" icon={<Ban className="w-4 h-4" />} onClick={bulkBlock}>Bloquear</Button>
            <Button size="sm" variant="ghost" icon={<ShieldCheck className="w-4 h-4" />} onClick={bulkUnblock} className="hidden sm:inline-flex">Desbloquear</Button>
            <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={bulkDelete}>Excluir</Button>
            <IconButton label="Limpar seleção" onClick={clearSelection}><X className="w-4 h-4" /></IconButton>
          </div>
        </div>
      )}

      {/* Drawers */}
      <UserFormDrawer open={!!drawer} mode={drawer?.mode ?? 'create'} user={drawer?.user} turmas={turmas} onClose={() => setDrawer(null)} onSaved={load} />
      {importOpen && (
        <Suspense fallback={null}>
          <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} turmas={turmas} coursesByTurma={coursesByTurma} existingUsers={users.map((u) => ({ id: u.id, email: u.email }))} onDone={load} />
        </Suspense>
      )}

      {/* Modal do link de ativação */}
      <Modal open={!!linkModal} onClose={() => setLinkModal(null)} title="Link de ativação"
        footer={<Button variant="secondary" onClick={() => setLinkModal(null)}>Fechar</Button>}>
        <div className="flex items-start gap-3 mb-4">
          <span className="w-9 h-9 rounded-full bg-brand/12 text-brand grid place-items-center flex-shrink-0"><AlertCircle className="w-5 h-5" /></span>
          <p className="text-sm text-fg-2">Copie e envie este link ao usuário. Ele é válido por 7 dias.</p>
        </div>
        <div className="rounded-lg border border-line bg-panel-3/40 p-3 text-xs text-brand break-all font-mono">{linkModal}</div>
        <Button variant="primary" className="mt-4" block icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} onClick={() => linkModal && copyLinkText(linkModal)}>
          {copied ? 'Copiado' : 'Copiar link'}
        </Button>
      </Modal>
    </div>
  );
}
