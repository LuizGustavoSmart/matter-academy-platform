import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAtividadeFile } from '../../lib/storage';
import { Button, Modal } from '../../components/ui';

type Aula = { id: string; titulo: string };

export default function CriarAtividadeModal({
  open, turmaId, cursoId, onClose, onDone,
}: {
  open: boolean; turmaId: string; cursoId: string; onClose: () => void; onDone: () => void;
}) {
  const { profile } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [aulaId, setAulaId] = useState('');
  const [notaMaxima, setNotaMaxima] = useState(10);
  const [prazo, setPrazo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitulo(''); setDescricao(''); setAulaId(''); setNotaMaxima(10); setPrazo(''); setFile(null); setErr(null);
    supabase.from('aulas').select('id,titulo').eq('curso_id', cursoId).order('ordem').then(({ data }) => setAulas(data ?? []));
  }, [open, cursoId]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Título obrigatório'); return; }
    if (!profile) return;
    setLoading(true);
    try {
      let anexo_url: string | null = null;
      let anexo_nome: string | null = null;
      if (file) {
        const up = await uploadAtividadeFile(file, `atividades/${turmaId}/${cursoId}`);
        anexo_url = up.path;
        anexo_nome = up.nome;
      }
      const { error } = await supabase.from('atividades').insert({
        turma_id: turmaId,
        curso_id: cursoId,
        aula_id: aulaId || null,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        anexo_url,
        anexo_nome,
        nota_maxima: notaMaxima,
        prazo: prazo ? new Date(prazo).toISOString() : null,
        professor_id: profile.id,
      });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar atividade"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Criar</Button></>}
    >
      <div className="space-y-4">
        <div><label>Título</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label>Descrição</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></div>
        <div>
          <label>Aula relacionada (opcional)</label>
          <select value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
            <option value="">Nenhuma</option>
            {aulas.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label>Nota máxima</label><input type="number" value={notaMaxima} onChange={(e) => setNotaMaxima(parseFloat(e.target.value) || 10)} min={1} /></div>
          <div><label>Prazo (opcional)</label><input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
        </div>
        <div>
          <label>Anexo (opcional)</label>
          <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
