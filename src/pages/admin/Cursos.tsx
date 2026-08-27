import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, PlayCircle, MoreHorizontal, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import {
  Button, IconButton, Card, Badge, Modal, EmptyState, Skeleton, Field, Input, Textarea, Select, Checkbox, Alert,
  DropdownMenu, useToast, useConfirm,
} from '../../components/ui';
import { staggerContainer, staggerItem } from '../../components/ui/motion';
import { PageHeader } from '../../layouts/AppShell';
import { FAIXA_OPTIONS, labelDaFaixa } from '../../lib/faixa';
import { uploadCapa } from '../../lib/storage';
import { CapaField, CAPA_PENDING_EMPTY, resolveCapaPending, type CapaPending } from '../../components/CapaField';

type Curso = { id: string; titulo: string; descricao: string | null; faixa: string | null; capa_url: string | null; capa_aulas_padrao_url: string | null };
type Turma = { id: string; nome: string };

export default function AdminCursos() {
  const toast = useToast();
  const confirm = useConfirm();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [cursoTurmas, setCursoTurmas] = useState<Record<string, string[]>>({});
  const [aulaCounts, setAulaCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Curso | null>(null);

  const load = async () => {
    setLoading(true);
    // faixa ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ data: cs }, { data: ts }, { data: cts }, { data: as }] = await Promise.all([
      (supabase as any).from('cursos').select('*').order('created_at', { ascending: false }),
      supabase.from('turmas').select('id,nome').order('nome'),
      supabase.from('curso_turmas').select('curso_id,turma_id'),
      supabase.from('aulas').select('curso_id'),
    ]);
    setCursos(cs ?? []);
    setTurmas(ts ?? []);
    const map: Record<string, string[]> = {};
    (cts ?? []).forEach((r) => { (map[r.curso_id] ??= []).push(r.turma_id); });
    setCursoTurmas(map);
    const counts: Record<string, number> = {};
    (as ?? []).forEach((a) => { counts[a.curso_id] = (counts[a.curso_id] ?? 0) + 1; });
    setAulaCounts(counts);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const del = async (c: Curso) => {
    const ok = await confirm({ title: 'Excluir curso', tone: 'danger', confirmLabel: 'Excluir', message: <>Excluir <strong className="text-fg">{c.titulo}</strong>? Todas as aulas vinculadas serão removidas.</> });
    if (!ok) return;
    const { error } = await supabase.from('cursos').delete().eq('id', c.id);
    if (error) toast.error(error.message); else { toast.success('Curso excluído.'); load(); }
  };

  return (
    <div>
      <PageHeader title="Cursos" subtitle="Crie cursos e vincule às turmas com acesso."
        actions={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Novo curso</Button>} />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>
      ) : cursos.length === 0 ? (
        <EmptyState icon={<BookOpen className="w-8 h-8" />} title="Nenhum curso criado" description="Crie o primeiro curso para vincular às turmas."
          action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Novo curso</Button>} />
      ) : (
        <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" variants={staggerContainer} initial="hidden" animate="visible">
          {cursos.map((c) => {
            const names = turmas.filter((t) => (cursoTurmas[c.id] ?? []).includes(t.id));
            return (
              <motion.div key={c.id} variants={staggerItem}>
                <Card hoverable className="p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center flex-shrink-0"><BookOpen className="w-5 h-5 text-brand" /></span>
                    <DropdownMenu
                      items={[
                        { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => setEditOpen(c) },
                        { type: 'separator' },
                        { label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, tone: 'danger', onClick: () => del(c) },
                      ]}
                      trigger={({ toggle, ref, open }) => <IconButton ref={ref} label="Ações do curso" onClick={toggle} className={open ? 'bg-panel-3 text-fg' : ''}><MoreHorizontal className="w-4 h-4" /></IconButton>}
                    />
                  </div>
                  {labelDaFaixa(c.faixa) && <Badge tone="outline" className="self-start mb-2">{labelDaFaixa(c.faixa)}</Badge>}
                  <h3 className="mb-1 line-clamp-1">{c.titulo}</h3>
                  <p className="text-fg-3 text-sm mb-4 line-clamp-2 min-h-[40px]">{c.descricao || 'Sem descrição'}</p>
                  <div className="flex flex-wrap gap-1 mb-3 min-h-[24px]">
                    {names.length === 0 ? <span className="text-fg-3 text-xs">Sem turmas vinculadas</span> : names.map((t) => <Badge key={t.id}>{t.nome}</Badge>)}
                  </div>
                  <div className="flex items-center gap-1.5 mb-4 text-sm text-fg-2"><PlayCircle className="w-4 h-4 text-fg-3" /> {aulaCounts[c.id] ?? 0} aulas</div>
                  <div className="flex gap-2 mt-auto">
                    <Link to={`/admin/aulas?curso=${c.id}`} className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md text-sm font-medium bg-panel-2 border border-line text-fg-2 hover:bg-panel-3 transition-colors flex-1"><PlayCircle className="w-4 h-4" />Ver aulas</Link>
                    <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditOpen(c)}>Editar</Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <CursoModal open={createOpen} curso={null} turmas={turmas} cursoTurmas={cursoTurmas} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); }} />
      <CursoModal open={!!editOpen} curso={editOpen} turmas={turmas} cursoTurmas={cursoTurmas} onClose={() => setEditOpen(null)} onDone={() => { setEditOpen(null); load(); }} />
    </div>
  );
}

