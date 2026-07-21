import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Paperclip, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Badge, Skeleton, EmptyState, Field, Textarea, useToast } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { FileLink } from '../../components/FileLink';

type Duvida = {
  id: string; aula_id: string; curso_id: string; titulo: string; descricao: string | null;
  anexo_url: string | null; anexo_nome: string | null; status: 'aberta' | 'resolvida';
  resposta: string | null; created_at: string; aluno_id: string;
};

export default function DuvidaDetalhe() {
  const { duvidaId } = useParams<{ duvidaId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin';

  const [duvida, setDuvida] = useState<Duvida | null>(null);
  const [aulaTitulo, setAulaTitulo] = useState('');
  const [alunoLabel, setAlunoLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [resposta, setResposta] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('duvidas').select('*').eq('id', duvidaId!).maybeSingle();
    setDuvida(data as Duvida | null);
    setResposta(data?.resposta ?? '');
    if (data?.aula_id) { const { data: aula } = await supabase.from('aulas').select('titulo').eq('id', data.aula_id).maybeSingle(); setAulaTitulo(aula?.titulo ?? ''); }
    if (data?.aluno_id && isStaff) { const { data: aluno } = await supabase.from('profiles').select('nome,email').eq('id', data.aluno_id).maybeSingle(); setAlunoLabel(aluno?.nome || aluno?.email || ''); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [duvidaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = async () => {
    if (!duvida || !profile || !resposta.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('duvidas').update({ resposta: resposta.trim(), status: 'resolvida', professor_id: profile.id, resolved_at: new Date().toISOString() }).eq('id', duvida.id);
      if (error) throw error;
      toast.success('Resposta enviada.'); await load();
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8"><Skeleton className="h-8 w-64 mb-6" /><Skeleton className="h-48 rounded-xl" /></div>;
  if (!duvida) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8"><EmptyState title="Dúvida não encontrada" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        breadcrumbs={[{ label: 'Dúvidas', to: '/duvidas' }, { label: duvida.titulo }]}
        title={duvida.titulo}
        subtitle={`${alunoLabel ? `${alunoLabel} · ` : ''}Enviada em ${new Date(duvida.created_at).toLocaleString('pt-BR')}`}
        actions={<Badge tone={duvida.status === 'resolvida' ? 'success' : 'warn'} dot>{duvida.status === 'resolvida' ? 'Resolvida' : 'Aberta'}</Badge>}
      />

      <Card className="p-6 mb-4 space-y-4">
        {duvida.descricao && <p className="text-fg-2 leading-relaxed whitespace-pre-line">{duvida.descricao}</p>}
        {duvida.anexo_url && <FileLink bucket="duvidas" path={duvida.anexo_url} className="inline-flex items-center gap-2 text-sm text-brand hover:underline"><Paperclip className="w-4 h-4" /> {duvida.anexo_nome ?? 'Anexo'}</FileLink>}
        {aulaTitulo && <div><Button variant="secondary" icon={<PlayCircle className="w-4 h-4" />} onClick={() => nav(`/curso/${duvida.curso_id}?aula=${duvida.aula_id}`)}>Ver aula: {aulaTitulo}</Button></div>}
      </Card>

      {duvida.status === 'resolvida' ? (
        <Card className="p-6"><p className="text-fg-3 text-xs mb-2">Resposta</p><p className="text-fg-2 whitespace-pre-line">{duvida.resposta}</p></Card>
      ) : isStaff ? (
        <Card className="p-6 space-y-4">
          <Field label="Responder e marcar como resolvida" htmlFor="dd-resp"><Textarea id="dd-resp" value={resposta} onChange={(e) => setResposta(e.target.value)} rows={5} placeholder="Escreva a resposta para o aluno…" data-autofocus /></Field>
          <Button variant="primary" loading={saving} disabled={!resposta.trim()} onClick={responder}>Enviar resposta</Button>
        </Card>
      ) : (
        <p className="text-fg-3 text-sm">Aguardando resposta do professor/monitor.</p>
      )}
    </div>
  );
}
