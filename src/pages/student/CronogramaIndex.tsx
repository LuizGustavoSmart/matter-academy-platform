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
        <div className="space-y-12">
          {trilhas.map((t) => <TrilhaSection key={t.curso.id} trilha={t} nav={nav} />)}
        </div>
      )}
    </div>
  );
}

function TrilhaSection({ trilha, nav }: { trilha: Trilha; nav: (path: string) => void }) {
  const { curso, nodes } = trilha;
  return (
    <section>
      <div className="relative rounded-xl overflow-hidden h-20 mb-8 border border-line">
        {curso.capaUrl ? (
          <>
            <SignedImage bucket="capas" path={curso.capaUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
          </>
        ) : (
          <div className="absolute inset-0 bg-brand/10" />
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          {labelDaFaixa(curso.faixa) && <Badge tone="outline" className="mb-1 bg-black/30 border-white/20 text-white">{labelDaFaixa(curso.faixa)}</Badge>}
          <h2 className={curso.capaUrl ? 'text-white' : 'text-fg'}>{curso.titulo}</h2>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 bg-line rounded-full" />
        <div className="relative flex flex-col items-center gap-3">
          {nodes.map((node, i) => {
            const wave = Math.round(Math.sin(i * 0.85) * 64);
            return (
              <div key={node.key} className="relative" style={{ transform: `translateX(${wave}px)` }}>
                {node.kind === 'aula' ? <AulaNodeButton node={node} nav={nav} cursoId={curso.id} /> : <AtividadeNodeButton node={node} nav={nav} />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AulaNodeButton({ node, nav, cursoId }: { node: AulaNode; nav: (path: string) => void; cursoId: string }) {
  const available = !!node.aula;
  const go = () => { if (available) nav(`/curso/${cursoId}?aula=${node.aula!.id}`); };
  return (
    <button
      onClick={go}
      disabled={!available}
      title={available ? node.aula!.titulo : 'Em breve'}
      className={cn(
        'w-16 h-16 rounded-full grid place-items-center border-2 shadow-ma-1 transition-transform',
        available ? 'cursor-pointer hover:scale-105' : 'cursor-default',
        node.done ? 'bg-brand border-brand text-brand-ink' : available ? 'bg-panel-2 border-brand text-brand' : 'bg-white/5 border-white/15 text-white/30'
      )}
    >
      {node.done ? <Check className="w-6 h-6" /> : available ? <PlayCircle className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
      <span className="sr-only">{available ? node.aula!.titulo : `Aula ${node.ordem} — Em breve`}</span>
    </button>
  );
}

function AtividadeNodeButton({ node, nav }: { node: AtividadeNode; nav: (path: string) => void }) {
  const { atividade } = node;
  return (
    <button
      onClick={() => nav(`/atividade/${atividade.id}`)}
      title={atividade.titulo}
      className={cn(
        'w-14 h-14 rounded-2xl rotate-45 grid place-items-center border-2 shadow-ma-1 cursor-pointer hover:scale-105 transition-transform',
        atividade.status === 'corrigida' ? 'bg-success/20 border-success text-success'
          : atividade.status === 'enviada' ? 'bg-info/20 border-info text-info'
          : 'bg-warn/20 border-warn text-warn'
      )}
    >
      <ClipboardList className="w-5 h-5 -rotate-45" />
      <span className="sr-only">Atividade: {atividade.titulo}</span>
    </button>
  );
}
