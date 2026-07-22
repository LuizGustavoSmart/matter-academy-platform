import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Modal, Empty, Toast } from '../../components/ui';
import { getYouTubeId } from '../../lib/youtube';

type Aula = { id: string; curso_id: string; titulo: string; descricao: string | null; youtube_url: string; ordem: number };
type Turma = { id: string; nome: string };
type Curso = { id: string; titulo: string };

export default function AdminCursoAulas() {
  const { turmaId, cursoId } = useParams<{ turmaId: string; cursoId: string }>();
  const nav = useNavigate();
  const [turma, setTurma] = useState<Turma | null>(null);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Aula | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from('turmas').select('id,nome').eq('id', turmaId!).maybeSingle(),
        supabase.from('cursos').select('id,titulo').eq('id', cursoId!).maybeSingle(),
      ]);
      setTurma(t);
      setCurso(c);
    })();
  }, [turmaId, cursoId]);

  const loadAulas = async () => {
    if (!cursoId) return;
    setLoading(true);
    const { data } = await supabase.from('aulas').select('*').eq('curso_id', cursoId).order('ordem');
    setAulas(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAulas(); }, [cursoId]);

  const del = async (a: Aula) => {
    if (!confirm(`Excluir aula "${a.titulo}"?`)) return;
    const { error } = await supabase.from('aulas').delete().eq('id', a.id);
    if (error) setToast(error.message);
    else { setToast('Aula excluída'); loadAulas(); }
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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-fg-2 mb-6 flex-wrap">
        <button onClick={() => nav('/admin/turmas')} className="hover:text-fg transition-colors">
          Turmas
        </button>
        <ChevronRight className="w-4 h-4 text-fg-3" />
        <button onClick={() => nav(`/admin/turmas/${turmaId}/cursos`)} className="hover:text-fg transition-colors">
          {turma?.nome ?? '...'}
        </button>
        <ChevronRight className="w-4 h-4 text-fg-3" />
        <span className="text-fg">{curso?.titulo ?? '...'}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Aulas — {curso?.titulo ?? '...'}</h1>
          <p className="meta mt-1">Gerencie as aulas deste curso</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Nova aula
        </Button>
      </div>

      {loading ? (
        <p className="meta">Carregando...</p>
      ) : aulas.length === 0 ? (
        <Empty title="Nenhuma aula" description="Adicione a primeira aula deste curso" />
      ) : (
        <Card>
          <ul>
            {aulas.map((a, i) => {
              const ytId = getYouTubeId(a.youtube_url);
              return (
                <li key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2 transition-colors">
                  <div className="w-20 h-11 rounded bg-black overflow-hidden flex-shrink-0 border border-line">
                    {ytId && <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-fg text-sm font-medium truncate">{a.ordem}. {a.titulo}</p>
                    <p className="meta truncate">{a.descricao || '—'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" onClick={() => move(a, -1)} disabled={i === 0} icon={<ArrowUp className="w-4 h-4" />} />
                    <Button variant="ghost" onClick={() => move(a, 1)} disabled={i === aulas.length - 1} icon={<ArrowDown className="w-4 h-4" />} />
                    {a.youtube_url && (
                      <a
                        href={a.youtube_url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center justify-center px-3 py-2 rounded-md text-fg-2 hover:bg-panel-3 hover:text-fg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <Button variant="ghost" onClick={() => setEditOpen(a)} icon={<Pencil className="w-4 h-4" />} />
                    <Button variant="danger" onClick={() => del(a)} icon={<Trash2 className="w-4 h-4" />} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <AulaModal
        open={createOpen}
        aula={null}
        cursoId={cursoId!}
        nextOrdem={maxOrdem + 1}
        onClose={() => setCreateOpen(false)}
        onDone={() => { setCreateOpen(false); loadAulas(); }}
      />
      <AulaModal
        open={!!editOpen}
        aula={editOpen}
        cursoId={cursoId!}
        nextOrdem={maxOrdem + 1}
        onClose={() => setEditOpen(null)}
        onDone={() => { setEditOpen(null); loadAulas(); }}
      />

      <Toast message={toast} />
    </div>
  );
}

function AulaModal({
  open, aula, cursoId, nextOrdem, onClose, onDone,
}: {
  open: boolean; aula: Aula | null; cursoId: string; nextOrdem: number;
  onClose: () => void; onDone: () => void;
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
    <Modal
      open={open}
      onClose={onClose}
      title={aula ? 'Editar aula' : 'Nova aula'}
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
          <label>URL do YouTube</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
        </div>
        <div>
          <label>Ordem</label>
          <input type="number" value={ordem} onChange={(e) => setOrdem(parseInt(e.target.value) || 1)} min={1} />
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
