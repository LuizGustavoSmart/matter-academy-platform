import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, ClipboardList, ClipboardCheck, Pencil, Trash2, MoreHorizontal, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, IconButton, Card, Badge, EmptyState, Skeleton, Switch, DropdownMenu, useToast, useConfirm } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import CriarAtividadeModal, { type AtividadeEditavel } from './CriarAtividadeModal';

type Atividade = AtividadeEditavel & { publicada: boolean; ordem: number };
type Envio = { atividade_id: string; enviado_em: string | null; nota: number | null; corrigido_em: string | null };

function statusOf(a: Atividade, envio: Envio | undefined): { label: string; tone: 'default' | 'success' | 'info' | 'warn' | 'danger' } {
  if (envio?.corrigido_em) return { label: 'Corrigida', tone: 'success' };
  if (envio?.enviado_em) return { label: 'Enviada', tone: 'info' };
  if (a.prazo && new Date(a.prazo) < new Date()) return { label: 'Atrasada', tone: 'danger' };
  return { label: 'Não enviada', tone: 'warn' };
}

export default function AtividadesLista() {
  const { turmaId, cursoId } = useParams<{ turmaId: string; cursoId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isProfessor = profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin';

  const [turmaNome, setTurmaNome] = useState('');
  const [cursoTitulo, setCursoTitulo] = useState('');
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [envios, setEnvios] = useState<Record<string, Envio>>({});
  const [pendMap, setPendMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editAtividade, setEditAtividade] = useState<Atividade | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: c }, { data: as }] = await Promise.all([
      supabase.from('turmas').select('nome').eq('id', turmaId!).maybeSingle(),
      supabase.from('cursos').select('titulo').eq('id', cursoId!).maybeSingle(),
      // publicada/ordem/avaliada_com_nota ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('atividades').select('id,titulo,descricao,aula_id,anexo_url,anexo_nome,prazo,nota_maxima,publicada,ordem,avaliada_com_nota').eq('turma_id', turmaId!).eq('curso_id', cursoId!).order('ordem').order('created_at', { ascending: true }),
    ]);
    setTurmaNome(t?.nome ?? ''); setCursoTitulo(c?.titulo ?? ''); setAtividades(as ?? []);
    const atividadeIds = (as ?? []).map((a: Atividade) => a.id);
    if (atividadeIds.length) {
      if (isProfessor) {
        const { data: es } = await supabase.from('atividade_envios').select('atividade_id,enviado_em,nota,corrigido_em').in('atividade_id', atividadeIds);
        const pend: Record<string, number> = {};
        (es ?? []).forEach((e) => { if (e.enviado_em && e.nota === null) pend[e.atividade_id] = (pend[e.atividade_id] ?? 0) + 1; });
        setPendMap(pend);
      } else if (profile) {
        const { data: es } = await supabase.from('atividade_envios').select('atividade_id,enviado_em,nota,corrigido_em').in('atividade_id', atividadeIds).eq('aluno_id', profile.id);
        const map: Record<string, Envio> = {};
        (es ?? []).forEach((e) => { map[e.atividade_id] = e as Envio; });
        setEnvios(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [turmaId, cursoId, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePublicada = async (a: Atividade) => {
    setAtividades((prev) => prev.map((x) => (x.id === a.id ? { ...x, publicada: !a.publicada } : x)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('atividades').update({ publicada: !a.publicada }).eq('id', a.id);
    if (error) { toast.error(error.message); load(); }
    else toast.success(a.publicada ? 'Atividade ocultada dos alunos.' : 'Atividade liberada para os alunos.');
  };

  const moveAtividade = async (a: Atividade, dir: -1 | 1) => {
    const idx = atividades.findIndex((x) => x.id === a.id);
    const other = atividades[idx + dir];
    if (!other) return;
    // Grava a ordem com base na posição visual atual (não no valor salvo),
    // assim funciona mesmo que todas ainda estejam com ordem padrão (0).
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        breadcrumbs={[{ label: 'Atividades', to: '/atividades' }, { label: `${turmaNome} ${cursoTitulo}`.trim() || '…' }]}
        title={`${turmaNome} ${cursoTitulo}`.trim() || '…'}
        subtitle={isProfessor ? 'Atividades desta turma.' : 'Suas atividades.'}
        actions={isProfessor ? (
          <>
            <Button variant="secondary" icon={<ClipboardCheck className="w-4 h-4" />} onClick={() => nav(`/presenca/${turmaId}/${cursoId}`)}>Presença</Button>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Criar atividade</Button>
          </>
        ) : undefined}
      />

      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
        atividades.length === 0 ? (
          <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Nenhuma atividade" description={isProfessor ? 'Crie a primeira atividade desta turma.' : 'Aguarde o professor publicar atividades.'}
            action={isProfessor ? <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Criar atividade</Button> : undefined} />
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {atividades.map((a, i) => {
                const envio = envios[a.id];
                const s = statusOf(a, envio);
                const notaLabel = a.avaliada_com_nota === false ? 'Sem nota' : envio?.corrigido_em ? `${envio.nota}/${a.nota_maxima}` : `–/${a.nota_maxima}`;
                const prazoLabel = a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR') : '–';
                const pend = pendMap[a.id] ?? 0;
                return (
                  <li key={a.id} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 transition-colors">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => nav(`/atividade/${a.id}`)}>
                      <p className="text-fg text-sm font-medium truncate">{a.titulo}</p>
                      <p className="text-fg-3 text-xs mt-0.5 truncate">Prazo: {prazoLabel}{!isProfessor && envio ? ` · ${notaLabel}` : ''}</p>
                    </div>
                    {!isProfessor && <Badge tone={s.tone} dot className="flex-shrink-0">{s.label}</Badge>}
                    {!isProfessor && <span className="hidden sm:inline text-sm text-brand font-medium w-16 text-right tabular-nums">{notaLabel}</span>}
                    {isProfessor && pend > 0 && <Badge tone="warn" className="flex-shrink-0">{pend} pend.</Badge>}
                    {isProfessor ? (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <IconButton label="Mover para cima" onClick={() => moveAtividade(a, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></IconButton>
                        <IconButton label="Mover para baixo" onClick={() => moveAtividade(a, 1)} disabled={i === atividades.length - 1}><ArrowDown className="w-4 h-4" /></IconButton>
                        <Switch checked={a.publicada} onChange={() => togglePublicada(a)} label={<span className="text-xs whitespace-nowrap hidden sm:inline">{a.publicada ? 'Visível' : 'Oculta'}</span>} />
                        <DropdownMenu
                          items={[
                            { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => setEditAtividade(a) },
                            { type: 'separator' as const },
                            { label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, tone: 'danger' as const, onClick: () => delAtividade(a) },
                          ]}
                          trigger={({ toggle, ref, open }) => <IconButton ref={ref} label="Ações da atividade" onClick={toggle} className={open ? 'bg-panel-3 text-fg' : ''}><MoreHorizontal className="w-4 h-4" /></IconButton>}
                        />
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-fg-3 flex-shrink-0 hidden sm:block cursor-pointer" onClick={() => nav(`/atividade/${a.id}`)} />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

      <CriarAtividadeModal open={createOpen} turmaId={turmaId!} cursoId={cursoId!} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); toast.success('Atividade criada.'); load(); }} />
      <CriarAtividadeModal open={!!editAtividade} turmaId={turmaId!} cursoId={cursoId!} atividade={editAtividade} onClose={() => setEditAtividade(null)} onDone={() => { setEditAtividade(null); toast.success('Atividade atualizada.'); load(); }} />
    </div>
  );
}
