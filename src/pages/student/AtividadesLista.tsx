import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Badge, EmptyState, Skeleton, useToast } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import CriarAtividadeModal from './CriarAtividadeModal';

type Atividade = { id: string; titulo: string; prazo: string | null; nota_maxima: number };
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
  const isProfessor = profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin';

  const [turmaNome, setTurmaNome] = useState('');
  const [cursoTitulo, setCursoTitulo] = useState('');
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [envios, setEnvios] = useState<Record<string, Envio>>({});
  const [pendMap, setPendMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: c }, { data: as }] = await Promise.all([
      supabase.from('turmas').select('nome').eq('id', turmaId!).maybeSingle(),
      supabase.from('cursos').select('titulo').eq('id', cursoId!).maybeSingle(),
      supabase.from('atividades').select('id,titulo,prazo,nota_maxima').eq('turma_id', turmaId!).eq('curso_id', cursoId!).order('created_at', { ascending: false }),
    ]);
    setTurmaNome(t?.nome ?? ''); setCursoTitulo(c?.titulo ?? ''); setAtividades(as ?? []);
    const atividadeIds = (as ?? []).map((a) => a.id);
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        breadcrumbs={[{ label: 'Atividades', to: '/atividades' }, { label: `${turmaNome} ${cursoTitulo}`.trim() || '…' }]}
        title={`${turmaNome} ${cursoTitulo}`.trim() || '…'}
        subtitle={isProfessor ? 'Atividades desta turma.' : 'Suas atividades.'}
        actions={isProfessor ? <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Criar atividade</Button> : undefined}
      />

      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
        atividades.length === 0 ? (
          <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Nenhuma atividade" description={isProfessor ? 'Crie a primeira atividade desta turma.' : 'Aguarde o professor publicar atividades.'}
            action={isProfessor ? <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Criar atividade</Button> : undefined} />
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {atividades.map((a) => {
                const envio = envios[a.id];
                const s = statusOf(a, envio);
                const notaLabel = envio?.corrigido_em ? `${envio.nota}/${a.nota_maxima}` : `–/${a.nota_maxima}`;
                const prazoLabel = a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR') : '–';
                const pend = pendMap[a.id] ?? 0;
                return (
                  <li key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 cursor-pointer transition-colors" onClick={() => nav(`/atividade/${a.id}`)}>
                    <div className="flex-1 min-w-0"><p className="text-fg text-sm font-medium truncate">{a.titulo}</p><p className="text-fg-3 text-xs mt-0.5">Prazo: {prazoLabel}</p></div>
                    {!isProfessor && <Badge tone={s.tone} dot>{s.label}</Badge>}
                    {!isProfessor && <span className="text-sm text-brand font-medium w-16 text-right tabular-nums">{notaLabel}</span>}
                    {isProfessor && pend > 0 && <Badge tone="warn">{pend} pendente{pend > 1 ? 's' : ''}</Badge>}
                    <ChevronRight className="w-4 h-4 text-fg-3 flex-shrink-0" />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

      <CriarAtividadeModal open={createOpen} turmaId={turmaId!} cursoId={cursoId!} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); toast.success('Atividade criada.'); load(); }} />
    </div>
  );
}
