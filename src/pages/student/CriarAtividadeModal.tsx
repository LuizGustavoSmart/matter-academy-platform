import { useEffect, useState } from 'react';
import { callFn, supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAtividadeFile } from '../../lib/storage';
import { Button, Modal, Field, Input, Textarea, Select, Alert } from '../../components/ui';

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
    if (!titulo.trim()) { setErr('Informe o título da atividade.'); return; }
    if (!profile) return;
    setLoading(true);
    try {
      let anexo_url: string | null = null;
      let anexo_nome: string | null = null;
      if (file) { const up = await uploadAtividadeFile(file, `atividades/${turmaId}/${cursoId}`); anexo_url = up.path; anexo_nome = up.nome; }
      const { data: created, error } = await supabase.from('atividades').insert({
        turma_id: turmaId, curso_id: cursoId, aula_id: aulaId || null, titulo: titulo.trim(), descricao: descricao.trim(),
        anexo_url, anexo_nome, nota_maxima: notaMaxima, prazo: prazo ? new Date(prazo).toISOString() : null, professor_id: profile.id,
      }).select('id').single();
      if (error) throw error;
      if (created) void callFn('notifications', 'activity-created', { activity_id: created.id }).catch(() => undefined);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Criar atividade"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Criar</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Título" required htmlFor="ca-tit"><Input id="ca-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} data-autofocus /></Field>
        <Field label="Descrição" htmlFor="ca-desc"><Textarea id="ca-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></Field>
        <Field label="Aula relacionada" hint="Opcional" htmlFor="ca-aula">
          <Select id="ca-aula" value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
            <option value="">Nenhuma</option>
            {aulas.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nota máxima" htmlFor="ca-nota"><Input id="ca-nota" type="number" value={notaMaxima} onChange={(e) => setNotaMaxima(parseFloat(e.target.value) || 10)} min={1} /></Field>
          <Field label="Prazo" hint="Opcional" htmlFor="ca-prazo"><Input id="ca-prazo" type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Field>
        </div>
        <Field label="Anexo" hint="Opcional — PDF, imagem" htmlFor="ca-file"><Input id="ca-file" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="!py-2" /></Field>
      </div>
    </Modal>
  );
}
