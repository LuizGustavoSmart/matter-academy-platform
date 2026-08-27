import { useEffect, useMemo, useState } from 'react';
import { Plus, ClipboardList, Pencil, Trash2, MoreHorizontal, ArrowUp, ArrowDown, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  Button, IconButton, Card, StatTile, Badge, Avatar, Modal, EmptyState, Skeleton, Switch,
  Field, Input, Textarea, Select, SearchInput, DropdownMenu, useToast, useConfirm,
} from '../../components/ui';
import { FileLink } from '../../components/FileLink';
import CriarAtividadeModal, { type AtividadeEditavel } from '../student/CriarAtividadeModal';
import { notify, studentsOfTurmaCurso } from '../../lib/notify';

type Atividade = AtividadeEditavel & { publicada: boolean; ordem: number };
type Envio = { id?: string; arquivo_url: string | null; arquivo_nome: string | null; texto: string | null; enviado_em: string | null; nota: number | null; comentario_professor: string | null; corrigido_em: string | null };
type AlunoRow = { id: string; email: string; nome: string | null };

export default function CursoAtividadesTab({ turmaId, cursoId, readOnly = false }: { turmaId: string; cursoId: string; readOnly?: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [alunos, setAlunos] = useState<AlunoRow[]>([]);
  const [envios, setEnvios] = useState<Record<string, Record<string, Envio>>>({}); // atividade_id -> aluno_id -> envio
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editAtividade, setEditAtividade] = useState<Atividade | null>(null);
  const [gradeAtividade, setGradeAtividade] = useState<Atividade | null>(null);

  const load = async () => {
    setLoading(true);
    // colunas novas ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: as }, { data: ut }] = await Promise.all([
      sb.from('atividades').select('id,titulo,descricao,aula_id,anexo_url,anexo_nome,prazo,nota_maxima,publicada,ordem,avaliada_com_nota').eq('turma_id', turmaId).eq('curso_id', cursoId).order('ordem').order('created_at', { ascending: true }),
      supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId).eq('curso_id', cursoId),
    ]);
    setAtividades(as ?? []);
    const userIds = (ut ?? []).map((r: { user_id: string }) => r.user_id);
    let students: AlunoRow[] = [];
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,email,nome,role').in('id', userIds);
      students = (profiles ?? []).filter((p) => p.role === 'student');
    }
    setAlunos(students);

    const atividadeIds = (as ?? []).map((a: Atividade) => a.id);
    if (atividadeIds.length && students.length) {
      const { data: es } = await supabase.from('atividade_envios').select('*').in('atividade_id', atividadeIds).in('aluno_id', students.map((s) => s.id));
      const map: Record<string, Record<string, Envio>> = {};
      (es ?? []).forEach((e) => { (map[e.atividade_id] ??= {})[e.aluno_id] = e as Envio; });
      setEnvios(map);
    } else setEnvios({});
    setLoading(false);
  };

  useEffect(() => { load(); }, [turmaId, cursoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePublicada = async (a: Atividade) => {
    const next = !a.publicada;
    setAtividades((prev) => prev.map((x) => (x.id === a.id ? { ...x, publicada: next } : x)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('atividades').update({ publicada: next }).eq('id', a.id);
    if (error) { toast.error(error.message); load(); }
    else {
      toast.success(next ? 'Atividade liberada para os alunos.' : 'Atividade ocultada dos alunos.');
      if (next) {
        studentsOfTurmaCurso(turmaId, cursoId).then((students) =>
          notify('nova_atividade', students, 'Nova atividade disponível', `A atividade "${a.titulo}" foi publicada.`, `/atividade/${a.id}`),
        );
      }
    }
  };

  const moveAtividade = async (a: Atividade, dir: -1 | 1) => {
    const idx = atividades.findIndex((x) => x.id === a.id);
    const other = atividades[idx + dir];
    if (!other) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await Promise.all([
      sb.from('atividades').update({ ordem: idx + dir }).eq('id', a.id),
      sb.from('atividades').update({ ordem: idx }).eq('id', other.id),
    ]);
    load();
  };

  const delAtividade = async (a: Atividade) => {
    const ok = await confirm({ title: 'Excluir atividade', tone: 'danger', confirmLabel: 'Excluir', message: <>Excluir <strong className="text-fg">{a.titulo}</strong>? Os envios dos alunos também serão removidos.</> });
    if (!ok) return;
    const { error } = await supabase.from('atividades').delete().eq('id', a.id);
    if (error) toast.error(error.message); else { toast.success('Atividade excluída.'); load(); }
  };

  // ── Indicadores ──
  const totalAtividades = atividades.length;
  const totalEsperado = totalAtividades * alunos.length;
  let totalEnviados = 0, totalPendentesCorrecao = 0;
  atividades.forEach((a) => {
    alunos.forEach((al) => {
      const e = envios[a.id]?.[al.id];
      if (e?.enviado_em) {
        totalEnviados++;
        if (!e.corrigido_em) totalPendentesCorrecao++;
      }
    });
  });
  const pctEnviado = totalEsperado > 0 ? Math.round((totalEnviados / totalEsperado) * 100) : 0;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <StatTile label="Atividades" value={totalAtividades} icon={<ClipboardList className="w-4 h-4" />} />
        <StatTile label="% de envios recebidos" value={`${pctEnviado}%`} icon={<ClipboardList className="w-4 h-4" />} />
        <StatTile label="Pendentes de correção" value={totalPendentesCorrecao} icon={<ClipboardList className="w-4 h-4" />} />
      </div>

      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="text-fg-3 text-sm">Atividades desta turma.</p>
        {!readOnly && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Criar atividade</Button>}
      </div>

      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
        atividades.length === 0 ? (
          <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Nenhuma atividade" description={readOnly ? 'Nenhuma atividade cadastrada ainda.' : 'Crie a primeira atividade desta turma.'} action={!readOnly ? <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Criar atividade</Button> : undefined} />
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {atividades.map((a, i) => {
                const pend = alunos.filter((al) => { const e = envios[a.id]?.[al.id]; return e?.enviado_em && !e.corrigido_em; }).length;
                const enviados = alunos.filter((al) => envios[a.id]?.[al.id]?.enviado_em).length;
                const prazoLabel = a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR') : '–';
                return (
                  <li key={a.id} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 transition-colors">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setGradeAtividade(a)}>
                      <p className="text-fg text-sm font-medium truncate">{a.titulo}</p>
                      <p className="text-fg-3 text-xs mt-0.5 truncate">Prazo: {prazoLabel}{a.avaliada_com_nota === false ? ' · Sem nota' : ''}{readOnly ? ` · ${enviados}/${alunos.length} entregues` : ''}</p>
                    </div>
                    {pend > 0 && <Badge tone="warn" className="flex-shrink-0">{pend} pend.</Badge>}
                    {readOnly && !a.publicada && <Badge className="flex-shrink-0">Não disponível</Badge>}
                    {readOnly ? null : (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <IconButton label="Mover para cima" onClick={() => moveAtividade(a, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></IconButton>
                        <IconButton label="Mover para baixo" onClick={() => moveAtividade(a, 1)} disabled={i === atividades.length - 1}><ArrowDown className="w-4 h-4" /></IconButton>
                        <Switch checked={a.publicada} onChange={() => togglePublicada(a)} label={<span className="text-xs whitespace-nowrap hidden sm:inline">{a.publicada ? 'Visível' : 'Oculta'}</span>} />
                        <DropdownMenu
                          items={[
                            { label: 'Ver respostas', icon: <ClipboardList className="w-4 h-4" />, onClick: () => setGradeAtividade(a) },
                            { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => setEditAtividade(a) },
                            { type: 'separator' as const },
                            { label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, tone: 'danger' as const, onClick: () => delAtividade(a) },
                          ]}
                          trigger={({ toggle, ref, open }) => <IconButton ref={ref} label="Ações da atividade" onClick={toggle} className={open ? 'bg-panel-3 text-fg' : ''}><MoreHorizontal className="w-4 h-4" /></IconButton>}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

      {!readOnly && (
        <>
          <CriarAtividadeModal open={createOpen} turmaId={turmaId} cursoId={cursoId} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); toast.success('Atividade criada.'); load(); }} />
          <CriarAtividadeModal open={!!editAtividade} turmaId={turmaId} cursoId={cursoId} atividade={editAtividade} onClose={() => setEditAtividade(null)} onDone={() => { setEditAtividade(null); toast.success('Atividade atualizada.'); load(); }} />
        </>
      )}
      {gradeAtividade && (
        <GradeModal
          atividade={gradeAtividade}
          alunos={alunos}
          envios={envios[gradeAtividade.id] ?? {}}
          readOnly={readOnly}
          onClose={() => setGradeAtividade(null)}
          onSaved={() => { load(); }}
        />
      )}
    </div>
  );
}

function GradeModal({ atividade, alunos, envios, readOnly = false, onClose, onSaved }: {
  atividade: Atividade; alunos: AlunoRow[]; envios: Record<string, Envio>; readOnly?: boolean; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [selectedAluno, setSelectedAluno] = useState<AlunoRow | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { nota: string; comentario: string }>>(
    Object.fromEntries(alunos.map((al) => [al.id, { nota: envios[al.id]?.nota != null ? String(envios[al.id].nota) : '', comentario: envios[al.id]?.comentario_professor ?? '' }]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<'nome_az' | 'nome_za' | 'envio_recente' | 'envio_antigo' | 'status'>('nome_az');

  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const nomeDe = (al: AlunoRow) => al.nome || al.email.split('@')[0];
    const statusOrdem = (al: AlunoRow) => {
      const e = envios[al.id];
      return e?.corrigido_em ? 2 : e?.enviado_em ? 1 : 0;
    };
    return alunos
      .filter((al) => !termo || nomeDe(al).toLowerCase().includes(termo) || al.email.toLowerCase().includes(termo))
      .sort((a, b) => {
        if (ordem === 'nome_az') return nomeDe(a).localeCompare(nomeDe(b));
        if (ordem === 'nome_za') return nomeDe(b).localeCompare(nomeDe(a));
        if (ordem === 'status') return statusOrdem(b) - statusOrdem(a);
        const da = envios[a.id]?.enviado_em ? new Date(envios[a.id].enviado_em!).getTime() : 0;
        const db = envios[b.id]?.enviado_em ? new Date(envios[b.id].enviado_em!).getTime() : 0;
        return ordem === 'envio_recente' ? db - da : da - db;
      });
  }, [alunos, envios, busca, ordem]);

  const salvarNota = async (alunoId: string) => {
    const draft = drafts[alunoId];
    setSaving(alunoId);
    try {
      const { error } = await supabase.from('atividade_envios').upsert({
        atividade_id: atividade.id, aluno_id: alunoId,
        nota: draft.nota === '' ? null : parseFloat(draft.nota), comentario_professor: draft.comentario.trim() || null,
        corrigido_em: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'atividade_id,aluno_id' });
      if (error) throw error;
      toast.success('Correção salva.'); setSelectedAluno(null); onSaved();
      const aluno = alunos.find((al) => al.id === alunoId);
      if (aluno) {
        notify('atividade_corrigida', [{ user_id: aluno.id, email: aluno.email, nome: aluno.nome }], 'Atividade corrigida', `Sua atividade "${atividade.titulo}" foi corrigida.`, `/atividade/${atividade.id}`);
      }
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(null); }
  };

  return (
    <>
      <Modal open onClose={onClose} title={`Respostas — ${atividade.titulo}`} size="lg">
        {alunos.length === 0 ? <EmptyState title="Nenhum aluno nesta turma/curso" /> : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <SearchInput value={busca} onChange={setBusca} placeholder="Buscar aluno…" className="flex-1" />
              <Select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className="w-auto flex-shrink-0">
                <option value="nome_az">Nome A-Z</option>
                <option value="nome_za">Nome Z-A</option>
                <option value="envio_recente">Envio mais recente</option>
                <option value="envio_antigo">Envio mais antigo</option>
                <option value="status">Status (corrigida primeiro)</option>
              </Select>
            </div>
            {alunosFiltrados.length === 0 ? <EmptyState title="Nenhum aluno encontrado" /> : (
          <ul className="-mx-5">
            {alunosFiltrados.map((al) => {
              const envio = envios[al.id];
              const respStatus = envio?.corrigido_em ? { label: 'Corrigida', tone: 'success' as const } : envio?.enviado_em ? { label: 'Enviada', tone: 'warn' as const } : { label: 'Não enviada', tone: 'default' as const };
              return (
                <li key={al.id} className="flex items-center gap-3 px-5 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 cursor-pointer transition-colors" onClick={() => setSelectedAluno(al)}>
                  <Avatar name={al.nome} email={al.email} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-fg text-sm font-medium truncate">{al.nome || al.email.split('@')[0]}</p>
                    <p className="text-fg-3 text-xs truncate">{envio?.enviado_em ? `Enviado em ${new Date(envio.enviado_em).toLocaleString('pt-BR')}` : 'Ainda não enviado'}</p>
                  </div>
                  {envio?.corrigido_em && atividade.avaliada_com_nota !== false && <span className="text-sm font-medium text-brand flex-shrink-0 tabular-nums">{envio.nota}/{atividade.nota_maxima}</span>}
                  <Badge tone={respStatus.tone} dot className="flex-shrink-0">{respStatus.label}</Badge>
                </li>
              );
            })}
          </ul>
            )}
          </>
        )}
      </Modal>

      {selectedAluno && (
        <Modal open onClose={() => setSelectedAluno(null)} title={selectedAluno.nome || selectedAluno.email}
          footer={readOnly
            ? <Button variant="secondary" onClick={() => setSelectedAluno(null)}>Fechar</Button>
            : <><Button variant="secondary" onClick={() => setSelectedAluno(null)}>Fechar</Button><Button variant="primary" loading={saving === selectedAluno.id} onClick={() => salvarNota(selectedAluno.id)}>{atividade.avaliada_com_nota === false ? 'Marcar como revisada' : 'Salvar correção'}</Button></>}>
          <div className="space-y-4">
            {selectedAluno.nome && <p className="text-fg-3 text-sm -mt-1">{selectedAluno.email}</p>}
            {envios[selectedAluno.id]?.texto ? (
              <div><p className="text-fg-3 text-xs mb-1">Resposta em texto</p><p className="text-fg-2 text-sm whitespace-pre-line bg-panel-3/40 border border-line rounded-lg p-3">{envios[selectedAluno.id].texto}</p></div>
            ) : <p className="text-fg-3 text-sm">Nenhuma resposta em texto enviada.</p>}
            {envios[selectedAluno.id]?.arquivo_url ? (
              <div><p className="text-fg-3 text-xs mb-1">Arquivo anexado</p><FileLink bucket="atividades" path={envios[selectedAluno.id].arquivo_url!} className="inline-flex items-center gap-2 text-sm text-brand hover:underline"><Paperclip className="w-4 h-4" /> {envios[selectedAluno.id].arquivo_nome ?? 'Arquivo enviado'}</FileLink></div>
            ) : <p className="text-fg-3 text-sm">Nenhum arquivo anexado.</p>}
            {readOnly ? (
              <div className="border-t border-line pt-4 text-sm text-fg-2">
                {atividade.avaliada_com_nota !== false && envios[selectedAluno.id]?.nota != null && <p>Nota: <strong className="text-fg">{envios[selectedAluno.id].nota}/{atividade.nota_maxima}</strong></p>}
                {envios[selectedAluno.id]?.comentario_professor && <p className="mt-1">Comentário: {envios[selectedAluno.id].comentario_professor}</p>}
              </div>
            ) : (
              <div className="border-t border-line pt-4 space-y-3">
                {atividade.avaliada_com_nota !== false && (
                  <Field label={`Nota (máx. ${atividade.nota_maxima})`} htmlFor="gm-nota"><Input id="gm-nota" type="number" value={drafts[selectedAluno.id]?.nota ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [selectedAluno.id]: { ...d[selectedAluno.id], nota: e.target.value } }))} max={atividade.nota_maxima} min={0} className="max-w-[140px]" /></Field>
                )}
                <Field label="Comentário" hint="Opcional" htmlFor="gm-com"><Textarea id="gm-com" rows={4} value={drafts[selectedAluno.id]?.comentario ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [selectedAluno.id]: { ...d[selectedAluno.id], comentario: e.target.value } }))} placeholder="Escreva um comentário para o aluno…" /></Field>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
