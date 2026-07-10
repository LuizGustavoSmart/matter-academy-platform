import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Paperclip, PlayCircle, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAtividadeFile } from '../../lib/storage';
import { Button, Card, Badge, Toast } from '../../components/ui';

type Atividade = {
  id: string; turma_id: string; curso_id: string; aula_id: string | null;
  titulo: string; descricao: string | null; anexo_url: string | null; anexo_nome: string | null;
  nota_maxima: number; prazo: string | null;
};
type Envio = {
  id?: string; arquivo_url: string | null; arquivo_nome: string | null; enviado_em: string | null;
  nota: number | null; comentario_professor: string | null; corrigido_em: string | null;
};
type AlunoRow = { id: string; email: string; envio: Envio | null };

export default function AtividadeDetalhe() {
  const { atividadeId } = useParams<{ atividadeId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const isProfessor = profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin';

  const [atividade, setAtividade] = useState<Atividade | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Aluno
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Professor
  const [alunos, setAlunos] = useState<AlunoRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { nota: string; comentario: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const loadAtividade = async () => {
    const { data } = await supabase.from('atividades').select('*').eq('id', atividadeId!).maybeSingle();
    setAtividade(data);
    return data as Atividade | null;
  };

  const loadAluno = async (a: Atividade) => {
    if (!profile) return;
    const { data } = await supabase.from('atividade_envios').select('*').eq('atividade_id', a.id).eq('aluno_id', profile.id).maybeSingle();
    setEnvio(data ?? null);
  };

  const loadProfessor = async (a: Atividade) => {
    const { data: ut } = await supabase.from('user_turmas').select('user_id').eq('turma_id', a.turma_id).eq('curso_id', a.curso_id);
    const userIds = (ut ?? []).map((r: any) => r.user_id);
    if (!userIds.length) { setAlunos([]); return; }
    const { data: profiles } = await supabase.from('profiles').select('id,email,role').in('id', userIds);
    const students = (profiles ?? []).filter((p: any) => p.role === 'student');
    const { data: envios } = await supabase.from('atividade_envios').select('*').eq('atividade_id', a.id).in('aluno_id', students.map((s: any) => s.id));
    const envioMap = new Map((envios ?? []).map((e: any) => [e.aluno_id, e]));
    const rows: AlunoRow[] = students.map((s: any) => ({ id: s.id, email: s.email, envio: envioMap.get(s.id) ?? null }));
    setAlunos(rows);
    const d: Record<string, { nota: string; comentario: string }> = {};
    rows.forEach((r) => { d[r.id] = { nota: r.envio?.nota != null ? String(r.envio.nota) : '', comentario: r.envio?.comentario_professor ?? '' }; });
    setDrafts(d);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const a = await loadAtividade();
      if (a) {
        if (isProfessor) await loadProfessor(a);
        else await loadAluno(a);
      }
      setLoading(false);
    })();
  }, [atividadeId, profile]);

  const status = (() => {
    if (!atividade) return { label: '', tone: 'default' as const };
    if (envio?.corrigido_em) return { label: 'Corrigida', tone: 'success' as const };
    if (envio?.enviado_em) return { label: 'Enviada', tone: 'default' as const };
    if (atividade.prazo && new Date(atividade.prazo) < new Date()) return { label: 'Atrasada', tone: 'danger' as const };
    return { label: 'Não enviada', tone: 'warn' as const };
  })();

  const submitEnvio = async () => {
    if (!atividade || !profile || !file) return;
    setUploading(true);
    try {
      const up = await uploadAtividadeFile(file, `envios/${atividade.id}/${profile.id}`);
      const { error } = await supabase.from('atividade_envios').upsert(
        {
          atividade_id: atividade.id,
          aluno_id: profile.id,
          arquivo_url: up.url,
          arquivo_nome: up.nome,
          enviado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'atividade_id,aluno_id' }
      );
      if (error) throw error;
      setToast('Atividade enviada');
      setFile(null);
      await loadAluno(atividade);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const salvarNota = async (alunoId: string) => {
    if (!atividade) return;
    const draft = drafts[alunoId];
    setSaving(alunoId);
    try {
      const { error } = await supabase.from('atividade_envios').upsert(
        {
          atividade_id: atividade.id,
          aluno_id: alunoId,
          nota: draft.nota === '' ? null : parseFloat(draft.nota),
          comentario_professor: draft.comentario.trim() || null,
          corrigido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'atividade_id,aluno_id' }
      );
      if (error) throw error;
      setToast('Correção salva');
      await loadProfessor(atividade);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-12"><p className="meta">Carregando...</p></div>;
  if (!atividade) return <div className="max-w-4xl mx-auto px-6 py-12"><p className="meta">Atividade não encontrada</p></div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center gap-2 text-sm text-[#d6deed] mb-6 flex-wrap">
        <button onClick={() => nav('/atividades')} className="hover:text-white transition-colors">Atividades</button>
        <ChevronRight className="w-4 h-4 text-[#434d5e]" />
        <button onClick={() => nav(`/atividades/${atividade.turma_id}/${atividade.curso_id}`)} className="hover:text-white transition-colors">Voltar à lista</button>
        <ChevronRight className="w-4 h-4 text-[#434d5e]" />
        <span className="text-white">{atividade.titulo}</span>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="mb-2">{atividade.titulo}</h1>
          <p className="meta">Prazo: {atividade.prazo ? new Date(atividade.prazo).toLocaleString('pt-BR') : '-'} · Nota máxima: {atividade.nota_maxima}</p>
        </div>
        {!isProfessor && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>

      {atividade.descricao && <p className="text-[#d6deed] leading-relaxed mb-6 whitespace-pre-line">{atividade.descricao}</p>}

      {atividade.anexo_url && (
        <a href={atividade.anexo_url} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-sm text-[#cbfb00] hover:underline mb-6">
          <Paperclip className="w-4 h-4" /> {atividade.anexo_nome ?? 'Anexo do professor'}
        </a>
      )}

      {atividade.aula_id && (
        <div className="mb-8">
          <Button variant="secondary" icon={<PlayCircle className="w-4 h-4" />} onClick={() => nav(`/curso/${atividade.curso_id}?aula=${atividade.aula_id}`)}>
            Teve dúvida? Revise a aula por aqui.
          </Button>
        </div>
      )}

      {/* ── VISÃO ALUNO ── */}
      {!isProfessor && (
        <Card className="p-6">
          {envio?.corrigido_em ? (
            <div className="space-y-4">
              <div>
                <p className="meta mb-1">Sua nota</p>
                <p className="text-2xl font-bold text-[#cbfb00]">{envio.nota}/{atividade.nota_maxima}</p>
              </div>
              {envio.comentario_professor && (
                <div>
                  <p className="meta mb-1">Comentário do professor</p>
                  <p className="text-[#d6deed] whitespace-pre-line">{envio.comentario_professor}</p>
                </div>
              )}
              {envio.arquivo_url && (
                <a href={envio.arquivo_url} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-sm text-[#cbfb00] hover:underline">
                  <Paperclip className="w-4 h-4" /> {envio.arquivo_nome ?? 'Arquivo enviado'}
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {envio?.arquivo_url && (
                <a href={envio.arquivo_url} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-sm text-[#cbfb00] hover:underline">
                  <Paperclip className="w-4 h-4" /> {envio.arquivo_nome ?? 'Arquivo enviado'} (atual)
                </a>
              )}
              <div>
                <label>{envio ? 'Substituir arquivo' : 'Anexar documento (PDF, foto, etc.)'}</label>
                <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button variant="primary" icon={<Upload className="w-4 h-4" />} loading={uploading} disabled={!file} onClick={submitEnvio}>
                {envio ? 'Reenviar atividade' : 'Enviar atividade'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ── VISÃO PROFESSOR ── */}
      {isProfessor && (
        <div>
          <p className="meta mb-4">Respostas dos alunos</p>
          {alunos.length === 0 ? (
            <p className="meta">Nenhum aluno nesta turma/curso</p>
          ) : (
            <div className="space-y-4">
              {alunos.map((row) => {
                const draft = drafts[row.id] ?? { nota: '', comentario: '' };
                return (
                  <Card key={row.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="text-white text-sm font-medium">{row.email}</p>
                      {row.envio?.arquivo_url ? (
                        <a href={row.envio.arquivo_url} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-sm text-[#cbfb00] hover:underline flex-shrink-0">
                          <Paperclip className="w-4 h-4" /> {row.envio.arquivo_nome ?? 'Arquivo'}
                        </a>
                      ) : (
                        <span className="meta flex-shrink-0">Não enviado</span>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-[120px_1fr_auto] gap-3 items-start">
                      <div>
                        <label className="text-xs">Nota (máx. {atividade.nota_maxima})</label>
                        <input
                          type="number"
                          value={draft.nota}
                          onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: { ...d[row.id], nota: e.target.value } }))}
                          max={atividade.nota_maxima}
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="text-xs">Comentário (opcional)</label>
                        <input
                          value={draft.comentario}
                          onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: { ...d[row.id], comentario: e.target.value } }))}
                        />
                      </div>
                      <div className="flex items-end h-full">
                        <Button variant="primary" loading={saving === row.id} onClick={() => salvarNota(row.id)}>Salvar</Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}
