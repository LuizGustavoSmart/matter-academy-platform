import { MoreHorizontal, Copy, RefreshCw, Pencil, Layers, Ban, ShieldCheck, Trash2 } from 'lucide-react';
import { Avatar, Badge, Checkbox, DropdownMenu, IconButton, SortHeader, Th, cn, type MenuItem } from '../../../components/ui';
import { ROLE_LABEL, statusLabel, fullName, formatPhone, type Role } from '../../../lib/users';
import type { UserRow } from './types';

const ROLE_TONE: Record<Role, 'success' | 'warn' | 'info' | 'default'> = {
  admin: 'success', professor: 'warn', monitor: 'info', student: 'default', embaixador: 'info',
};
const STATUS_TONE: Record<string, 'success' | 'warn' | 'danger'> = {
  active: 'success', pending: 'warn', blocked: 'danger',
};

export type SortKey = 'nome' | 'email' | 'telefone' | 'status' | 'created_at';

function rowMenu(u: UserRow, isSelf: boolean, actions: RowActions): MenuItem[] {
  const items: MenuItem[] = [
    { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => actions.edit(u) },
    { label: 'Gerenciar turmas e cursos', icon: <Layers className="w-4 h-4" />, onClick: () => actions.edit(u) },
  ];
  if (u.status === 'pending' && u.invite_token) items.push({ label: 'Copiar link de ativação', icon: <Copy className="w-4 h-4" />, onClick: () => actions.copyLink(u) });
  items.push({ label: 'Reenviar convite', icon: <RefreshCw className="w-4 h-4" />, onClick: () => actions.reinvite(u) });
  if (!isSelf) {
    items.push({ type: 'separator' });
    items.push(u.status === 'blocked'
      ? { label: 'Desbloquear', icon: <ShieldCheck className="w-4 h-4" />, onClick: () => actions.toggleBlock(u) }
      : { label: 'Bloquear', icon: <Ban className="w-4 h-4" />, onClick: () => actions.toggleBlock(u) });
    items.push({ label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, tone: 'danger', onClick: () => actions.remove(u) });
  }
  return items;
}

export type RowActions = {
  edit: (u: UserRow) => void;
  copyLink: (u: UserRow) => void;
  reinvite: (u: UserRow) => void;
  toggleBlock: (u: UserRow) => void;
  remove: (u: UserRow) => void;
};

function TurmaCell({ turmas }: { turmas: UserRow['turmas'] }) {
  if (turmas.length === 0) return <span className="text-fg-3 text-xs">—</span>;
  const shown = turmas.slice(0, 2);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => <Badge key={t.id}>{t.nome}</Badge>)}
      {turmas.length > 2 && <Badge tone="outline">+{turmas.length - 2}</Badge>}
    </div>
  );
}

