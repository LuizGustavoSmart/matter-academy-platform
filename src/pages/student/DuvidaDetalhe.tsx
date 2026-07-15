import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Paperclip, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Badge, Toast } from '../../components/ui';
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
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin';

  const [duvida, setDuvida] = useState<Duvida | null>(null);
  const [aulaTitulo, setAulaTitulo] = useState('');
  const [alunoLabel, setAlunoLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [resposta, setResposta] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('duvidas').select('*').eq('id', duvidaId!).maybeSingle();
    setDuvida(data);
    setResposta(data?.resposta ?? '');
    if (data?.aula_id) {
      const { data: aula } = await supabase.from('aulas').select('titulo').eq('id', data.aula_id).maybeSingle();
      setAulaTitulo(aula?.titulo ?? '');
    }
    if (data?.aluno_id && (profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin')) {
      const { data: aluno } = await supabase.from('profiles').select('nome,email').eq('id', data.aluno_id).maybeSingle();
      setAlunoLabel(aluno?.nome || aluno?.email || '');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [duvidaId]);

  const responder = async () => {
    if (!duvida || !profile || !resposta.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('duvidas').update({
        resposta: resposta.trim(),
        status: 'resolvida',
        professor_id: profile.id,
        resolved_at: new Date().toISOString(),
      }).eq('id', duvida.id);
      if (error) throw error;
      setToast('Resposta enviada');
      await load();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-6 py-12"><p className="meta">Carregando...</p></div>;
  if (!duvida) return <div className="max-w-3xl mx-auto px-6 py-12"><p className="meta">Dúvida não encontrada</p></div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center gap-2 text-sm text-[#d6deed] mb-6 flex-wrap">
        <button onClick={() => nav('/duvidas')} className="hover:text-white transition-colors">Dúvidas</button>
        <ChevronRight className="w-4 h-4 text-[#434d5e]" />
        <span className="text-white">{duvida.titulo}</span>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="mb-2">{duvida.titulo}</h1>
          <p className="meta">
            {alunoLabel && <>{alunoLabel} · </>}
            Enviada em {new Date(duvida.created_at).toLocaleString('pt-BR')}
          </p>
        </div>
        <Badge tone={duvida.status === 'resolvida' ? 'success' : 'warn'}>{duvida.status === 'resolvida' ? 'Resolvida' : 'Aberta'}</Badge>
      </div>

      <Card className="p-6 mb-6 space-y-4">
        {duvida.descricao && <p className="text-[#d6deed] leading-relaxed whitespace-pre-line">{duvida.descricao}</p>}
        {duvida.anexo_url && (
          <FileLink bucket="duvidas" path={duvida.anexo_url} className="inline-flex items-center gap-2 text-sm text-[#cbfb00] hover:underline">
            <Paperclip className="w-4 h-4 inline mr-1" /> {duvida.anexo_nome ?? 'Anexo'}
          </FileLink>
        )}
        {aulaTitulo && (
          <div>
            <Button variant="secondary" icon={<PlayCircle className="w-4 h-4" />} onClick={() => nav(`/curso/${duvida.curso_id}?aula=${duvida.aula_id}`)}>
              Ver aula: {aulaTitulo}
            </Button>
          </div>
        )}
      </Card>

      {duvida.status === 'resolvida' ? (
        <Card className="p-6">
          <p className="meta mb-2">Resposta</p>
          <p className="text-[#d6deed] whitespace-pre-line">{duvida.resposta}</p>
        </Card>
      ) : isStaff ? (
        <Card className="p-6 space-y-4">
          <p className="meta">Responder e marcar como resolvida</p>
          <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={5} placeholder="Escreva a resposta para o aluno..." />
          <Button variant="primary" loading={saving} disabled={!resposta.trim()} onClick={responder}>Enviar resposta</Button>
        </Card>
      ) : (
        <p className="meta">Aguardando resposta do professor/monitor.</p>
      )}

      <Toast message={toast} />
    </div>
  );
}
