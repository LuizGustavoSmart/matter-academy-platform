import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Modal, Empty, Toast } from '../../components/ui';
import { getYouTubeId } from '../../lib/youtube';

type Aula = { id: string; curso_id: string; titulo: string; descricao: string; youtube_url: string; ordem: number };
type Curso = { id: string; titulo: string; turmasLabel: string };

export default function AdminAulas() {
  const [params, setParams] = useSearchParams();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [cursoId, setCursoId] = useState(params.get('curso') ?? '');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Aula | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: cs }, { data: ts }, { data: cts }] = await Promise.all([
        supabase.from('cursos').select('id,titulo'),
        supabase.from('turmas').select('id,nome'),
        supabase.from('curso_turmas').select('curso_id,turma_id'),
      ]);
      const turmaMap = new Map((ts ?? []).map((t) => [t.id, t.nome]));
      const byCurso: Record<string, string[]> = {};
      (cts ?? []).forEach((r) => {
        const nome = turmaMap.get(r.turma_id);
        if (!nome) return;
        if (!byCurso[r.curso_id]) byCurso[r.curso_id] = [];
        byCurso[r.curso_id].push(nome);
      });
      const list: Curso[] = (cs ?? []).map((c) => ({
        id: c.id,
        titulo: c.titulo,
        turmasLabel: (byCurso[c.id] ?? []).sort().join(', '),
      }));
      list.sort((a, b) => {
        const la = `${a.turmasLabel} - ${a.titulo}`.toLowerCase();
        const lb = `${b.turmasLabel} - ${b.titulo}`.toLowerCase();
        return la.localeCompare(lb);
      });
      setCursos(list);
      if (!cursoId && list.length) {
        setCursoId(list[0].id);
        setParams({ curso: list[0].id }, { replace: true });
      }
    })();
  }, []);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Aulas</h1>
          <p className="meta mt-1">Gerencie o conteúdo dos cursos</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)} disabled={!cursoId}>Nova aula</Button>
      </div>

      <Card className="p-4 mb-4">
        <label>Curso</label>
        <select value={cursoId} onChange={(e) => { setCursoId(e.target.value); setParams({ curso: e.target.value }, { replace: true }); }}>
          <option value="">Selecione um curso</option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.turmasLabel ? `${c.turmasLabel} - ${c.titulo}` : c.titulo}
            </option>
          ))}
        </select>
      </Card>

      {!cursoId ? <Empty title="Selecione um curso" /> :
        loading ? <p className="meta">Carregando...</p> :
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
                      <Button variant="ghost" onClick={() => move(a, -1)} disabled={i === 0} icon={<ArrowUp className="w-4 h-4" />} />
                      <Button variant="ghost" onClick={() => move(a, 1)} disabled={i === aulas.length - 1} icon={<ArrowDown className="w-4 h-4" />} />
                      {a.youtube_url && (
                        <a href={a.youtube_url} target="_blank" rel="noopener" className="inline-flex items-center justify-center px-3 py-2 rounded-md text-[#d6deed] hover:bg-[#434d5e]/20 transition-colors">
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

      <AulaModal open={createOpen} aula={null} cursoId={cursoId} nextOrdem={maxOrdem + 1} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); loadAulas(); }} />
      <AulaModal open={!!editOpen} aula={editOpen} cursoId={cursoId} nextOrdem={maxOrdem + 1} onClose={() => setEditOpen(null)} onDone={() => { setEditOpen(null); loadAulas(); }} />

      <Toast message={toast} />
    </div>
  );
}

function AulaModal({ open, aula, cursoId, nextOrdem, onClose, onDone }: {
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
    <Modal open={open} onClose={onClose} title={aula ? 'Editar aula' : 'Nova aula'}
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
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
