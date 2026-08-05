import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink, PlayCircle, MoreHorizontal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  Button, IconButton, Card, Modal, EmptyState, Skeleton, Field, Input, Textarea, Select, Alert,
  DropdownMenu, useToast, useConfirm,
} from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { getYouTubeId } from '../../lib/youtube';

type Aula = { id: string; curso_id: string; titulo: string; descricao: string | null; youtube_url: string; ordem: number };
type Curso = { id: string; titulo: string; turmasLabel: string };

export default function AdminAulas() {
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [cursoId, setCursoId] = useState(params.get('curso') ?? '');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Aula | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: cs }, { data: ts }, { data: cts }] = await Promise.all([
        supabase.from('cursos').select('id,titulo'),
        supabase.from('turmas').select('id,nome'),
        supabase.from('curso_turmas').select('curso_id,turma_id'),
      ]);
      const turmaMap = new Map((ts ?? []).map((t) => [t.id, t.nome]));
      const byCurso: Record<string, string[]> = {};
      (cts ?? []).forEach((r) => { const nome = turmaMap.get(r.turma_id); if (nome) (byCurso[r.curso_id] ??= []).push(nome); });
      const list: Curso[] = (cs ?? []).map((c) => ({ id: c.id, titulo: c.titulo, turmasLabel: (byCurso[c.id] ?? []).sort().join(', ') }));
      list.sort((a, b) => `${a.turmasLabel} - ${a.titulo}`.toLowerCase().localeCompare(`${b.turmasLabel} - ${b.titulo}`.toLowerCase()));
      setCursos(list);
      if (!cursoId && list.length) { setCursoId(list[0].id); setParams({ curso: list[0].id }, { replace: true }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAulas = async () => {
    if (!cursoId) return;
    setLoading(true);
    const { data } = await supabase.from('aulas').select('*').eq('curso_id', cursoId).order('ordem');
    setAulas(data ?? []);
    setLoading(false);
  };
  useEffect(() => { loadAulas(); }, [cursoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const del = async (a: Aula) => {
    const ok = await confirm({ title: 'Excluir aula', tone: 'danger', confirmLabel: 'Excluir', message: <>Excluir <strong className="text-fg">{a.titulo}</strong>?</> });
    if (!ok) return;
    const { error } = await supabase.from('aulas').delete().eq('id', a.id);
    if (error) toast.error(error.message); else { toast.success('Aula excluída.'); loadAulas(); }
  };

  const move = async (a: Aula, dir: -1 | 1) => {
    const idx = aulas.findIndex((x) => x.id === a.id);
    const other = aulas[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from('aulas').update({ ordem: other.ordem }).eq('id', a.id),
      supabase.from('aulas').update({ ordem: a.ordem }).eq('id', other.id),
    ]);
    loadAulas();
  };

  const maxOrdem = useMemo(() => aulas.reduce((m, a) => Math.max(m, a.ordem), 0), [aulas]);

  return (
    <div>
      <PageHeader title="Aulas" subtitle="Organize os vídeos e materiais de cada curso."
        actions={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)} disabled={!cursoId}>Nova aula</Button>} />

      <Card className="p-4 mb-4 max-w-xl">
        <Field label="Curso" htmlFor="aula-curso">
          <Select id="aula-curso" value={cursoId} onChange={(e) => { setCursoId(e.target.value); setParams({ curso: e.target.value }, { replace: true }); }}>
            <option value="">Selecione um curso</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.turmasLabel ? `${c.turmasLabel} - ${c.titulo}` : c.titulo}</option>)}
          </Select>
        </Field>
      </Card>

      {!cursoId ? <EmptyState icon={<PlayCircle className="w-8 h-8" />} title="Selecione um curso" description="Escolha um curso acima para ver e organizar suas aulas." /> :
        loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
        aulas.length === 0 ? <EmptyState icon={<PlayCircle className="w-8 h-8" />} title="Nenhuma aula" description="Adicione a primeira aula deste curso."
          action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Nova aula</Button>} /> : (
          <Card className="overflow-hidden">
            <ul>
              {aulas.map((a, i) => {
                const ytId = getYouTubeId(a.youtube_url);
                return (
                  <li key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 transition-colors">
                    <div className="w-20 h-11 rounded-md bg-black overflow-hidden flex-shrink-0 border border-line">
                      {ytId && <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} className="w-full h-full object-cover" alt="" loading="lazy" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-fg text-sm font-medium truncate">{a.ordem}. {a.titulo}</p>
                      <p className="text-fg-3 text-xs truncate">{a.descricao || 'Sem descrição'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconButton label="Mover para cima" onClick={() => move(a, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></IconButton>
                      <IconButton label="Mover para baixo" onClick={() => move(a, 1)} disabled={i === aulas.length - 1}><ArrowDown className="w-4 h-4" /></IconButton>
                      <DropdownMenu
                        items={[
                          ...(a.youtube_url ? [{ label: 'Abrir no YouTube', icon: <ExternalLink className="w-4 h-4" />, onClick: () => window.open(a.youtube_url, '_blank', 'noopener') }] : []),
                          { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => setEditOpen(a) },
                          { type: 'separator' as const },
                          { label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, tone: 'danger' as const, onClick: () => del(a) },
                        ]}
                        trigger={({ toggle, ref, open }) => <IconButton ref={ref} label="Ações da aula" onClick={toggle} className={open ? 'bg-panel-3 text-fg' : ''}><MoreHorizontal className="w-4 h-4" /></IconButton>}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

      <AulaModal open={createOpen} aula={null} cursoId={cursoId} nextOrdem={maxOrdem + 1} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); loadAulas(); }} />
      <AulaModal open={!!editOpen} aula={editOpen} cursoId={cursoId} nextOrdem={maxOrdem + 1} onClose={() => setEditOpen(null)} onDone={() => { setEditOpen(null); loadAulas(); }} />
    </div>
  );
}

function AulaModal({ open, aula, cursoId, nextOrdem, onClose, onDone }: {
  open: boolean; aula: Aula | null; cursoId: string; nextOrdem: number; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [url, setUrl] = useState('');
  const [ordem, setOrdem] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitulo(aula?.titulo ?? ''); setDescricao(aula?.descricao ?? ''); setUrl(aula?.youtube_url ?? '');
    setOrdem(aula?.ordem ?? nextOrdem); setErr(null);
  }, [aula, nextOrdem, open]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Informe o título da aula.'); return; }
    if (url && !getYouTubeId(url)) { setErr('URL do YouTube inválida.'); return; }
    setLoading(true);
    const payload = { titulo: titulo.trim(), descricao: descricao.trim(), youtube_url: url.trim(), ordem, curso_id: cursoId };
    const { error } = aula ? await supabase.from('aulas').update(payload).eq('id', aula.id) : await supabase.from('aulas').insert(payload);
    setLoading(false);
    if (error) setErr(error.message); else { toast.success(aula ? 'Aula atualizada.' : 'Aula criada.'); onDone(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={aula ? 'Editar aula' : 'Nova aula'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Título" required htmlFor="aula-tit"><Input id="aula-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Aula 1 — Boas-vindas" data-autofocus /></Field>
        <Field label="URL do YouTube" htmlFor="aula-url" hint="Cole o link completo do vídeo."><Input id="aula-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." /></Field>
        <Field label="Ordem" htmlFor="aula-ord"><Input id="aula-ord" type="number" value={ordem} onChange={(e) => setOrdem(parseInt(e.target.value) || 1)} min={1} className="max-w-[120px]" /></Field>
        <Field label="Descrição" htmlFor="aula-desc"><Textarea id="aula-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Resumo da aula" /></Field>
      </div>
    </Modal>
  );
}
