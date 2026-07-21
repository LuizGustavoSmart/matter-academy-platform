import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users as UsersIcon, BookOpen, Layers, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import {
  Button, IconButton, Card, Modal, EmptyState, Skeleton, Field, Input, Textarea, Alert,
  DropdownMenu, useToast, useConfirm,
} from '../../components/ui';
import { staggerContainer, staggerItem } from '../../components/ui/motion';
import { PageHeader } from '../../layouts/AppShell';

type Turma = { id: string; nome: string; descricao: string | null; data_inicio: string | null; created_at: string | null };

export default function AdminTurmas() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [counts, setCounts] = useState<Record<string, { alunos: number; cursos: number }>>({});
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState<Turma | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('turmas').select('*').order('created_at', { ascending: false });
    setTurmas(data ?? []);
    const [{ data: uts }, { data: cts }] = await Promise.all([
      supabase.from('user_turmas').select('turma_id'),
      supabase.from('curso_turmas').select('turma_id'),
    ]);
    const c: Record<string, { alunos: number; cursos: number }> = {};
    (data ?? []).forEach((t) => (c[t.id] = { alunos: 0, cursos: 0 }));
    (uts ?? []).forEach((r) => { if (c[r.turma_id]) c[r.turma_id].alunos++; });
    (cts ?? []).forEach((r) => { if (c[r.turma_id]) c[r.turma_id].cursos++; });
    setCounts(c);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const del = async (t: Turma) => {
    const ok = await confirm({ title: 'Excluir turma', tone: 'danger', confirmLabel: 'Excluir', message: <>Excluir <strong className="text-fg">{t.nome}</strong>? Os vínculos com alunos e cursos serão removidos.</> });
    if (!ok) return;
    const { error } = await supabase.from('turmas').delete().eq('id', t.id);
    if (error) toast.error(error.message); else { toast.success('Turma excluída.'); load(); }
  };

  return (
    <div>
      <PageHeader title="Turmas" subtitle="Organize alunos e cursos em grupos de acesso."
        actions={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Nova turma</Button>} />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : turmas.length === 0 ? (
        <EmptyState icon={<Layers className="w-8 h-8" />} title="Nenhuma turma criada" description="Crie sua primeira turma para organizar alunos e cursos."
          action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Nova turma</Button>} />
      ) : (
        <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" variants={staggerContainer} initial="hidden" animate="visible">
          {turmas.map((t) => (
            <motion.div key={t.id} variants={staggerItem}>
              <Card hoverable className="p-5 cursor-pointer hover:border-line-strong transition-colors relative group" onClick={() => nav(`/admin/turmas/${t.id}`)}>
                <div className="absolute top-3.5 right-3.5" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu
                    items={[
                      { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => setEditOpen(t) },
                      { type: 'separator' },
                      { label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, tone: 'danger', onClick: () => del(t) },
                    ]}
                    trigger={({ toggle, ref, open }) => <IconButton ref={ref} label="Ações da turma" onClick={toggle} className={open ? 'bg-panel-3 text-fg' : ''}><MoreHorizontal className="w-4 h-4" /></IconButton>}
                  />
                </div>
                <span className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center mb-3"><Layers className="w-5 h-5 text-brand" /></span>
                <h3 className="mb-1 pr-10 line-clamp-1">{t.nome}</h3>
                <p className="text-fg-3 text-sm mb-4 line-clamp-2 min-h-[40px]">{t.descricao || 'Sem descrição'}</p>
                <div className="flex items-center gap-4 text-sm text-fg-2">
                  <span className="flex items-center gap-1.5"><UsersIcon className="w-4 h-4 text-fg-3" /> {counts[t.id]?.alunos ?? 0} alunos</span>
                  <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-fg-3" /> {counts[t.id]?.cursos ?? 0} cursos</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <TurmaModal open={createOpen} turma={null} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); }} />
      <TurmaModal open={!!editOpen} turma={editOpen} onClose={() => setEditOpen(null)} onDone={() => { setEditOpen(null); load(); }} />
    </div>
  );
}

function TurmaModal({ open, turma, onClose, onDone }: { open: boolean; turma: Turma | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNome(turma?.nome ?? ''); setDescricao(turma?.descricao ?? ''); setDataInicio(turma?.data_inicio ?? ''); setErr(null);
  }, [turma, open]);

  const submit = async () => {
    setErr(null);
    if (!nome.trim()) { setErr('Informe o nome da turma.'); return; }
    setLoading(true);
    const payload = { nome: nome.trim(), descricao: descricao.trim(), data_inicio: dataInicio || null };
    const { error } = turma ? await supabase.from('turmas').update(payload).eq('id', turma.id) : await supabase.from('turmas').insert(payload);
    setLoading(false);
    if (error) setErr(error.message); else { toast.success(turma ? 'Turma atualizada.' : 'Turma criada.'); onDone(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={turma ? 'Editar turma' : 'Nova turma'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Nome" required htmlFor="turma-nome"><Input id="turma-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Turma 2026.1" data-autofocus /></Field>
        <Field label="Descrição" htmlFor="turma-desc"><Textarea id="turma-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Objetivo ou observações da turma" /></Field>
        <Field label="Data de início" htmlFor="turma-data"><Input id="turma-data" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="max-w-[200px]" /></Field>
      </div>
    </Modal>
  );
}
