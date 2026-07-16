import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Paperclip, PlayCircle, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAtividadeFile } from '../../lib/storage';
import { Button, Card, Badge, Toast, Modal } from '../../components/ui';
import { FileLink } from '../../components/FileLink';

type Atividade = {
  id: string; turma_id: string; curso_id: string | null; aula_id: string | null;
  titulo: string; descricao: string | null; anexo_url: string | null; anexo_nome: string | null;
  nota_maxima: number; prazo: string | null;
};
type Envio = {
  id?: string; arquivo_url: string | null; arquivo_nome: string | null; texto: string | null; enviado_em: string | null;
  nota: number | null; comentario_professor: string | null; corrigido_em: string | null;
};
type AlunoRow = { id: string; email: string; nome: string | null; envio: Envio | null };

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
  const [texto, setTexto] = useState('');
  const [uploading, setUploading] = useState(false);

  // Professor
  const [alunos, setAlunos] = useState<AlunoRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { nota: string; comentario: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedAluno, setSelectedAluno] = useState<AlunoRow | null>(null);

  const loadAtividade = async () => {
    const { data } = await supabase.from('atividades').select('*').eq('id', atividadeId!).maybeSingle();
    setAtividade(data);
    return data as Atividade | null;
  };

  const loadAluno = async (a: Atividade) => {
    if (!profile) return;
    const { data } = await supabase.from('atividade_envios').select('*').eq('atividade_id', a.id).eq('aluno_id', profile.id).maybeSingle();
    setEnvio(data ?? null);
    setTexto(data?.texto ?? '');
  };

  const loadProfessor = async (a: Atividade) => {
    const { data: ut } = await supabase.from('user_turmas').select('user_id').eq('turma_id', a.turma_id).eq('curso_id', a.curso_id!);
    const userIds = (ut ?? []).map((r: any) => r.user_id);
    if (!userIds.length) { setAlunos([]); return; }
    const { data: profiles } = await supabase.from('profiles').select('id,email,nome,role').in('id', userIds);
    const students = (profiles ?? []).filter((p: any) => p.role === 'student');
    const { data: envios } = await supabase.from('atividade_envios').select('*').eq('atividade_id', a.id).in('aluno_id', students.map((s: any) => s.id));
    const envioMap = new Map((envios ?? []).map((e: any) => [e.aluno_id, e]));
    const rows: AlunoRow[] = students.map((s: any) => ({ id: s.id, email: s.email, nome: s.nome, envio: envioMap.get(s.id) ?? null }));
    setAlunos(rows);
    const d: Record<string, { nota: string; comentario: string }> = {};
    rows.forEach((r) => { d[r.id] = { nota: r.envio?.nota != null ? String(r.envio.nota) : '', comentario: r.envio?.comentario_professor ?? '' }; });
    setDrafts(d);
    setSelectedAluno((prev) => (prev ? rows.find((r) => r.id === prev.id) ?? null : null));
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
    if (!atividade || !profile) return;
    if (!file && !texto.trim()) return;
    setUploading(true);
    try {
      let arquivo_url = envio?.arquivo_url ?? null;
      let arquivo_nome = envio?.arquivo_nome ?? null;
      if (file) {
        const up = await uploadAtividadeFile(file, `envios/${atividade.id}/${profile.id}`);
        arquivo_url = up.path;
        arquivo_nome = up.nome;
      }
      const { error } = await supabase.from('atividade_envios').upsert(
        {
          atividade_id: atividade.id,
          aluno_id: profile.id,
          arquivo_url,
          arquivo_nome,
          texto: texto.trim() || null,
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
        <FileLink bucket="atividades" path={atividade.anexo_url} className="inline-flex items-center gap-2 text-sm text-[#cbfb00] hover:underline mb-6">
          <Paperclip className="w-4 h-4 inline mr-1" /> {atividade.anexo_nome ?? 'Anexo do professor'}
        </FileLink>
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
              {envio.texto && (
                <div>
                  <p className="meta mb-1">Sua resposta</p>
                  <p className="text-[#d6deed] whitespace-pre-line">{envio.texto}</p>
                </div>
              )}
              {envio.arquivo_url && (
                <FileLink bucket="atividades" path={envio.arquivo_url} className="inline-flex items-center gap-2 text-sm text-[#cbfb00] hover:underline">
                  <Paperclip className="w-4 h-4 inline mr-1" /> {envio.arquivo_nome ?? 'Arquivo enviado'}
                </FileLink>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {envio?.arquivo_url && (
                <FileLink bucket="atividades" path={envio.arquivo_url} className="inline-flex items-center gap-2 text-sm text-[#cbfb00] hover:underline">
                  <Paperclip className="w-4 h-4 inline mr-1" /> {envio.arquivo_nome ?? 'Arquivo enviado'} (atual)
                </FileLink>
              )}
              <div>
                <label>Resposta (opcional)</label>
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Escreva sua resposta aqui..." />
              </div>
              <div>
                <label>{envio ? 'Substituir arquivo (opcional)' : 'Anexar documento (opcional — PDF, foto, etc.)'}</label>
                <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button variant="primary" icon={<Upload className="w-4 h-4" />} loading={uploading} disabled={!file && !texto.trim()} onClick={submitEnvio}>
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
            <Card>
              <ul>
                {alunos.map((row) => {
                  const respStatus = row.envio?.corrigido_em
                    ? { label: 'Corrigida', tone: 'success' as const }
                    : row.envio?.enviado_em
                      ? { label: 'Enviada', tone: 'warn' as const }
                      : { label: 'Não enviada', tone: 'default' as const };
                  return (
                    <li
                      key={row.id}
                      className="flex items-center gap-4 px-4 py-3 border-b border-[#1c1f26] last:border-0 hover:bg-[#111] cursor-pointer"
                      onClick={() => setSelectedAluno(row)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{row.nome || row.email}</p>
                        {row.nome && <p className="meta text-xs truncate">{row.email}</p>}
                      </div>
                      {row.envio?.corrigido_em && (
                        <span className="text-sm font-medium text-[#cbfb00] flex-shrink-0">{row.envio.nota}/{atividade.nota_maxima}</span>
                      )}
                      <Badge tone={respStatus.tone}>{respStatus.label}</Badge>
                      <ChevronRight className="w-4 h-4 text-[#434d5e] flex-shrink-0" />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* ── MODAL: resposta completa + correção ── */}
      {selectedAluno && (
        <Modal
          open={!!selectedAluno}
          onClose={() => setSelectedAluno(null)}
          title={selectedAluno.nome || selectedAluno.email}
        >
          <div className="space-y-4">
            {selectedAluno.nome && <p className="meta -mt-2">{selectedAluno.email}</p>}

            {selectedAluno.envio?.texto ? (
              <div>
                <p className="meta mb-1">Resposta em texto</p>
                <p className="text-[#d6deed] text-sm whitespace-pre-line bg-[#111] rounded-md p-3">{selectedAluno.envio.texto}</p>
              </div>
            ) : (
              <p className="meta">Nenhuma resposta em texto enviada.</p>
            )}

            {selectedAluno.envio?.arquivo_url ? (
              <FileLink bucket="atividades" path={selectedAluno.envio.arquivo_url} className="inline-flex items-center gap-2 text-sm text-[#cbfb00] hover:underline">
                <Paperclip className="w-4 h-4 inline mr-1" /> {selectedAluno.envio.arquivo_nome ?? 'Arquivo enviado'}
              </FileLink>
            ) : (
              <p className="meta">Nenhum arquivo anexado.</p>
            )}

            <div className="border-t border-[#1c1f26] pt-4 space-y-3">
              <div>
                <label>Nota (máx. {atividade.nota_maxima})</label>
                <input
                  type="number"
                  value={drafts[selectedAluno.id]?.nota ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [selectedAluno.id]: { ...d[selectedAluno.id], nota: e.target.value } }))}
                  max={atividade.nota_maxima}
                  min={0}
                />
              </div>
              <div>
                <label>Comentário (opcional)</label>
                <textarea
                  rows={4}
                  value={drafts[selectedAluno.id]?.comentario ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [selectedAluno.id]: { ...d[selectedAluno.id], comentario: e.target.value } }))}
                  placeholder="Escreva um comentário para o aluno..."
                />
              </div>
              <Button variant="primary" loading={saving === selectedAluno.id} onClick={() => salvarNota(selectedAluno.id)} className="w-full">
                Salvar correção
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Toast message={toast} />
    </div>
  );
}
