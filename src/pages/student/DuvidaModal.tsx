import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadDuvidaFile } from '../../lib/storage';
import { Button, Modal, Field, Input, Textarea, Alert } from '../../components/ui';

export default function DuvidaModal({
  open, aulaId, cursoId, onClose, onDone,
}: {
  open: boolean; aulaId: string; cursoId: string; onClose: () => void; onDone: () => void;
}) {
  const { profile } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (open) { setTitulo(''); setDescricao(''); setFile(null); setErr(null); } }, [open]);

  const resolveTurmaId = async (): Promise<string | null> => {
    if (!profile) return null;
    const { data: own } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id).eq('curso_id', cursoId).limit(1).maybeSingle();
    if (own?.turma_id) return own.turma_id;
    const { data: minhasTurmas } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
    const turmaIds = [...new Set((minhasTurmas ?? []).map((r) => r.turma_id))];
    if (!turmaIds.length) return null;
    const { data: cts } = await supabase.from('curso_turmas').select('turma_id').eq('curso_id', cursoId).in('turma_id', turmaIds);
    return cts?.[0]?.turma_id ?? null;
  };

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Informe um título para a dúvida.'); return; }
    if (!profile) return;
    setLoading(true);
    try {
      const turmaId = await resolveTurmaId();
      if (!turmaId) { setErr('Não foi possível identificar sua turma para este curso.'); setLoading(false); return; }
      let anexo_url: string | null = null;
      let anexo_nome: string | null = null;
      if (file) {
        const up = await uploadDuvidaFile(file, `${turmaId}/${cursoId}/${profile.id}`);
        anexo_url = up.path; anexo_nome = up.nome;
      }
      const { error } = await supabase.from('duvidas').insert({
        aula_id: aulaId, curso_id: cursoId, turma_id: turmaId, aluno_id: profile.id,
        titulo: titulo.trim(), descricao: descricao.trim(), anexo_url, anexo_nome,
      });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Tirar dúvida"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Enviar dúvida</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Título" required htmlFor="dv-tit"><Input id="dv-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Resumo da sua dúvida" data-autofocus /></Field>
        <Field label="Descrição" htmlFor="dv-desc"><Textarea id="dv-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} placeholder="Explique com mais detalhes…" /></Field>
        <Field label="Anexo" hint="Opcional — PDF, print, etc." htmlFor="dv-file"><Input id="dv-file" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="!py-2" /></Field>
      </div>
    </Modal>
  );
}
