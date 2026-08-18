import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAtividadeFile } from '../../lib/storage';
import { Button, Modal, Field, Input, Textarea, Select, Switch, Alert } from '../../components/ui';

const AULAS_POR_FAIXA = 12;

type Aula = { id: string; titulo: string };
export type AtividadeEditavel = {
  id: string; titulo: string; descricao: string | null; aula_id: string | null;
  nota_maxima: number; prazo: string | null; anexo_url: string | null; anexo_nome: string | null;
  avaliada_com_nota?: boolean; ordem?: number;
};

export default function CriarAtividadeModal({
  open, turmaId, cursoId, atividade, onClose, onDone,
}: {
  open: boolean; turmaId: string; cursoId: string; atividade?: AtividadeEditavel | null; onClose: () => void; onDone: () => void;
}) {
  const { profile } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [aulaId, setAulaId] = useState('');
  const [posicao, setPosicao] = useState(1);
  const [avaliadaComNota, setAvaliadaComNota] = useState(true);
  const [notaMaxima, setNotaMaxima] = useState(10);
  const [prazo, setPrazo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isEdit = !!atividade;

  useEffect(() => {
    if (!open) return;
    setTitulo(atividade?.titulo ?? ''); setDescricao(atividade?.descricao ?? ''); setAulaId(atividade?.aula_id ?? '');
    setPosicao(atividade?.ordem || 1);
    setAvaliadaComNota(atividade?.avaliada_com_nota ?? true);
    setNotaMaxima(atividade?.nota_maxima ?? 10);
    setPrazo(atividade?.prazo ? toDatetimeLocal(atividade.prazo) : '');
    setFile(null); setErr(null);
    supabase.from('aulas').select('id,titulo').eq('curso_id', cursoId).order('ordem').then(({ data }) => setAulas(data ?? []));
  }, [open, cursoId, atividade]);

  const submit = async () => {
    setErr(null);
    if (!titulo.trim()) { setErr('Informe o título da atividade.'); return; }
    if (!profile) return;
    setLoading(true);
    try {
      let anexo_url = atividade?.anexo_url ?? null;
      let anexo_nome = atividade?.anexo_nome ?? null;
      if (file) { const up = await uploadAtividadeFile(file, `atividades/${turmaId}/${cursoId}`); anexo_url = up.path; anexo_nome = up.nome; }
      const payload = {
        aula_id: aulaId || null, titulo: titulo.trim(), descricao: descricao.trim(),
        anexo_url, anexo_nome, avaliada_com_nota: avaliadaComNota, nota_maxima: notaMaxima, prazo: prazo ? new Date(prazo).toISOString() : null,
        // Curso sem aulas: a posição escolhida (Atividade 1, 2...) define a ordem, já que não há aula para vincular.
        ...(aulas.length === 0 ? { ordem: posicao } : {}),
      };
      // avaliada_com_nota ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { error } = isEdit
        ? await sb.from('atividades').update(payload).eq('id', atividade!.id)
        : await sb.from('atividades').insert({ ...payload, turma_id: turmaId, curso_id: cursoId, professor_id: profile.id });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar atividade' : 'Criar atividade'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>{isEdit ? 'Salvar' : 'Criar'}</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Título" required htmlFor="ca-tit"><Input id="ca-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} data-autofocus /></Field>
        <Field label="Descrição" htmlFor="ca-desc"><Textarea id="ca-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></Field>
        {aulas.length > 0 ? (
          <Field label="Aula relacionada" hint="Opcional" htmlFor="ca-aula">
            <Select id="ca-aula" value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
              <option value="">Nenhuma</option>
              {aulas.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Posição da atividade" hint="Este curso não tem aulas — escolha a posição para manter a ordem correta" htmlFor="ca-posicao">
            <Select id="ca-posicao" value={posicao} onChange={(e) => setPosicao(parseInt(e.target.value, 10) || 1)}>
              {Array.from({ length: AULAS_POR_FAIXA }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Atividade {n}</option>)}
            </Select>
          </Field>
        )}

        <div className="flex items-center gap-3 rounded-lg border border-line bg-panel-3/30 p-3">
          <Switch checked={avaliadaComNota} onChange={setAvaliadaComNota} />
          <div className="min-w-0">
            <p className="text-sm text-fg font-medium">Avaliar com nota</p>
            <p className="text-fg-3 text-xs mt-0.5">Se desativado, o professor só poderá marcar como revisada, sem atribuir nota.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {avaliadaComNota && <Field label="Nota máxima" htmlFor="ca-nota"><Input id="ca-nota" type="number" value={notaMaxima} onChange={(e) => setNotaMaxima(parseFloat(e.target.value) || 10)} min={1} /></Field>}
          <Field label="Prazo" hint="Opcional" htmlFor="ca-prazo"><Input id="ca-prazo" type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Field>
        </div>
        <Field label="Anexo" hint={isEdit && atividade?.anexo_nome ? `Atual: ${atividade.anexo_nome} — selecione outro para substituir` : 'Opcional — PDF, imagem'} htmlFor="ca-file">
          <Input id="ca-file" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="!py-2" />
        </Field>
      </div>
    </Modal>
  );
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
