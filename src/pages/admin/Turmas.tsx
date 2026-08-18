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
import { uploadCapa } from '../../lib/storage';
import { SignedImage } from '../../components/SignedImage';

type Turma = { id: string; nome: string; codigo: string | null; descricao: string | null; data_inicio: string | null; capa_url: string | null; created_at: string | null };

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
    // codigo/capa_url ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('turmas').select('*').order('created_at', { ascending: false });
    const rows = (data ?? []) as Turma[];
    setTurmas(rows);
    const [{ data: uts }, { data: cts }] = await Promise.all([
      supabase.from('user_turmas').select('turma_id,user_id'),
      supabase.from('curso_turmas').select('turma_id'),
    ]);
    const c: Record<string, { alunos: number; cursos: number }> = {};
    // Um aluno pode ter uma linha por curso dentro da mesma turma — conta cada
    // pessoa uma única vez, não uma vez por curso em que está matriculada.
    const alunosPorTurma: Record<string, Set<string>> = {};
    rows.forEach((t) => (c[t.id] = { alunos: 0, cursos: 0 }));
    (uts ?? []).forEach((r) => { if (c[r.turma_id]) (alunosPorTurma[r.turma_id] ??= new Set()).add(r.user_id); });
    Object.entries(alunosPorTurma).forEach(([turmaId, set]) => { if (c[turmaId]) c[turmaId].alunos = set.size; });
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
                {t.capa_url ? (
                  <SignedImage bucket="capas" path={t.capa_url} className="w-full h-24 rounded-lg object-cover mb-3 border border-line" alt="" />
                ) : (
                  <span className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center mb-3"><Layers className="w-5 h-5 text-brand" /></span>
                )}
                <h3 className="mb-1 pr-10 line-clamp-1">{t.nome}</h3>
                <p className="text-fg-3 text-sm mb-4 line-clamp-2 min-h-[40px]">{t.codigo || 'Sem código'}</p>
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
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNome(turma?.nome ?? ''); setCodigo(turma?.codigo ?? ''); setDescricao(turma?.descricao ?? '');
    setDataInicio(turma?.data_inicio ?? ''); setCapaFile(null); setErr(null);
  }, [turma, open]);

  const submit = async () => {
    setErr(null);
    if (!nome.trim()) { setErr('Informe o nome da turma.'); return; }
    setLoading(true);
    let capa_url = turma?.capa_url ?? null;
    if (capaFile) {
      try { const up = await uploadCapa(capaFile, 'turmas'); capa_url = up.path; }
      catch (e) { setLoading(false); setErr((e as Error).message); return; }
    }
    const payload = { nome: nome.trim(), codigo: codigo.trim() || null, descricao: descricao.trim(), data_inicio: dataInicio || null, capa_url };
    // codigo/capa_url ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = turma ? await sb.from('turmas').update(payload).eq('id', turma.id) : await sb.from('turmas').insert(payload);
    setLoading(false);
    if (error) setErr(error.message); else { toast.success(turma ? 'Turma atualizada.' : 'Turma criada.'); onDone(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={turma ? 'Editar turma' : 'Nova turma'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome" required htmlFor="turma-nome"><Input id="turma-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Turma 2026.1" data-autofocus /></Field>
          <Field label="Código" hint="Ex.: T002" htmlFor="turma-codigo"><Input id="turma-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="T002" /></Field>
        </div>
        <Field label="Descrição" htmlFor="turma-desc"><Textarea id="turma-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Objetivo ou observações da turma" /></Field>
        <Field label="Data de início" htmlFor="turma-data"><Input id="turma-data" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="max-w-[200px]" /></Field>
        <Field label="Capa" hint="Opcional — usada nas listas" htmlFor="turma-capa">
          <div className="flex items-center gap-3">
            {(capaFile || turma?.capa_url) && (
              <div className="w-16 h-9 rounded-md bg-black overflow-hidden flex-shrink-0 border border-line">
                {capaFile ? <img src={URL.createObjectURL(capaFile)} className="w-full h-full object-cover" alt="" /> : <SignedImage bucket="capas" path={turma!.capa_url} className="w-full h-full object-cover" />}
              </div>
            )}
            <Input id="turma-capa" type="file" accept="image/*" onChange={(e) => setCapaFile(e.target.files?.[0] ?? null)} className="!py-2" />
          </div>
        </Field>
      </div>
    </Modal>
  );
}
