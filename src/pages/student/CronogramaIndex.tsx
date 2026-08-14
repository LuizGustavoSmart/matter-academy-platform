import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, PlayCircle, ClipboardList, Lock, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton, Badge, cn } from '../../components/ui';
import { SignedImage } from '../../components/SignedImage';
import { FAIXA_OPTIONS, ordemDaFaixa, labelDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';

const AULAS_POR_FAIXA = 12;

type Aula = { id: string; titulo: string; ordem: number };
type Atividade = { id: string; titulo: string; aulaId: string | null; ordem: number; status: 'pendente' | 'enviada' | 'corrigida' };
type Curso = { id: string; titulo: string; capaUrl: string | null; faixa: string | null };

type AulaNode = { kind: 'aula'; key: string; ordem: number; aula: Aula | null; done: boolean };
type AtividadeNode = { kind: 'atividade'; key: string; ordem: number; atividade: Atividade | null };
type TrailNode = AulaNode | AtividadeNode;

type Trilha = { curso: Curso; nodes: TrailNode[]; matriculado: boolean };

export default function CronogramaIndex() {
  const { profile } = useAuth();
  const faixaCapas = useFaixaCapas();
  const nav = useNavigate();
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id);
      const pairs = (ut ?? []) as { turma_id: string; curso_id: string | null }[];
      const turmaIds = [...new Set(pairs.map((p) => p.turma_id))];
      if (!turmaIds.length) { setTrilhas([]); setLoading(false); return; }
      const enrolledCursoIds = new Set(pairs.filter((p) => p.curso_id).map((p) => p.curso_id as string));

      // Todos os cursos das turmas do aluno — inclusive os que ele não está
      // matriculado especificamente (aparecem bloqueados na trilha).
      const { data: ctRows } = await supabase.from('curso_turmas').select('curso_id').in('turma_id', turmaIds);
      const cursoIds = [...new Set([...enrolledCursoIds, ...(ctRows ?? []).map((r) => r.curso_id)])];
      if (!cursoIds.length) { setTrilhas([]); setLoading(false); return; }

      // faixa/capa_url ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cs } = await (supabase as any).from('cursos').select('id,titulo,capa_url,faixa').in('id', cursoIds);
      const cursosReais: Curso[] = ((cs ?? []) as { id: string; titulo: string; capa_url: string | null; faixa: string | null }[])
        .map((c) => ({ id: c.id, titulo: c.titulo, capaUrl: c.capa_url, faixa: c.faixa }));

      // As 4 faixas sempre aparecem, mesmo que o curso daquela faixa ainda não
      // exista na plataforma — nesse caso é um bloco bloqueado "virtual".
      const faixasPresentes = new Set(cursosReais.map((c) => c.faixa));
      const cursosVirtuais: Curso[] = FAIXA_OPTIONS
        .filter((o) => !faixasPresentes.has(o.value))
        .map((o) => ({ id: `virtual-${o.value}`, titulo: labelDaFaixa(o.value) ?? o.label, capaUrl: null, faixa: o.value }));

      // A trilha rola de baixo para cima: Faixa Branca fica no final (embaixo),
      // Preta no topo — por isso a ordem das seções na página é decrescente.
      const cursos: Curso[] = [...cursosReais, ...cursosVirtuais].sort((a, b) => ordemDaFaixa(b.faixa) - ordemDaFaixa(a.faixa));

      const cursoIdsMatriculados = cursos.filter((c) => enrolledCursoIds.has(c.id)).map((c) => c.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: as_ } = cursoIdsMatriculados.length ? await (supabase as any).from('lessons_public').select('id,titulo,ordem,curso_id').in('curso_id', cursoIdsMatriculados) : { data: [] };
      const aulasPorCurso: Record<string, Aula[]> = {};
      (as_ ?? []).forEach((a: { id: string; titulo: string; ordem: number; curso_id: string }) => {
        (aulasPorCurso[a.curso_id] ??= []).push({ id: a.id, titulo: a.titulo, ordem: a.ordem });
      });

      // ordem ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ats } = cursoIdsMatriculados.length
        ? await (supabase as any).from('atividades').select('id,titulo,aula_id,ordem,turma_id,curso_id').in('curso_id', cursoIdsMatriculados).order('ordem')
        : { data: [] };
      const atividadeIds = (ats ?? []).map((a: { id: string }) => a.id);
      const { data: envios } = atividadeIds.length
        ? await supabase.from('atividade_envios').select('atividade_id,enviado_em,corrigido_em').eq('aluno_id', profile.id).in('atividade_id', atividadeIds)
        : { data: [] };
      const envioMap = new Map((envios ?? []).map((e) => [e.atividade_id, e]));
      const atividadesPorCurso: Record<string, Atividade[]> = {};
      (ats ?? []).forEach((a: { id: string; titulo: string; aula_id: string | null; ordem: number; curso_id: string | null }) => {
        if (!a.curso_id) return;
        const e = envioMap.get(a.id);
        const status: Atividade['status'] = e?.corrigido_em ? 'corrigida' : e?.enviado_em ? 'enviada' : 'pendente';
        (atividadesPorCurso[a.curso_id] ??= []).push({ id: a.id, titulo: a.titulo, aulaId: a.aula_id, ordem: a.ordem ?? 0, status });
      });

      const { data: ps } = cursoIdsMatriculados.length
        ? await supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true)
        : { data: [] };
      const doneSet = new Set((ps ?? []).map((p) => p.aula_id));

      const list: Trilha[] = cursos.map((curso) => {
        const matriculado = enrolledCursoIds.has(curso.id);
        if (!matriculado) {
          // Curso bloqueado: mostra só uma prévia (3 marcos) — o resto fica coberto pela mensagem de bloqueio.
          const nodes: TrailNode[] = [
            { kind: 'aula', key: `locked-aula-${curso.id}-1`, ordem: 1, aula: null, done: false },
            { kind: 'atividade', key: `locked-atividade-${curso.id}-1`, ordem: 1, atividade: null },
            { kind: 'aula', key: `locked-aula-${curso.id}-2`, ordem: 2, aula: null, done: false },
          ];
          return { curso, nodes, matriculado: false };
        }

        // Reindexa para posições sequenciais 1..N — evita que buracos/duplicidade
        // no campo `ordem` das aulas ou aulas repetidas (ex.: mesma aula
        // retornada mais de uma vez por estar em mais de uma turma) quebrem
        // o intercalado Aula/Atividade.
        const aulasVistas = new Set<string>();
        const aulasReais = [...(aulasPorCurso[curso.id] ?? [])]
          .sort((a, b) => a.ordem - b.ordem)
          .filter((a) => { if (aulasVistas.has(a.id)) return false; aulasVistas.add(a.id); return true; });
        const porOrdem = new Map(aulasReais.map((a, i) => [i + 1, a]));
        const atividadesDoCurso = (atividadesPorCurso[curso.id] ?? []).sort((a, b) => a.ordem - b.ordem);
        // A posição de cada atividade vem sempre da aula a que ela está vinculada.
        const atividadesPorAula = new Map<string, Atividade[]>();
        const atividadesSemAula: Atividade[] = [];
        atividadesDoCurso.forEach((a) => {
          if (a.aulaId) {
            const aulaId: string = a.aulaId;
            const list = atividadesPorAula.get(aulaId) ?? [];
            list.push(a);
            atividadesPorAula.set(aulaId, list);
          } else {
            atividadesSemAula.push(a);
          }
        });

        const total = Math.max(AULAS_POR_FAIXA, aulasReais.length);
        const nodes: TrailNode[] = [];
        for (let ordem = 1; ordem <= total; ordem++) {
          const aula = porOrdem.get(ordem) ?? null;
          const key = `aula-${curso.id}-${ordem}`;
          nodes.push({ kind: 'aula', key, ordem, aula, done: aula ? doneSet.has(aula.id) : false });
          const atividadesDaAula = aula ? (atividadesPorAula.get(aula.id) ?? []) : [];
          if (atividadesDaAula.length) {
            atividadesDaAula.forEach((a) => nodes.push({ kind: 'atividade', key: `atividade-${a.id}`, ordem, atividade: a }));
          } else {
            // Mantém o ritmo Aula/Atividade mesmo quando a atividade ainda não existe.
            nodes.push({ kind: 'atividade', key: `placeholder-atividade-${curso.id}-${ordem}`, ordem, atividade: null });
          }
        }
        // Atividades sem aula_id — sem posição confiável, ficam ao final.
        atividadesSemAula.forEach((a) => nodes.push({ kind: 'atividade', key: `atividade-${a.id}`, ordem: total + 1, atividade: a }));

        return { curso, nodes, matriculado: true };
      });

      // Centraliza inicialmente na primeira atividade ainda não enviada, na
      // ordem cronológica (Faixa Branca primeiro, depois Verde, Marrom, Preta).
      let pendingKey: string | null = null;
      for (const t of [...list].reverse()) {
        if (!t.matriculado) continue;
        const node = t.nodes.find((n) => n.kind === 'atividade' && n.atividade && n.atividade.status === 'pendente');
        if (node) { pendingKey = node.key; break; }
      }

      setTrilhas(list);
      setCurrentKey(pendingKey);
      setLoading(false);
    })();
  }, [profile]);

  useEffect(() => {
    if (loading || scrolledRef.current || !currentKey) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => {
      document.getElementById(`node-${currentKey}`)?.scrollIntoView({ block: 'center' });
    });
  }, [loading, currentKey]);

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
        <div className="space-y-16">
          {trilhas.map((t) => <TrilhaSection key={t.curso.id} trilha={t} currentKey={currentKey} nav={nav} faixaCapas={faixaCapas} />)}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<Atividade['status'], string> = { pendente: 'Pendente', enviada: 'Enviada', corrigida: 'Corrigida' };