/* ─────────────────────────── Desktop table ─────────────────────────── */
export function UsersTableDesktop({
  rows, currentId, selected, onToggle, onToggleAll, allSelected, someSelected, sort, onSort, actions,
}: {
  rows: UserRow[]; currentId?: string; selected: Set<string>;
  onToggle: (id: string) => void; onToggleAll: () => void; allSelected: boolean; someSelected: boolean;
  sort: { key: SortKey; dir: 'asc' | 'desc' }; onSort: (k: SortKey) => void; actions: RowActions;
}) {
  const sortDir = (k: SortKey) => (sort.key === k ? sort.dir : null);
  return (
    <div className="hidden lg:block bg-panel border border-line rounded-xl overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <Th className="w-10"><Checkbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={onToggleAll} /></Th>
              <SortHeader label="Nome" active={sort.key === 'nome'} dir={sortDir('nome')} onClick={() => onSort('nome')} />
              <SortHeader label="E-mail" active={sort.key === 'email'} dir={sortDir('email')} onClick={() => onSort('email')} />
              <SortHeader label="Telefone" active={sort.key === 'telefone'} dir={sortDir('telefone')} onClick={() => onSort('telefone')} />
              <Th>Empresa</Th>
              <Th>Papel</Th>
              <SortHeader label="Status" active={sort.key === 'status'} dir={sortDir('status')} onClick={() => onSort('status')} />
              <Th>Turmas</Th>
              <SortHeader label="Cadastro" active={sort.key === 'created_at'} dir={sortDir('created_at')} onClick={() => onSort('created_at')} />
              <Th className="w-12 text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isSelf = u.id === currentId;
              const name = fullName(u.nome, u.sobrenome) || u.email.split('@')[0];
              return (
                <tr key={u.id} className={cn('border-b border-line last:border-0 transition-colors hover:bg-panel-2/40', selected.has(u.id) && 'bg-brand/[0.04]')}>
                  <td className="px-4 py-3"><Checkbox checked={selected.has(u.id)} onChange={() => onToggle(u.id)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={fullName(u.nome, u.sobrenome)} email={u.email} size={34} />
                      <p className="text-fg font-medium truncate max-w-[220px]">{name}{isSelf && <span className="text-fg-3 text-xs font-normal ml-1.5">(você)</span>}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-fg-2"><span className="truncate max-w-[240px] inline-block align-middle">{u.email}</span></td>
                  <td className="px-4 py-3 text-fg-2 whitespace-nowrap">{u.telefone ? formatPhone(u.telefone) : <span className="text-fg-3 text-xs">—</span>}</td>
                  <td className="px-4 py-3 text-fg-2">{u.empresa || <span className="text-fg-3 text-xs">—</span>}</td>
                  <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]} dot>{ROLE_LABEL[u.role]}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[u.status]} dot>{statusLabel(u.status)}</Badge></td>
                  <td className="px-4 py-3"><TurmaCell turmas={u.turmas} /></td>
                  <td className="px-4 py-3 text-fg-3 text-xs whitespace-nowrap">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>

                  <td className="px-4 py-3 text-right">
                    <DropdownMenu
                      items={rowMenu(u, isSelf, actions)}
                      trigger={({ toggle, ref, open }) => (
                        <IconButton ref={ref} label="Ações do usuário" onClick={toggle} className={open ? 'bg-panel-3 text-fg' : ''}><MoreHorizontal className="w-4 h-4" /></IconButton>
                      )}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────── Mobile cards ──────────────────────────── */
export function UsersCardsMobile({
  rows, currentId, selected, onToggle, actions,
}: {
  rows: UserRow[]; currentId?: string; selected: Set<string>; onToggle: (id: string) => void; actions: RowActions;
}) {
  return (
    <div className="lg:hidden space-y-2.5">
      {rows.map((u) => {
        const isSelf = u.id === currentId;
        const name = fullName(u.nome, u.sobrenome) || u.email.split('@')[0];
        return (
          <div key={u.id} className={cn('bg-panel border border-line rounded-xl p-3.5', selected.has(u.id) && 'border-brand/40')}>
            <div className="flex items-start gap-3">
              <div className="pt-0.5"><Checkbox checked={selected.has(u.id)} onChange={() => onToggle(u.id)} /></div>
              <Avatar name={fullName(u.nome, u.sobrenome)} email={u.email} size={38} />
              <div className="min-w-0 flex-1">
                <p className="text-fg font-medium truncate">{name}{isSelf && <span className="text-fg-3 text-xs ml-1">(você)</span>}</p>
                <p className="text-fg-3 text-xs truncate">{u.email}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Badge tone={ROLE_TONE[u.role]} dot>{ROLE_LABEL[u.role]}</Badge>
                  <Badge tone={STATUS_TONE[u.status]} dot>{statusLabel(u.status)}</Badge>
                </div>
                {(u.empresa || u.telefone) && (
                  <p className="text-fg-3 text-xs mt-2">{[u.empresa, formatPhone(u.telefone)].filter(Boolean).join(' · ')}</p>
                )}
                {u.turmas.length > 0 && <div className="mt-2"><TurmaCell turmas={u.turmas} /></div>}
              </div>
              <DropdownMenu
                items={rowMenu(u, isSelf, actions)}
                trigger={({ toggle, ref, open }) => (
                  <IconButton ref={ref as never} label="Ações do usuário" onClick={toggle} className={open ? 'bg-panel-3 text-fg' : ''}><MoreHorizontal className="w-4 h-4" /></IconButton>
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
