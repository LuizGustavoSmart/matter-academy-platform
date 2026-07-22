import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, PlayCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Modal, Empty, Toast } from '../../components/ui';

type Curso = { id: string; titulo: string; descricao: string | null };
type Turma = { id: string; nome: string };

export default function AdminTurmaCursos() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const nav = useNavigate();
  const [turma, setTurma] = useState<Turma | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [aulaCounts, setAulaCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Curso | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: t } = await supabase.from('turmas').select('id,nome').eq('id', turmaId!).maybeSingle();
    setTurma(t);

    const { data: cts } = await supabase.from('curso_turmas').select('curso_id').eq('turma_id', turmaId!);
    const cursoIds = (cts ?? []).map((r) => r.curso_id);

    if (cursoIds.length > 0) {
      const { data: cs } = await supabase.from('cursos').select('*').in('id', cursoIds).order('created_at', { ascending: false });
      setCursos(cs ?? []);
      const { data: as } = await supabase.from('aulas').select('curso_id').in('curso_id', cursoIds);
      const counts: Record<string, number> = {};
      (as ?? []).forEach((a) => { counts[a.curso_id] = (counts[a.curso_id] ?? 0) + 1; });
      setAulaCounts(counts);
    } else {
      setCursos([]);
      setAulaCounts({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [turmaId]);

  const del = async (c: Curso) => {
    if (!confirm(`Excluir curso "${c.titulo}"? Todas as aulas serão removidas.`)) return;
    const { error } = await supabase.from('cursos').delete().eq('id', c.id);
    if (error) setToast(error.message);
    else { setToast('Curso excluído'); load(); }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-fg-2 mb-6">
        <button onClick={() => nav('/admin/turmas')} className="hover:text-fg transition-colors">
          Turmas
        </button>
        <ChevronRight className="w-4 h-4 text-fg-3" />
        <span className="text-fg">{turma?.nome ?? '...'}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Cursos — {turma?.nome ?? '...'}</h1>
          <p className="meta mt-1">Gerencie os cursos desta turma</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Novo curso
        </Button>
      </div>

      {loading ? (
        <p className="meta">Carregando...</p>
      ) : cursos.length === 0 ? (
        <Empty title="Nenhum curso nesta turma" description="Crie o primeiro curso para esta turma" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cursos.map((c) => (
            <Card key={c.id} className="p-5">
              <h3 className="mb-1">{c.titulo}</h3>
              <p className="text-sm mb-4 line-clamp-2 min-h-[40px]">{c.descricao || '—'}</p>
              <div className="flex items-center gap-1 mb-4 text-sm text-fg-2">
                <PlayCircle className="w-4 h-4 text-fg-3" /> {aulaCounts[c.id] ?? 0} aulas
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link
                  to={`/admin/turmas/${turmaId}/cursos/${c.id}/aulas`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm border border-line-strong text-fg-2 hover:bg-panel-3 hover:text-fg transition-colors"
                >
                  Ver Aulas
                </Link>
                <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditOpen(c)}>
                  Editar
                </Button>
                <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => del(c)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <CursoModal
        open={createOpen}
        curso={null}
        turmaId={turmaId!}
        onClose={() => setCreateOpen(false)}
        onDone={() => { setCreateOpen(false); load(); }}
      />
      <CursoModal
        open={!!editOpen}
        curso={editOpen}
        turmaId={turmaId!}
        onClose={() => setEditOpen(null)}
        onDone={() => { setEditOpen(null); load(); }}
      />

      <Toast message={toast} />
    </div>
  );
}

function CursoModal({
  open, curso, turmaId, onClose, onDone,
}: {
  open: boolean; curso: Curso | null; turmaId: string; onClose: () => void; onDone: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitulo(curso?.titulo ?? '');
    setDescricao(curso?.descricao ?? '');
    setErr(null);
  }, [curso, open]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Título obrigatório'); return; }
    setLoading(true);
    const payload = { titulo: titulo.trim(), descricao: descricao.trim() };

    if (curso) {
      const { error } = await supabase.from('cursos').update(payload).eq('id', curso.id);
      if (error) { setErr(error.message); setLoading(false); return; }
    } else {
      const { data, error } = await supabase.from('cursos').insert(payload).select('id').maybeSingle();
      if (error || !data) { setErr(error?.message ?? 'Erro ao criar curso'); setLoading(false); return; }
      // Vincula automaticamente à turma atual
      await supabase.from('curso_turmas').insert({ curso_id: data.id, turma_id: turmaId });
    }

    setLoading(false);
    onDone();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={curso ? 'Editar curso' : 'Novo curso'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <label>Descrição</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </div>
        {err && <p className="text-danger text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
