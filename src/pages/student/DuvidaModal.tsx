import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadDuvidaFile } from '../../lib/storage';
import { Button, Modal } from '../../components/ui';

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

  useEffect(() => {
    if (open) { setTitulo(''); setDescricao(''); setFile(null); setErr(null); }
  }, [open]);

  const resolveTurmaId = async (): Promise<string | null> => {
    if (!profile) return null;
    // Aluno: turma onde tem acesso a este curso específico
    const { data: own } = await supabase
      .from('user_turmas')
      .select('turma_id')
      .eq('user_id', profile.id)
      .eq('curso_id', cursoId)
      .limit(1)
      .maybeSingle();
    if (own?.turma_id) return own.turma_id;

    // Professor/monitor: turma dele que também tem esse curso vinculado
    const { data: minhasTurmas } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
    const turmaIds = [...new Set((minhasTurmas ?? []).map((r: any) => r.turma_id))];
    if (!turmaIds.length) return null;
    const { data: cts } = await supabase.from('curso_turmas').select('turma_id').eq('curso_id', cursoId).in('turma_id', turmaIds);
    return cts?.[0]?.turma_id ?? null;
  };

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Título obrigatório'); return; }
    if (!profile) return;
    setLoading(true);
    try {
      const turmaId = await resolveTurmaId();
      if (!turmaId) { setErr('Não foi possível identificar sua turma para este curso'); setLoading(false); return; }

      let anexo_url: string | null = null;
      let anexo_nome: string | null = null;
      if (file) {
        const up = await uploadDuvidaFile(file, `${turmaId}/${cursoId}/${profile.id}`);
        anexo_url = up.path;
        anexo_nome = up.nome;
      }

      const { error } = await supabase.from('duvidas').insert({
        aula_id: aulaId,
        curso_id: cursoId,
        turma_id: turmaId,
        aluno_id: profile.id,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        anexo_url,
        anexo_nome,
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
      title="Tirar dúvida"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Enviar dúvida</Button></>}
    >
      <div className="space-y-4">
        <div>
          <label>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Resumo da sua dúvida" />
        </div>
        <div>
          <label>Descrição</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} placeholder="Explique com mais detalhes..." />
        </div>
        <div>
          <label>Anexo (opcional — PDF, print, etc.)</label>
          <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}
