import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardCheck, HelpCircle, Layers, MessageSquare, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Avatar, Badge, Card, EmptyState, Skeleton, StatTile } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';

type Turma = { id: string; nome: string; descricao: string | null };
type Activity = { id: string; titulo: string; prazo: string | null; turma_id: string; curso_id: string | null };
type Delivery = { atividade_id: string; enviado_em: string | null; nota: number | null };

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [openQuestions, setOpenQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const firstName = (profile?.nome || profile?.email.split('@')[0] || '').split(' ')[0];

  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      const { data: memberships } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
      const turmaIds = [...new Set((memberships ?? []).map((row) => row.turma_id))];
      if (!turmaIds.length) { if (active) setLoading(false); return; }
      const [{ data: turmaRows }, { data: activityRows }, { data: doubts }] = await Promise.all([
        supabase.from('turmas').select('id,nome,descricao').in('id', turmaIds).order('nome'),
        supabase.from('atividades').select('id,titulo,prazo,turma_id,curso_id').in('turma_id', turmaIds).order('prazo', { ascending: true }),
        supabase.from('duvidas').select('id').in('turma_id', turmaIds).eq('status', 'aberta'),
      ]);
      const activityIds = (activityRows ?? []).map((item) => item.id);
      const { data: deliveryRows } = activityIds.length
        ? await supabase.from('atividade_envios').select('atividade_id,enviado_em,nota').in('atividade_id', activityIds)
        : { data: [] };
      if (!active) return;
      setTurmas(turmaRows ?? []);
      setActivities(activityRows ?? []);
      setDeliveries(deliveryRows ?? []);
      setOpenQuestions((doubts ?? []).length);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [profile]);

  const pendingReviews = deliveries.filter((delivery) => delivery.enviado_em && delivery.nota === null).length;
  const upcoming = useMemo(() => activities.filter((item) => item.prazo && new Date(item.prazo).getTime() >= Date.now()).slice(0, 5), [activities]);
  const turmaMap = useMemo(() => new Map(turmas.map((turma) => [turma.id, turma.nome])), [turmas]);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><Skeleton className="mb-6 h-20 rounded-xl" /><div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}</div></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-7 flex items-center gap-3">
        <Avatar name={profile?.nome} email={profile?.email} src={profile?.avatar_signed_url} size={46} />
        <PageHeader className="mb-0" title={firstName ? `Olá, ${firstName}` : 'Painel pedagógico'} subtitle="Acompanhe suas turmas, correções e dúvidas em um só lugar." />
      </div>

      {turmas.length === 0 ? (
        <EmptyState icon={<Layers className="h-8 w-8" />} title="Nenhuma turma atribuída" description="Quando uma turma for vinculada ao seu perfil, ela aparecerá aqui." />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Link to="/turmas"><StatTile label="Turmas" value={turmas.length} icon={<Users className="h-4 w-4" />} /></Link>
            <Link to="/atividades"><StatTile label="Correções pendentes" value={pendingReviews} tone={pendingReviews ? 'warn' : 'ok'} icon={<ClipboardCheck className="h-4 w-4" />} /></Link>
            <Link to="/duvidas"><StatTile label="Dúvidas abertas" value={openQuestions} tone={openQuestions ? 'warn' : 'ok'} icon={<HelpCircle className="h-4 w-4" />} /></Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Layers className="h-4 w-4 text-brand" /><h2 className="text-base">Minhas turmas</h2></div><Link to="/turmas" className="inline-flex items-center gap-1 text-xs font-medium text-brand">Ver todas <ArrowRight className="h-3.5 w-3.5" /></Link></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {turmas.slice(0, 6).map((turma) => (
                  <div key={turma.id} className="rounded-xl border border-line bg-panel-2/35 p-4">
                    <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><Users className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-fg">{turma.nome}</p><p className="mt-0.5 line-clamp-2 text-xs text-fg-3">{turma.descricao || 'Turma ativa no Matter Academy.'}</p></div></div>
                    <div className="mt-4 flex gap-2"><Link to={`/turma/${turma.id}/comunidade`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-panel text-xs font-medium text-fg-2 hover:border-line-strong"><MessageSquare className="h-3.5 w-3.5" />Comunidade</Link><Link to="/atividades" className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-panel text-xs font-medium text-fg-2 hover:border-line-strong"><ClipboardCheck className="h-3.5 w-3.5" />Atividades</Link></div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-brand" /><h2 className="text-base">Próximos prazos</h2></div>
              {upcoming.length === 0 ? <div className="py-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-ok" /><p className="mt-2 text-sm text-fg-2">Nenhum prazo próximo.</p></div> : <div className="space-y-2">{upcoming.map((activity) => { const date = new Date(activity.prazo!); const days = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000)); return <Link key={activity.id} to={activity.curso_id ? `/atividades/${activity.turma_id}/${activity.curso_id}` : '/atividades'} className="block rounded-lg border border-line p-3 transition-colors hover:bg-panel-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-fg">{activity.titulo}</p><p className="mt-0.5 truncate text-xs text-fg-3">{turmaMap.get(activity.turma_id)}</p></div><Badge tone={days <= 2 ? 'danger' : days <= 5 ? 'warn' : 'default'}>{days === 0 ? 'hoje' : `${days}d`}</Badge></div></Link>; })}</div>}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