function TrilhaSection({ trilha, currentKey, nav, faixaCapas }: { trilha: Trilha; currentKey: string | null; nav: (path: string) => void; faixaCapas: Record<string, string | null> }) {
  const { curso, nodes, matriculado } = trilha;
  const [expanded, setExpanded] = useState(true);
  const reversed = [...nodes].reverse();
  const capa = resolveCapaUrl(curso.capaUrl, curso.faixa, faixaCapas);
  return (
    <section>
      {/* A trilha lê de baixo para cima, então a capa fica no final da seção — logo antes da Aula 1. */}
      {matriculado && !expanded ? null : (
        <div className="relative max-w-sm mx-auto">
          <div className={cn('flex flex-col items-stretch', !matriculado && 'blur-sm opacity-60 pointer-events-none select-none')}>
            {reversed.map((node) => (
              <div key={node.key} id={`node-${node.key}`}>
                {node.kind === 'aula' ? <AulaNodeCard node={node} nav={nav} cursoId={curso.id} highlight={node.key === currentKey} /> : <AtividadeNodeCard node={node} nav={nav} highlight={node.key === currentKey} />}
                <div className="h-12 border-l-2 border-dashed border-line mx-auto w-0" />
              </div>
            ))}
          </div>
          {!matriculado && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-panel border border-line rounded-xl px-5 py-3 flex items-center gap-2 shadow-ma-2">
                <Lock className="w-4 h-4 text-fg-3" />
                <span className="text-fg text-sm font-medium">Conteúdo bloqueado</span>
              </div>
            </div>
          )}
        </div>
      )}

      {matriculado && (
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Recolher faixa' : 'Expandir faixa'}
          className="flex items-center justify-center gap-1.5 w-full max-w-sm mx-auto mb-3 py-1.5 rounded-md text-xs font-medium text-fg-3 hover:text-fg hover:bg-panel-2 transition-colors"
        >
          <ChevronDown className={cn('w-4 h-4 transition-transform', !expanded && '-rotate-90')} />
          {expanded ? 'Recolher' : 'Expandir'}
        </button>
      )}

      <div className="relative rounded-xl overflow-hidden h-48 sm:h-56 mb-3 max-w-sm mx-auto">
        {capa ? (
          <SignedImage bucket="capas" path={capa} className="absolute inset-0 w-full h-full object-cover" alt="" />
        ) : (
          <div className="absolute inset-0 bg-brand/10" />
        )}
      </div>
      <div className="flex items-center gap-2 max-w-sm mx-auto">
        <h2 className="text-fg flex-1 min-w-0 truncate">{curso.titulo}</h2>
        {!matriculado && <Badge tone="default">Bloqueada</Badge>}
      </div>
    </section>
  );
}

