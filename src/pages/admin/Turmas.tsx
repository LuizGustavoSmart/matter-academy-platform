import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users as UsersIcon, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Modal, Empty, Toast } from '../../components/ui';

type Turma = { id: string; nome: string; descricao: string | null; created_at: string | null };

export default function AdminTurmas() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [counts, setCounts] = useState<Record<string, { alunos: number; cursos: number }>>({});
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState<Turma | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
    if (!confirm(`Excluir turma "${t.nome}"? Os vínculos com alunos e cursos serão removidos.`)) return;
    const { error } = await supabase.from('turmas').delete().eq('id', t.id);
    if (error) setToast(error.message);
    else { setToast('Turma excluída'); load(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Turmas</h1>
          <p className="meta mt-1">Organize alunos e cursos em grupos de acesso</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Nova turma</Button>
      </div>

      {loading ? <p className="meta">Carregando...</p> :
        turmas.length === 0 ? <Empty title="Nenhuma turma criada" description="Crie sua primeira turma para começar" /> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {turmas.map((t) => (
              <Card key={t.id} className="p-5">
                <h3 className="mb-1">{t.nome}</h3>
                <p className="text-sm mb-4 line-clamp-2 min-h-[40px]">{t.descricao || '—'}</p>
                <div className="flex items-center gap-4 mb-4">
                  <span className="flex items-center gap-1 text-sm text-[#d6deed]"><UsersIcon className="w-4 h-4 text-[#434d5e]" /> {counts[t.id]?.alunos ?? 0} alunos</span>
                  <span className="flex items-center gap-1 text-sm text-[#d6deed]"><BookOpen className="w-4 h-4 text-[#434d5e]" /> {counts[t.id]?.cursos ?? 0} cursos</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditOpen(t)}>Editar</Button>
                  <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => del(t)} />
                </div>
              </Card>
            ))}
          </div>
        )}

      <TurmaModal open={createOpen} turma={null} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); }} />
      <TurmaModal open={!!editOpen} turma={editOpen} onClose={() => setEditOpen(null)} onDone={() => { setEditOpen(null); load(); }} />

      <Toast message={toast} tone="default" />
    </div>
  );
}

function TurmaModal({ open, turma, onClose, onDone }: { open: boolean; turma: Turma | null; onClose: () => void; onDone: () => void }) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNome(turma?.nome ?? '');
    setDescricao(turma?.descricao ?? '');
    setErr(null);
  }, [turma, open]);

  const submit = async () => {
    setErr(null);
    if (!nome.trim()) { setErr('Nome obrigatório'); return; }
    setLoading(true);
    const payload = { nome: nome.trim(), descricao: descricao.trim() };
    const { error } = turma
      ? await supabase.from('turmas').update(payload).eq('id', turma.id)
      : await supabase.from('turmas').insert(payload);
    setLoading(false);
    if (error) setErr(error.message);
    else onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={turma ? 'Editar turma' : 'Nova turma'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Salvar</Button>
        </>
      }>
      <div className="space-y-4">
        <div>
          <label>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label>Descrição</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
