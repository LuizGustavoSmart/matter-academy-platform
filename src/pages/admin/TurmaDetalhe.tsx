import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Pencil, Trash2, PlayCircle, Users, BookOpen, GraduationCap, Calendar, Building2, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Modal, Empty, Toast, Badge } from '../../components/ui';

type Turma = { id: string; nome: string; descricao: string | null; created_at: string | null };
type Curso = { id: string; titulo: string; descricao: string | null };
type Tab = 'dashboard' | 'cursos';

export default function TurmaDetalhe() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [turma, setTurma] = useState<Turma | null>(null);
  const [editTurmaOpen, setEditTurmaOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Dashboard
  const [dashLoading, setDashLoading] = useState(true);
  const [alunosCount, setAlunosCount] = useState(0);
  const [professoresCount, setProfessoresCount] = useState(0);
  const [cursosCount, setCursosCount] = useState(0);
  const [aulasPerCurso, setAulasPerCurso] = useState<{ titulo: string; count: number }[]>([]);

  // Cursos tab
  const [cursosLoading, setCursosLoading] = useState(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [aulaCounts, setAulaCounts] = useState<Record<string, number>>({});
  const [createCursoOpen, setCreateCursoOpen] = useState(false);
  const [editCurso, setEditCurso] = useState<Curso | null>(null);

  const loadDashboard = async () => {
    setDashLoading(true);
    const { data: t } = await supabase.from('turmas').select('*').eq('id', turmaId!).maybeSingle();
    setTurma(t);

    // Usuários da turma por role
    const { data: utData } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!);
    const userIds = (utData ?? []).map((r) => r.user_id);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id,role').in('id', userIds);
      setAlunosCount((profiles ?? []).filter((p) => p.role === 'student').length);
      setProfessoresCount((profiles ?? []).filter((p) => p.role === 'professor').length);
    } else {
      setAlunosCount(0);
      setProfessoresCount(0);
    }

    // Cursos e aulas
    const { data: cts } = await supabase.from('curso_turmas').select('curso_id').eq('turma_id', turmaId!);
    const cursoIds = (cts ?? []).map((r) => r.curso_id);
    setCursosCount(cursoIds.length);

    if (cursoIds.length > 0) {
      const [{ data: cs }, { data: as }] = await Promise.all([
        supabase.from('cursos').select('id,titulo').in('id', cursoIds),
        supabase.from('aulas').select('curso_id').in('curso_id', cursoIds),
      ]);
      const countMap: Record<string, number> = {};
      (as ?? []).forEach((a) => { countMap[a.curso_id] = (countMap[a.curso_id] ?? 0) + 1; });
      setAulasPerCurso((cs ?? []).map((c) => ({ titulo: c.titulo, count: countMap[c.id] ?? 0 })));
    } else {
      setAulasPerCurso([]);
    }

    setDashLoading(false);
  };

  const loadCursos = async () => {
    setCursosLoading(true);
    const { data: cts } = await supabase.from('curso_turmas').select('curso_id').eq('turma_id', turmaId!);
    const cursoIds = (cts ?? []).map((r) => r.curso_id);
    if (cursoIds.length > 0) {
      const [{ data: cs }, { data: as }] = await Promise.all([
        supabase.from('cursos').select('*').in('id', cursoIds).order('created_at', { ascending: false }),
        supabase.from('aulas').select('curso_id').in('curso_id', cursoIds),
      ]);
      setCursos(cs ?? []);
      const counts: Record<string, number> = {};
      (as ?? []).forEach((a) => { counts[a.curso_id] = (counts[a.curso_id] ?? 0) + 1; });
      setAulaCounts(counts);
    } else {
      setCursos([]);
      setAulaCounts({});
    }
    setCursosLoading(false);
  };

  useEffect(() => { loadDashboard(); }, [turmaId]);
  useEffect(() => { if (tab === 'cursos') loadCursos(); }, [tab, turmaId]);

  const delCurso = async (e: React.MouseEvent, c: Curso) => {
    e.stopPropagation();
    if (!confirm(`Excluir curso "${c.titulo}"? Todas as aulas serão removidas.`)) return;
    const { error } = await supabase.from('cursos').delete().eq('id', c.id);
    if (error) setToast(error.message);
    else { setToast('Curso excluído'); loadCursos(); loadDashboard(); }
  };

  const delTurma = async () => {
    if (!confirm(`Excluir turma "${turma?.nome}"? Os vínculos com alunos e cursos serão removidos.`)) return;
    const { error } = await supabase.from('turmas').delete().eq('id', turmaId!);
    if (error) setToast(error.message);
    else nav('/admin/turmas');
  };

  const totalAulas = aulasPerCurso.reduce((s, c) => s + c.count, 0);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#d6deed] mb-6">
        <button onClick={() => nav('/admin/turmas')} className="hover:text-white transition-colors">Turmas</button>
        <ChevronRight className="w-4 h-4 text-[#434d5e]" />
        <span className="text-white">{turma?.nome ?? '...'}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1>{turma?.nome ?? '...'}</h1>
          <p className="meta mt-1">{turma?.descricao || '—'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditTurmaOpen(true)}>Editar</Button>
          <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={delTurma}>Excluir</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1c1f26]">
        {([
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'cursos', label: 'Cursos' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-[#cbfb00] text-[#cbfb00]'
                : 'border-transparent text-[#d6deed] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        dashLoading ? <p className="meta">Carregando...</p> : (
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Users className="w-5 h-5 text-[#cbfb00]" />} label="Alunos" value={alunosCount} />
              <StatCard icon={<GraduationCap className="w-5 h-5 text-[#cbfb00]" />} label="Professores" value={professoresCount} />
              <StatCard icon={<BookOpen className="w-5 h-5 text-[#cbfb00]" />} label="Cursos" value={cursosCount} />
              <StatCard icon={<PlayCircle className="w-5 h-5 text-[#cbfb00]" />} label="Aulas (total)" value={totalAulas} />
            </div>

            {/* Info cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoCard icon={<Calendar className="w-4 h-4" />} label="Data de criação" value={turma?.created_at ? new Date(turma.created_at).toLocaleDateString('pt-BR') : '—'} />
              <InfoCard icon={<Building2 className="w-4 h-4" />} label="Empresa associada" value="—" placeholder />
              <InfoCard icon={<DollarSign className="w-4 h-4" />} label="Custos / Faturamento" value="—" placeholder />
            </div>

            {/* Aulas por curso */}
            {aulasPerCurso.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-[#d6deed] uppercase tracking-wider">Aulas por curso</h3>
                <Card>
                  <ul>
                    {aulasPerCurso.map((item, i) => (
                      <li key={i} className="flex items-center justify-between px-4 py-3 border-b border-[#1c1f26] last:border-0">
                        <span className="text-white text-sm">{item.titulo}</span>
                        <Badge>{item.count} aula{item.count !== 1 ? 's' : ''}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        )
      )}

      {/* ── CURSOS ── */}
      {tab === 'cursos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="meta">Cursos exclusivos desta turma</p>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateCursoOpen(true)}>Novo curso</Button>
          </div>

          {cursosLoading ? <p className="meta">Carregando...</p> :
            cursos.length === 0 ? <Empty title="Nenhum curso nesta turma" description="Crie o primeiro curso para esta turma" /> : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cursos.map((c) => (
                  <Card
                    key={c.id}
                    className="p-5 cursor-pointer hover:border-[#434d5e] transition-colors relative"
                    onClick={() => nav(`/admin/turmas/${turmaId}/cursos/${c.id}`)}
                  >
                    {/* Ícones de ação */}
                    <div className="absolute top-4 right-4 flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditCurso(c); }}
                        className="p-1.5 rounded text-[#d6deed] hover:bg-[#434d5e]/30 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => delCurso(e, c)}
                        className="p-1.5 rounded text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="mb-1 pr-16">{c.titulo}</h3>
                    <p className="text-sm mb-4 line-clamp-2 min-h-[40px]">{c.descricao || '—'}</p>
                    <div className="flex items-center gap-1 text-sm text-[#d6deed]">
                      <PlayCircle className="w-4 h-4 text-[#434d5e]" /> {aulaCounts[c.id] ?? 0} aulas
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Modais */}
      <TurmaEditModal
        open={editTurmaOpen}
        turma={turma}
        onClose={() => setEditTurmaOpen(false)}
        onDone={() => { setEditTurmaOpen(false); loadDashboard(); }}
      />
      <CursoModal
        open={createCursoOpen}
        curso={null}
        turmaId={turmaId!}
        onClose={() => setCreateCursoOpen(false)}
        onDone={() => { setCreateCursoOpen(false); loadCursos(); loadDashboard(); }}
      />
      <CursoModal
        open={!!editCurso}
        curso={editCurso}
        turmaId={turmaId!}
        onClose={() => setEditCurso(null)}
        onDone={() => { setEditCurso(null); loadCursos(); loadDashboard(); }}
      />
      <Toast message={toast} />
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-[#cbfb00]/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-[#d6deed]">{label}</p>
      </div>
    </Card>
  );
}

function InfoCard({ icon, label, value, placeholder }: { icon: React.ReactNode; label: string; value: string; placeholder?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2 text-[#434d5e]">{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
      <p className={`text-sm font-medium ${placeholder ? 'text-[#434d5e] italic' : 'text-white'}`}>
        {placeholder ? 'Em breve' : value}
      </p>
    </Card>
  );
}

function TurmaEditModal({ open, turma, onClose, onDone }: { open: boolean; turma: Turma | null; onClose: () => void; onDone: () => void }) {
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
    const { error } = await supabase.from('turmas').update({ nome: nome.trim(), descricao: descricao.trim() }).eq('id', turma!.id);
    setLoading(false);
    if (error) setErr(error.message);
    else onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar turma"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Salvar</Button>
        </>
      }>
      <div className="space-y-4">
        <div><label>Nome</label><input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><label>Descrição</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}

function CursoModal({ open, curso, turmaId, onClose, onDone }: {
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
      await supabase.from('curso_turmas').insert({ curso_id: data.id, turma_id: turmaId });
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
        <div><label>Título</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label>Descrição</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
