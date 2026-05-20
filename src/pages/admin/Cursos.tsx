import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button, Card, Badge, Modal, Empty, Toast } from '../../components/ui';

type Curso = { id: string; titulo: string; descricao: string };
type Turma = { id: string; nome: string };

export default function AdminCursos() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [cursoTurmas, setCursoTurmas] = useState<Record<string, string[]>>({});
  const [aulaCounts, setAulaCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Curso | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: cs }, { data: ts }, { data: cts }, { data: as }] = await Promise.all([
      supabase.from('cursos').select('*').order('created_at', { ascending: false }),
      supabase.from('turmas').select('id,nome').order('nome'),
      supabase.from('curso_turmas').select('curso_id,turma_id'),
      supabase.from('aulas').select('curso_id'),
    ]);
    setCursos(cs ?? []);
    setTurmas(ts ?? []);
    const map: Record<string, string[]> = {};
    (cts ?? []).forEach((r) => {
      if (!map[r.curso_id]) map[r.curso_id] = [];
      map[r.curso_id].push(r.turma_id);
    });
    setCursoTurmas(map);
    const counts: Record<string, number> = {};
    (as ?? []).forEach((a) => { counts[a.curso_id] = (counts[a.curso_id] ?? 0) + 1; });
    setAulaCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const del = async (c: Curso) => {
    if (!confirm(`Excluir curso "${c.titulo}"? Todas as aulas serão removidas.`)) return;
    const { error } = await supabase.from('cursos').delete().eq('id', c.id);
    if (error) setToast(error.message);
    else { setToast('Curso excluído'); load(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Cursos</h1>
          <p className="meta mt-1">Crie e vincule cursos a turmas</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Novo curso</Button>
      </div>

      {loading ? <p className="meta">Carregando...</p> :
        cursos.length === 0 ? <Empty title="Nenhum curso criado" /> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cursos.map((c) => {
              const ids = cursoTurmas[c.id] ?? [];
              const names = turmas.filter((t) => ids.includes(t.id));
              return (
                <Card key={c.id} className="p-5">
                  <h3 className="mb-1">{c.titulo}</h3>
                  <p className="text-sm mb-4 line-clamp-2 min-h-[40px]">{c.descricao || '—'}</p>
                  <div className="flex flex-wrap gap-1 mb-3 min-h-[22px]">
                    {names.length === 0 ? <span className="meta">Sem turmas vinculadas</span> : names.map((t) => <Badge key={t.id}>{t.nome}</Badge>)}
                  </div>
                  <div className="flex items-center gap-1 mb-4 text-sm text-[#d6deed]">
                    <PlayCircle className="w-4 h-4 text-[#434d5e]" /> {aulaCounts[c.id] ?? 0} aulas
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/admin/aulas?curso=${c.id}`} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm border border-[#434d5e] text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors">Aulas</Link>
                    <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditOpen(c)}>Editar</Button>
                    <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => del(c)} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <CursoModal open={createOpen} curso={null} turmas={turmas} cursoTurmas={cursoTurmas} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); }} />
      <CursoModal open={!!editOpen} curso={editOpen} turmas={turmas} cursoTurmas={cursoTurmas} onClose={() => setEditOpen(null)} onDone={() => { setEditOpen(null); load(); }} />

      <Toast message={toast} />
    </div>
  );
}

function CursoModal({ open, curso, turmas, cursoTurmas, onClose, onDone }: {
  open: boolean; curso: Curso | null; turmas: Turma[]; cursoTurmas: Record<string, string[]>;
  onClose: () => void; onDone: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitulo(curso?.titulo ?? '');
    setDescricao(curso?.descricao ?? '');
    setSelected(curso ? (cursoTurmas[curso.id] ?? []) : []);
    setErr(null);
  }, [curso, cursoTurmas, open]);

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Título obrigatório'); return; }
    setLoading(true);
    const payload = { titulo: titulo.trim(), descricao: descricao.trim() };
    let cursoId = curso?.id;
    if (curso) {
      const { error } = await supabase.from('cursos').update(payload).eq('id', curso.id);
      if (error) { setErr(error.message); setLoading(false); return; }
    } else {
      const { data, error } = await supabase.from('cursos').insert(payload).select('id').maybeSingle();
      if (error || !data) { setErr(error?.message ?? 'Erro'); setLoading(false); return; }
      cursoId = data.id;
    }
    if (cursoId) {
      await supabase.from('curso_turmas').delete().eq('curso_id', cursoId);
      if (selected.length) {
        await supabase.from('curso_turmas').insert(selected.map((tid) => ({ curso_id: cursoId, turma_id: tid })));
      }
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
        <div>
          <label>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <label>Descrição</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </div>
        <div>
          <label>Turmas com acesso</label>
          {turmas.length === 0 ? <p className="meta">Crie uma turma antes</p> : (
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