function AulaNodeCard({ node, nav, cursoId, highlight }: { node: AulaNode; nav: (path: string) => void; cursoId: string; highlight: boolean }) {
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
        highlight ? 'border-brand ring-2 ring-brand/30' : node.done ? 'bg-brand/10 border-brand' : available ? 'bg-panel border-line' : 'bg-white/5 border-white/10'
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

function AtividadeNodeCard({ node, nav, highlight }: { node: AtividadeNode; nav: (path: string) => void; highlight: boolean }) {
  const { atividade } = node;
  const titulo = node.ordem === AULAS_POR_FAIXA ? 'Projeto Final' : atividade?.titulo;
  if (!atividade) {
    return (
      <div className="w-full rounded-xl border-2 px-4 py-3.5 flex items-center gap-3 text-left bg-white/5 border-white/10 cursor-default">
        <span className="w-10 h-10 rounded-lg flex-shrink-0 grid place-items-center bg-white/10 text-white/30"><Lock className="w-4 h-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate text-white/35">{titulo ?? `Atividade ${node.ordem}`}</p>
          <p className="text-xs mt-0.5 text-white/25">Em breve</p>
        </div>
      </div>
    );
  }
  const done = atividade.status !== 'pendente';
  return (
    <button
      onClick={() => nav(`/atividade/${atividade.id}`)}
      className={cn(
        'w-full rounded-xl border-2 px-4 py-3.5 flex items-center gap-3 text-left cursor-pointer hover:border-brand/60 transition-colors',
        highlight ? 'border-brand ring-2 ring-brand/30' : done ? 'bg-brand/10 border-brand' : 'bg-panel border-line'
      )}
    >
      <span className={cn('w-10 h-10 rounded-lg flex-shrink-0 grid place-items-center', done ? 'bg-brand text-brand-ink' : 'bg-brand/15 text-brand')}>
        {done ? <Check className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg truncate">{titulo}</p>
        <p className="text-xs text-fg-3 mt-0.5">{STATUS_LABEL[atividade.status]}</p>
      </div>
    </button>
  );
}
