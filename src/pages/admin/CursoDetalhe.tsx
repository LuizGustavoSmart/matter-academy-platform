import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink, PlayCircle, Users, Calendar, Clock, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Modal, Empty, Toast, ProgressBar } from '../../components/ui';
import { getYouTubeId } from '../../lib/youtube';

type Turma = { id: string; nome: string };
type Curso = { id: string; titulo: string; descricao: string | null };
type Aula = { id: string; curso_id: string; titulo: string; descricao: string | null; youtube_url: string; ordem: number };
type Aluno = { id: string; email: string; concluidas: number; total: number };
type Tab = 'dashboard' | 'aulas' | 'alunos';

export default function CursoDetalhe() {
  const { turmaId, cursoId } = useParams<{ turmaId: string; cursoId: string }>();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [turma, setTurma] = useState<Turma | null>(null);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editCursoOpen, setEditCursoOpen] = useState(false);

  // Dashboard
  const [dashLoading, setDashLoading] = useState(true);
  const [aulaCount, setAulaCount] = useState(0);
  const [alunosCount, setAlunosCount] = useState(0);

  // Aulas tab
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [aulasLoading, setAulasLoading] = useState(false);
  const [createAulaOpen, setCreateAulaOpen] = useState(false);
  const [editAula, setEditAula] = useState<Aula | null>(null);

  // Alunos tab
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunosLoading, setAlunosLoading] = useState(false);

  const loadBase = async () => {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('turmas').select('id,nome').eq('id', turmaId!).maybeSingle(),
      supabase.from('cursos').select('*').eq('id', cursoId!).maybeSingle(),
    ]);
    setTurma(t);
    setCurso(c);
  };

  const loadDashboard = async () => {
    setDashLoading(true);
    const [{ data: as }, { data: utData }] = await Promise.all([
      supabase.from('aulas').select('id').eq('curso_id', cursoId!),
      supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!),
    ]);
    setAulaCount((as ?? []).length);
    // Contar apenas alunos (role=student)
    const userIds = (utData ?? []).map((r) => r.user_id);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id,role').in('id', userIds);
      setAlunosCount((profiles ?? []).filter((p) => p.role === 'student').length);
    } else {
      setAlunosCount(0);
    }
    setDashLoading(false);
  };

  const loadAulas = async () => {
    setAulasLoading(true);
    const { data } = await supabase.from('aulas').select('*').eq('curso_id', cursoId!).order('ordem');
    setAulas(data ?? []);
    setAulasLoading(false);
  };

  const loadAlunos = async () => {
    setAlunosLoading(true);
    // Busca alunos da turma
    const { data: utData } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId!);
    const userIds = (utData ?? []).map((r) => r.user_id);

    if (userIds.length === 0) { setAlunos([]); setAlunosLoading(false); return; }

    const { data: profiles } = await supabase.from('profiles').select('id,email,role').in('id', userIds);
    const students = (profiles ?? []).filter((p) => p.role === 'student');

    if (students.length === 0) { setAlunos([]); setAlunosLoading(false); return; }

    // Busca todas as aulas do curso
    const { data: aulasData } = await supabase.from('aulas').select('id').eq('curso_id', cursoId!);
    const aulaIds = (aulasData ?? []).map((a) => a.id);
    const total = aulaIds.length;

    // Busca progresso de todos os alunos nessas aulas
    const studentIds = students.map((s) => s.id);
    const { data: prog } = total > 0
      ? await supabase.from('progresso').select('user_id,aula_id,concluido').in('user_id', studentIds).in('aula_id', aulaIds).eq('concluido', true)
      : { data: [] };

    const doneMap: Record<string, number> = {};
    (prog ?? []).forEach((p) => { doneMap[p.user_id] = (doneMap[p.user_id] ?? 0) + 1; });

    setAlunos(students.map((s) => ({ id: s.id, email: s.email, concluidas: doneMap[s.id] ?? 0, total })));
    setAlunosLoading(false);
  };

  useEffect(() => { loadBase(); loadDashboard(); }, [turmaId, cursoId]);
  useEffect(() => { if (tab === 'aulas') loadAulas(); }, [tab, cursoId]);
  useEffect(() => { if (tab === 'alunos') loadAlunos(); }, [tab, turmaId, cursoId]);

  const delAula = async (a: Aula) => {
    if (!confirm(`Excluir aula "${a.titulo}"?`)) return;
    const { error } = await supabase.from('aulas').delete().eq('id', a.id);
    if (error) setToast(error.message);
    else { setToast('Aula excluída'); loadAulas(); loadDashboard(); }
  };

  const moveAula = async (a: Aula, dir: -1 | 1) => {
    const idx = aulas.findIndex((x) => x.id === a.id);
    const other = aulas[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from('aulas').update({ ordem: other.ordem }).eq('id', a.id),
      supabase.from('aulas').update({ ordem: a.ordem }).eq('id', other.id),
    ]);
    loadAulas();
  };

  const delCurso = async () => {
    if (!confirm(`Excluir curso "${curso?.titulo}"? Todas as aulas serão removidas.`)) return;
    const { error } = await supabase.from('cursos').delete().eq('id', cursoId!);
    if (error) setToast(error.message);
    else nav(`/admin/turmas/${turmaId}`);
  };

  const maxOrdem = useMemo(() => aulas.reduce((m, a) => Math.max(m, a.ordem), 0), [aulas]);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#d6deed] mb-6 flex-wrap">
        <button onClick={() => nav('/admin/turmas')} className="hover:text-white transition-colors">Turmas</button>
        <ChevronRight className="w-4 h-4 text-[#434d5e]" />
        <button onClick={() => nav(`/admin/turmas/${turmaId}`)} className="hover:text-white transition-colors">{turma?.nome ?? '...'}</button>
        <ChevronRight className="w-4 h-4 text-[#434d5e]" />
        <span className="text-white">{curso?.titulo ?? '...'}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1>{curso?.titulo ?? '...'}</h1>
          <p className="meta mt-1">{curso?.descricao || '—'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditCursoOpen(true)}>Editar</Button>
          <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={delCurso}>Excluir</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1c1f26]">
        {([
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'aulas', label: 'Aulas' },
          { key: 'alunos', label: 'Alunos' },
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<PlayCircle className="w-5 h-5 text-[#cbfb00]" />} label="Aulas" value={String(aulaCount)} />
              <StatCard icon={<Users className="w-5 h-5 text-[#cbfb00]" />} label="Alunos matriculados" value={String(alunosCount)} />
              <InfoCard icon={<Calendar className="w-4 h-4" />} label="Data de início" placeholder />
              <InfoCard icon={<Calendar className="w-4 h-4" />} label="Data de fim" placeholder />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoCard icon={<GraduationCap className="w-4 h-4" />} label="Professor responsável" placeholder />
              <InfoCard icon={<Clock className="w-4 h-4" />} label="Horário das aulas" placeholder />
              <InfoCard icon={<Clock className="w-4 h-4" />} label="Dia da semana" placeholder />
            </div>
          </div>
        )
      )}

      {/* ── AULAS ── */}
      {tab === 'aulas' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="meta">Aulas deste curso</p>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateAulaOpen(true)}>Nova aula</Button>
          </div>

          {aulasLoading ? <p className="meta">Carregando...</p> :
            aulas.length === 0 ? <Empty title="Nenhuma aula" description="Adicione a primeira aula deste curso" /> : (
              <Card>
                <ul>
                  {aulas.map((a, i) => {
                    const ytId = getYouTubeId(a.youtube_url);
                    return (
                      <li key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-[#1c1f26] last:border-0 hover:bg-[#111]">
                        <div className="w-20 h-11 rounded bg-black overflow-hidden flex-shrink-0 border border-[#1c1f26]">
                          {ytId && <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{a.ordem}. {a.titulo}</p>
                          <p className="meta truncate">{a.descricao || '—'}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" onClick={() => moveAula(a, -1)} disabled={i === 0} icon={<ArrowUp className="w-4 h-4" />} />
                          <Button variant="ghost" onClick={() => moveAula(a, 1)} disabled={i === aulas.length - 1} icon={<ArrowDown className="w-4 h-4" />} />
                          {a.youtube_url && (
                            <a href={a.youtube_url} target="_blank" rel="noopener" className="inline-flex items-center justify-center px-3 py-2 rounded-md text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <Button variant="ghost" onClick={() => setEditAula(a)} icon={<Pencil className="w-4 h-4" />} />
                          <Button variant="danger" onClick={() => delAula(a)} icon={<Trash2 className="w-4 h-4" />} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
        </div>
      )}

      {/* ── ALUNOS ── */}
      {tab === 'alunos' && (
        <div>
          <p className="meta mb-4">Progresso dos alunos neste curso</p>
          {alunosLoading ? <p className="meta">Carregando...</p> :
            alunos.length === 0 ? <Empty title="Nenhum aluno nesta turma" /> : (
              <Card>
                <ul>
                  {alunos.map((a) => {
                    const pct = a.total > 0 ? Math.round((a.concluidas / a.total) * 100) : 0;
                    return (
                      <li key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-[#1c1f26] last:border-0">
                        <div className="w-8 h-8 rounded-full bg-[#1c1f26] flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-[#434d5e]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{a.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <ProgressBar value={pct} />
                            <span className="text-xs text-[#d6deed] whitespace-nowrap">{a.concluidas}/{a.total} aulas</span>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-[#cbfb00]">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
        </div>
      )}

      {/* Modais */}
      <CursoEditModal
        open={editCursoOpen}
        curso={curso}
        onClose={() => setEditCursoOpen(false)}
        onDone={() => { setEditCursoOpen(false); loadBase(); }}
      />
      <AulaModal
        open={createAulaOpen}
        aula={null}
        cursoId={cursoId!}
        nextOrdem={maxOrdem + 1}
        onClose={() => setCreateAulaOpen(false)}
        onDone={() => { setCreateAulaOpen(false); loadAulas(); loadDashboard(); }}
      />
      <AulaModal
        open={!!editAula}
        aula={editAula}
        cursoId={cursoId!}
        nextOrdem={maxOrdem + 1}
        onClose={() => setEditAula(null)}
        onDone={() => { setEditAula(null); loadAulas(); }}
      />
      <Toast message={toast} />
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-[#cbfb00]/10 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-[#d6deed]">{label}</p>
      </div>
    </Card>
  );
}

function InfoCard({ icon, label, value, placeholder }: { icon: React.ReactNode; label: string; value?: string; placeholder?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2 text-[#434d5e]">{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
      <p className={`text-sm font-medium ${placeholder ? 'text-[#434d5e] italic' : 'text-white'}`}>
        {placeholder ? 'Em breve' : (value ?? '—')}
      </p>
    </Card>
  );
}

function CursoEditModal({ open, curso, onClose, onDone }: { open: boolean; curso: Curso | null; onClose: () => void; onDone: () => void }) {
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
    const { error } = await supabase.from('cursos').update({ titulo: titulo.trim(), descricao: descricao.trim() }).eq('id', curso!.id);
    setLoading(false);
    if (error) setErr(error.message);
    else onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar curso"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        <div><label>Título</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label>Descrição</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}

function AulaModal({ open, aula, cursoId, nextOrdem, onClose, onDone }: {
  open: boolean; aula: Aula | null; cursoId: string; nextOrdem: number; onClose: () => void; onDone: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [url, setUrl] = useState('');
  const [ordem, setOrdem] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitulo(aula?.titulo ?? '');
    setDescricao(aula?.descricao ?? '');
    setUrl(aula?.youtube_url ?? '');
    setOrdem(aula?.ordem ?? nextOrdem);
    setErr(null);
  }, [aula, nextOrdem, open]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Título obrigatório'); return; }
    if (url && !getYouTubeId(url)) { setErr('URL do YouTube inválida'); return; }
    setLoading(true);
    const payload = { titulo: titulo.trim(), descricao: descricao.trim(), youtube_url: url.trim(), ordem, curso_id: cursoId };
    const { error } = aula
      ? await supabase.from('aulas').update(payload).eq('id', aula.id)
      : await supabase.from('aulas').insert(payload);
    setLoading(false);
    if (error) setErr(error.message);
    else onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={aula ? 'Editar aula' : 'Nova aula'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        <div><label>Título</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label>URL do YouTube</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
        <div><label>Ordem</label><input type="number" value={ordem} onChange={(e) => setOrdem(parseInt(e.target.value) || 1)} min={1} /></div>
        <div><label>Descrição</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