function CursoModal({ open, curso, turmas, cursoTurmas, onClose, onDone }: {
  open: boolean; curso: Curso | null; turmas: Turma[]; cursoTurmas: Record<string, string[]>;
  onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [faixa, setFaixa] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [capaPending, setCapaPending] = useState<CapaPending>(CAPA_PENDING_EMPTY);
  const [capaAulasPending, setCapaAulasPending] = useState<CapaPending>(CAPA_PENDING_EMPTY);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitulo(curso?.titulo ?? ''); setDescricao(curso?.descricao ?? ''); setFaixa(curso?.faixa ?? '');
    setSelected(curso ? (cursoTurmas[curso.id] ?? []) : []); setCapaPending(CAPA_PENDING_EMPTY); setCapaAulasPending(CAPA_PENDING_EMPTY); setErr(null);
  }, [curso, cursoTurmas, open]);

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Informe o título do curso.'); return; }
    setLoading(true);
    // faixa ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    let cursoId = curso?.id;
    let capa_url = resolveCapaPending(capaPending, curso?.capa_url ?? null);
    let capa_aulas_padrao_url = resolveCapaPending(capaAulasPending, curso?.capa_aulas_padrao_url ?? null);
    try {
      if (capaPending.file) capa_url = (await uploadCapa(capaPending.file, cursoId ?? 'novo-curso')).path;
      if (capaAulasPending.file) capa_aulas_padrao_url = (await uploadCapa(capaAulasPending.file, cursoId ?? 'novo-curso')).path;
    } catch (e) { setErr((e as Error).message); setLoading(false); return; }
    const payload = { titulo: titulo.trim(), descricao: descricao.trim(), faixa: faixa || null, capa_url, capa_aulas_padrao_url };
    if (curso) {
      const { error } = await sb.from('cursos').update(payload).eq('id', curso.id);
      if (error) { setErr(error.message); setLoading(false); return; }
    } else {
      const { data, error } = await sb.from('cursos').insert(payload).select('id').maybeSingle();
      if (error || !data) { setErr(error?.message ?? 'Erro ao criar curso'); setLoading(false); return; }
      cursoId = data.id;
    }
    if (cursoId) {
      await supabase.from('curso_turmas').delete().eq('curso_id', cursoId);
      if (selected.length) await supabase.from('curso_turmas').insert(selected.map((tid) => ({ curso_id: cursoId, turma_id: tid })));
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
        <Field label="Título" required htmlFor="cur-tit"><Input id="cur-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Introdução ao produto" data-autofocus /></Field>
        <Field label="Descrição" htmlFor="cur-desc"><Textarea id="cur-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Resumo do curso" /></Field>
        <Field label="Faixa" hint="Define a ordem fixa em que os blocos aparecem" htmlFor="cur-faixa">
          <Select id="cur-faixa" value={faixa} onChange={(e) => setFaixa(e.target.value)}>
            <option value="">Não definida</option>
            {FAIXA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <CapaField id="cur-capa" label="Capa do curso" hint="Usada nas listas de cursos/aulas — envie uma imagem ou escolha um modelo"
          existingUrl={curso?.capa_url ?? null} value={capaPending} onChange={setCapaPending} />
        <CapaField id="cur-capa-aulas" label="Capa padrão das aulas" hint="Usada em qualquer aula deste curso sem capa própria — se trocar depois, essas aulas acompanham"
          existingUrl={curso?.capa_aulas_padrao_url ?? null} value={capaAulasPending} onChange={setCapaAulasPending} />
        <Field label="Turmas com acesso">
          {turmas.length === 0 ? <p className="text-fg-3 text-sm">Crie uma turma antes de vincular.</p> : (
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin border border-line rounded-lg p-3 bg-panel-3/30">
              {turmas.map((t) => <Checkbox key={t.id} checked={selected.includes(t.id)} onChange={() => toggle(t.id)} label={<span className="text-fg">{t.nome}</span>} />)}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}
