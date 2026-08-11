import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, PlayCircle, ClipboardList, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton, Badge, cn } from '../../components/ui';
import { SignedImage } from '../../components/SignedImage';
import { ordemDaFaixa, labelDaFaixa } from '../../lib/faixa';

const AULAS_POR_FAIXA = 12;

type Aula = { id: string; titulo: string; ordem: number };
type Atividade = { id: string; titulo: string; aulaId: string | null; status: 'pendente' | 'enviada' | 'corrigida' };
type Curso = { id: string; titulo: string; capaUrl: string | null; faixa: string | null };

type AulaNode = { kind: 'aula'; key: string; ordem: number; aula: Aula | null; done: boolean };
type AtividadeNode = { kind: 'atividade'; key: string; atividade: Atividade };
type TrailNode = AulaNode | AtividadeNode;

type Trilha = { curso: Curso; nodes: TrailNode[] };

export default function CronogramaIndex() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id);
      const pairs = (ut ?? []).filter((r) => r.curso_id) as { turma_id: string; curso_id: string }[];
      const turmaIds = [...new Set(pairs.map((p) => p.turma_id))];
      if (!turmaIds.length) { setTrilhas([]); setLoading(false); return; }

      // Cursos vinculados diretamente ao aluno + todos os cursos das turmas dele
      const { data: ctRows } = await supabase.from('curso_turmas').select('curso_id').in('turma_id', turmaIds);
      const cursoIds = [...new Set([...pairs.map((p) => p.curso_id), ...(ctRows ?? []).map((r) => r.curso_id)])];
      if (!cursoIds.length) { setTrilhas([]); setLoading(false); return; }

      // faixa/capa_url ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cs } = await (supabase as any).from('cursos').select('id,titulo,capa_url,faixa').in('id', cursoIds);
      const cursos: Curso[] = ((cs ?? []) as { id: string; titulo: string; capa_url: string | null; faixa: string | null }[])
        .map((c) => ({ id: c.id, titulo: c.titulo, capaUrl: c.capa_url, faixa: c.faixa }))
        .sort((a, b) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: as_ } = await (supabase as any).from('lessons_public').select('id,titulo,ordem,curso_id').in('curso_id', cursoIds);
      const aulasPorCurso: Record<string, Aula[]> = {};
      (as_ ?? []).forEach((a: { id: string; titulo: string; ordem: number; curso_id: string }) => {
        (aulasPorCurso[a.curso_id] ??= []).push({ id: a.id, titulo: a.titulo, ordem: a.ordem });
      });

      const { data: ats } = await supabase.from('atividades').select('id,titulo,aula_id,turma_id,curso_id').in('curso_id', cursoIds);
      const atividadeIds = (ats ?? []).map((a) => a.id);
      const { data: envios } = atividadeIds.length
        ? await supabase.from('atividade_envios').select('atividade_id,enviado_em,corrigido_em').eq('aluno_id', profile.id).in('atividade_id', atividadeIds)
        : { data: [] };
      const envioMap = new Map((envios ?? []).map((e) => [e.atividade_id, e]));
      const atividadesPorCurso: Record<string, Atividade[]> = {};
      (ats ?? []).forEach((a) => {
        if (!a.curso_id) return;
        const e = envioMap.get(a.id);
        const status: Atividade['status'] = e?.corrigido_em ? 'corrigida' : e?.enviado_em ? 'enviada' : 'pendente';
        (atividadesPorCurso[a.curso_id] ??= []).push({ id: a.id, titulo: a.titulo, aulaId: a.aula_id, status });
      });

      const { data: ps } = await supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true);
      const doneSet = new Set((ps ?? []).map((p) => p.aula_id));

      const list: Trilha[] = cursos.map((curso) => {
        const aulasReais = aulasPorCurso[curso.id] ?? [];
        const porOrdem = new Map(aulasReais.map((a) => [a.ordem, a]));
        const atividadesDoCurso = atividadesPorCurso[curso.id] ?? [];
        const atividadesPorAula = new Map<string, Atividade[]>();
        const atividadesSemAula: Atividade[] = [];
        atividadesDoCurso.forEach((a) => {
          if (a.aulaId) {
            const aulaId: string = a.aulaId;
            const list = atividadesPorAula.get(aulaId) ?? [];
            list.push(a);
            atividadesPorAula.set(aulaId, list);
          } else atividadesSemAula.push(a);
        });

        const total = Math.max(AULAS_POR_FAIXA, aulasReais.length);
        const nodes: TrailNode[] = [];
        for (let ordem = 1; ordem <= total; ordem++) {
          const aula = porOrdem.get(ordem) ?? null;
          nodes.push({ kind: 'aula', key: `aula-${curso.id}-${ordem}`, ordem, aula, done: aula ? doneSet.has(aula.id) : false });
          if (aula) {
            (atividadesPorAula.get(aula.id) ?? []).forEach((a) => nodes.push({ kind: 'atividade', key: `atividade-${a.id}`, atividade: a }));
          }
        }
        atividadesSemAula.forEach((a) => nodes.push({ kind: 'atividade', key: `atividade-${a.id}`, atividade: a }));

        return { curso, nodes };
      });

      setTrilhas(list);
      setLoading(false);
    })();
  }, [profile]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-8">
        <h1 className="mb-0.5">Cronograma</h1>
        <p className="text-fg-3 text-sm">Sua trilha de aulas e atividades.</p>
      </header>

      {loading ? (
        <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : trilhas.length === 0 ? (
        <p className="text-fg-3 text-sm">Aguarde o administrador liberar conteúdo para suas turmas.</p>
      ) : (
        <div className="space-y-20">
          {trilhas.map((t, i) => <TrilhaSection key={t.curso.id} trilha={t} index={i} nav={nav} />)}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<Atividade['status'], string> = { pendente: 'Pendente', enviada: 'Enviada', corrigida: 'Corrigida' };

function TrilhaSection({ trilha, index, nav }: { trilha: Trilha; index: number; nav: (path: string) => void }) {
  const { curso, nodes } = trilha;
  const reversed = [...nodes].reverse();
  return (
    <section className="rounded-2xl border border-line bg-panel-2/30 p-4 sm:p-5">
      <div className="relative rounded-xl overflow-hidden h-48 sm:h-56 mb-6 border border-line">
        {curso.capaUrl ? (
          <>
            <SignedImage bucket="capas" path={curso.capaUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-brand/10" />
        )}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/60 text-[11px] font-semibold uppercase tracking-wider">Faixa {index + 1}</span>
            {labelDaFaixa(curso.faixa) && <Badge tone="outline" className="bg-black/30 border-white/20 text-white">{labelDaFaixa(curso.faixa)}</Badge>}
          </div>
          <h2 className={curso.capaUrl ? 'text-white' : 'text-fg'}>{curso.titulo}</h2>
        </div>
      </div>

      <div className="flex flex-col items-stretch max-w-sm mx-auto">
        {reversed.map((node, i) => (
          <div key={node.key}>
            {node.kind === 'aula' ? <AulaNodeCard node={node} nav={nav} cursoId={curso.id} /> : <AtividadeNodeCard node={node} nav={nav} />}
            {i < reversed.length - 1 && <div className="h-8 border-l-2 border-dashed border-line mx-auto w-0" />}
          </div>
        ))}
      </div>
    </section>
  );
}

function AulaNodeCard({ node, nav, cursoId }: { node: AulaNode; nav: (path: string) => void; cursoId: string }) {
  const available = !!node.aula;
  const go = () => { if (available) nav(`/curso/${cursoId}?aula=${node.aula!.id}`); };
  const titulo = available ? (node.aula!.titulo || `Aula ${node.ordem}`) : `Aula ${node.ordem}`;
  return (
    <button
      onClick={go}
      disabled={!available}
      className={cn(
        'w-full rounded-xl border-2 px-4 py-3.5 flex items-center gap-3 text-left transition-colors',
        available ? 'cursor-pointer hover:border-brand/60' : 'cursor-default',
        node.done ? 'bg-brand/10 border-brand' : available ? 'bg-panel border-line' : 'bg-white/5 border-white/10'
      )}
    >
      <span className={cn(
        'w-10 h-10 rounded-lg flex-shrink-0 grid place-items-center',
        node.done ? 'bg-brand text-brand-ink' : available ? 'bg-brand/15 text-brand' : 'bg-white/10 text-white/30'
      )}>
        {node.done ? <Check className="w-5 h-5" /> : available ? <PlayCircle className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium truncate', available ? 'text-fg' : 'text-white/35')}>{titulo}</p>
        <p className={cn('text-xs mt-0.5', available ? 'text-fg-3' : 'text-white/25')}>{available ? (node.done ? 'Concluída' : 'Aula') : 'Em breve'}</p>
      </div>
    </button>
  );
}

function AtividadeNodeCard({ node, nav }: { node: AtividadeNode; nav: (path: string) => void }) {
  const { atividade } = node;
  const tone = atividade.status === 'corrigida' ? { border: 'border-success', bg: 'bg-success/10', iconBg: 'bg-success/15 text-success' }
    : atividade.status === 'enviada' ? { border: 'border-info', bg: 'bg-info/10', iconBg: 'bg-info/15 text-info' }
    : { border: 'border-warn', bg: 'bg-warn/10', iconBg: 'bg-warn/15 text-warn' };
  return (
    <button
      onClick={() => nav(`/atividade/${atividade.id}`)}
      className={cn('w-full rounded-xl border-2 px-4 py-3.5 flex items-center gap-3 text-left cursor-pointer transition-colors hover:border-opacity-80', tone.border, tone.bg)}
    >
      <span className={cn('w-10 h-10 rounded-lg flex-shrink-0 grid place-items-center', tone.iconBg)}><ClipboardList className="w-5 h-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg truncate">{atividade.titulo}</p>
        <p className="text-xs text-fg-3 mt-0.5">{STATUS_LABEL[atividade.status]}</p>
      </div>
    </button>
  );
}
