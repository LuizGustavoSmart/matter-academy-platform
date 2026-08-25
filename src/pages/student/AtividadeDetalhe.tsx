import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Paperclip, PlayCircle, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAtividadeFile } from '../../lib/storage';
import { Button, Card, Badge, Avatar, Modal, Skeleton, EmptyState, Field, Input, Textarea, useToast } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { FileLink } from '../../components/FileLink';
import { isStaffOfTurma } from '../../lib/turmaStaff';

type Atividade = {
  id: string; turma_id: string; curso_id: string | null; aula_id: string | null;
  titulo: string; descricao: string | null; anexo_url: string | null; anexo_nome: string | null;
  nota_maxima: number; prazo: string | null; avaliada_com_nota?: boolean;
};
type Envio = { id?: string; arquivo_url: string | null; arquivo_nome: string | null; texto: string | null; enviado_em: string | null; nota: number | null; comentario_professor: string | null; corrigido_em: string | null };
type AlunoRow = { id: string; email: string; nome: string | null; envio: Envio | null };

export default function AtividadeDetalhe() {
  const { atividadeId } = useParams<{ atividadeId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const [isProfessor, setIsProfessor] = useState(false);

  const [atividade, setAtividade] = useState<Atividade | null>(null);
  const [loading, setLoading] = useState(true);
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [texto, setTexto] = useState('');
  const [uploading, setUploading] = useState(false);
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
    setEnvio(data ?? null); setTexto(data?.texto ?? '');
  };
  const loadProfessor = async (a: Atividade) => {
    const { data: ut } = await supabase.from('user_turmas').select('user_id').eq('turma_id', a.turma_id).eq('curso_id', a.curso_id!);
    const userIds = (ut ?? []).map((r) => r.user_id);
    if (!userIds.length) { setAlunos([]); return; }
    const { data: profiles } = await supabase.from('profiles').select('id,email,nome,role').in('id', userIds);
    const students = (profiles ?? []).filter((p) => p.role === 'student');
    const { data: envios } = await supabase.from('atividade_envios').select('*').eq('atividade_id', a.id).in('aluno_id', students.map((s) => s.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envioMap = new Map((envios ?? []).map((e: any) => [e.aluno_id, e]));
    const rows: AlunoRow[] = students.map((s) => ({ id: s.id, email: s.email, nome: s.nome, envio: envioMap.get(s.id) ?? null }));
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
        const staff = await isStaffOfTurma(profile, a.turma_id);
        setIsProfessor(staff);
        if (staff) await loadProfessor(a); else await loadAluno(a);
      }
      setLoading(false);
    })();
  }, [atividadeId, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOverdue = !!atividade?.prazo && new Date(atividade.prazo) < new Date();

  const status = (() => {
    if (!atividade) return { label: '', tone: 'default' as const };
    if (envio?.corrigido_em) return { label: 'Corrigida', tone: 'success' as const };
    if (envio?.enviado_em) return { label: 'Enviada', tone: 'info' as const };
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
      if (file) { const up = await uploadAtividadeFile(file, `envios/${atividade.id}/${profile.id}`); arquivo_url = up.path; arquivo_nome = up.nome; }
      const { error } = await supabase.from('atividade_envios').upsert({ atividade_id: atividade.id, aluno_id: profile.id, arquivo_url, arquivo_nome, texto: texto.trim() || null, enviado_em: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'atividade_id,aluno_id' });
      if (error) throw error;
      toast.success('Atividade enviada.'); setFile(null); await loadAluno(atividade);
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  };

  const salvarNota = async (alunoId: string) => {
    if (!atividade) return;
    const draft = drafts[alunoId];
    setSaving(alunoId);
    try {
      const { error } = await supabase.from('atividade_envios').upsert({ atividade_id: atividade.id, aluno_id: alunoId, nota: draft.nota === '' ? null : parseFloat(draft.nota), comentario_professor: draft.comentario.trim() || null, corrigido_em: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'atividade_id,aluno_id' });
      if (error) throw error;
      toast.success('Correção salva.'); setSelectedAluno(null); await loadProfessor(atividade);
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(null); }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8"><Skeleton className="h-8 w-72 mb-6" /><Skeleton className="h-64 rounded-xl" /></div>;
  if (!atividade) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8"><EmptyState title="Atividade não encontrada" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        breadcrumbs={[{ label: 'Atividades', to: '/atividades' }, { label: 'Lista', to: `/atividades/${atividade.turma_id}/${atividade.curso_id}` }, { label: atividade.titulo }]}
        title={atividade.titulo}
        subtitle={`Prazo: ${atividade.prazo ? new Date(atividade.prazo).toLocaleString('pt-BR') : '–'}${atividade.avaliada_com_nota === false ? ' · Sem nota' : ` · Nota máxima: ${atividade.nota_maxima}`}`}
        actions={!isProfessor ? <Badge tone={status.tone} dot>{status.label}</Badge> : undefined}
      />

      {atividade.descricao && <p className="text-fg-2 leading-relaxed mb-6 whitespace-pre-line">{atividade.descricao}</p>}
      {atividade.anexo_url && (
        <FileLink bucket="atividades" path={atividade.anexo_url} className="inline-flex items-center gap-2 text-sm text-brand hover:underline mb-6"><Paperclip className="w-4 h-4" /> {atividade.anexo_nome ?? 'Anexo do professor'}</FileLink>
      )}
      {atividade.aula_id && (
        <div className="mb-8"><Button variant="secondary" icon={<PlayCircle className="w-4 h-4" />} onClick={() => nav(`/curso/${atividade.curso_id}?aula=${atividade.aula_id}`)}>Teve dúvida? Revise a aula por aqui.</Button></div>
      )}

      {/* ALUNO */}
      {!isProfessor && (
        <Card className="p-6">
          {envio?.corrigido_em ? (
            <div className="space-y-4">
              {atividade.avaliada_com_nota !== false ? (
                <div><p className="text-fg-3 text-xs mb-1">Sua nota</p><p className="text-2xl font-display font-semibold text-brand tabular-nums">{envio.nota}/{atividade.nota_maxima}</p></div>
              ) : (
                <Badge tone="success" dot>Revisada</Badge>
              )}
              {envio.comentario_professor && <div><p className="text-fg-3 text-xs mb-1">Comentário do professor</p><p className="text-fg-2 whitespace-pre-line">{envio.comentario_professor}</p></div>}
              {envio.texto && <div><p className="text-fg-3 text-xs mb-1">Sua resposta</p><p className="text-fg-2 whitespace-pre-line">{envio.texto}</p></div>}
              {envio.arquivo_url && <FileLink bucket="atividades" path={envio.arquivo_url} className="inline-flex items-center gap-2 text-sm text-brand hover:underline"><Paperclip className="w-4 h-4" /> {envio.arquivo_nome ?? 'Arquivo enviado'}</FileLink>}
            </div>
          ) : isOverdue ? (
            <div className="space-y-4">
              {envio?.texto && <div><p className="text-fg-3 text-xs mb-1">Sua resposta</p><p className="text-fg-2 whitespace-pre-line">{envio.texto}</p></div>}
              {envio?.arquivo_url && <FileLink bucket="atividades" path={envio.arquivo_url} className="inline-flex items-center gap-2 text-sm text-brand hover:underline"><Paperclip className="w-4 h-4" /> {envio.arquivo_nome ?? 'Arquivo enviado'}</FileLink>}
              <p className="text-danger text-sm font-medium">O prazo desta atividade encerrou. Não é mais possível enviar ou alterar sua resposta.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {envio?.arquivo_url && <FileLink bucket="atividades" path={envio.arquivo_url} className="inline-flex items-center gap-2 text-sm text-brand hover:underline"><Paperclip className="w-4 h-4" /> {envio.arquivo_nome ?? 'Arquivo enviado'} (atual)</FileLink>}
              <Field label="Resposta" hint="Opcional" htmlFor="ad-resp"><Textarea id="ad-resp" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Escreva sua resposta aqui…" /></Field>
              <Field label={envio ? 'Substituir arquivo' : 'Anexar documento'} hint="Opcional — PDF, foto" htmlFor="ad-file"><Input id="ad-file" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="!py-2" /></Field>
              <Button variant="primary" icon={<Upload className="w-4 h-4" />} loading={uploading} disabled={!file && !texto.trim()} onClick={submitEnvio}>{envio ? 'Reenviar atividade' : 'Enviar atividade'}</Button>
            </div>
          )}
        </Card>
      )}

      {/* PROFESSOR */}
      {isProfessor && (
        <div>
          <p className="text-fg-3 text-sm mb-4">Respostas dos alunos.</p>
          {alunos.length === 0 ? <EmptyState title="Nenhum aluno nesta turma/curso" /> : (
            <Card className="overflow-hidden">
              <ul>
                {alunos.map((row) => {
                  const respStatus = row.envio?.corrigido_em ? { label: 'Corrigida', tone: 'success' as const } : row.envio?.enviado_em ? { label: 'Enviada', tone: 'warn' as const } : { label: 'Não enviada', tone: 'default' as const };
                  return (
                    <li key={row.id} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 cursor-pointer transition-colors" onClick={() => setSelectedAluno(row)}>
                      <Avatar name={row.nome} email={row.email} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="text-fg text-sm font-medium truncate">{row.nome || row.email.split('@')[0]}</p>
                        <p className="text-fg-3 text-xs truncate">{[row.nome ? row.email : null, row.envio?.enviado_em ? `Enviado em ${new Date(row.envio.enviado_em).toLocaleString('pt-BR')}` : null].filter(Boolean).join(' · ')}</p>
                      </div>
                      {row.envio?.corrigido_em && atividade.avaliada_com_nota !== false && <span className="hidden sm:inline text-sm font-medium text-brand flex-shrink-0 tabular-nums">{row.envio.nota}/{atividade.nota_maxima}</span>}
                      <Badge tone={respStatus.tone} dot className="flex-shrink-0">{respStatus.label}</Badge>
                      <ChevronRight className="w-4 h-4 text-fg-3 flex-shrink-0 hidden sm:block" />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Correção */}
      {selectedAluno && (
        <Modal open={!!selectedAluno} onClose={() => setSelectedAluno(null)} title={selectedAluno.nome || selectedAluno.email}
          footer={<><Button variant="secondary" onClick={() => setSelectedAluno(null)}>Fechar</Button><Button variant="primary" loading={saving === selectedAluno.id} onClick={() => salvarNota(selectedAluno.id)}>{atividade.avaliada_com_nota === false ? 'Marcar como revisada' : 'Salvar correção'}</Button></>}>
          <div className="space-y-4">
            {selectedAluno.nome && <p className="text-fg-3 text-sm -mt-1">{selectedAluno.email}</p>}
            <p className="text-fg-3 text-sm">{selectedAluno.envio?.enviado_em ? `Enviado em ${new Date(selectedAluno.envio.enviado_em).toLocaleString('pt-BR')}` : 'Ainda não enviado'}</p>
            {selectedAluno.envio?.texto ? (
              <div><p className="text-fg-3 text-xs mb-1">Resposta em texto</p><p className="text-fg-2 text-sm whitespace-pre-line bg-panel-3/40 border border-line rounded-lg p-3">{selectedAluno.envio.texto}</p></div>
            ) : <p className="text-fg-3 text-sm">Nenhuma resposta em texto enviada.</p>}
            {selectedAluno.envio?.arquivo_url ? (
              <div><p className="text-fg-3 text-xs mb-1">Arquivo anexado</p><FileLink bucket="atividades" path={selectedAluno.envio.arquivo_url} className="inline-flex items-center gap-2 text-sm text-brand hover:underline"><Paperclip className="w-4 h-4" /> {selectedAluno.envio.arquivo_nome ?? 'Arquivo enviado'}</FileLink></div>
            ) : <p className="text-fg-3 text-sm">Nenhum arquivo anexado.</p>}
            <div className="border-t border-line pt-4 space-y-3">
              {atividade.avaliada_com_nota !== false && (
                <Field label={`Nota (máx. ${atividade.nota_maxima})`} htmlFor="ad-nota"><Input id="ad-nota" type="number" value={drafts[selectedAluno.id]?.nota ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [selectedAluno.id]: { ...d[selectedAluno.id], nota: e.target.value } }))} max={atividade.nota_maxima} min={0} className="max-w-[140px]" /></Field>
              )}
              <Field label="Comentário" hint="Opcional" htmlFor="ad-com"><Textarea id="ad-com" rows={4} value={drafts[selectedAluno.id]?.comentario ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [selectedAluno.id]: { ...d[selectedAluno.id], comentario: e.target.value } }))} placeholder="Escreva um comentário para o aluno…" /></Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
