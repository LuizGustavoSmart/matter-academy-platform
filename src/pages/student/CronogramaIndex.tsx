import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, PlayCircle, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton, Avatar, cn } from '../../components/ui';
import { SignedImage } from '../../components/SignedImage';
import { FAIXA_OPTIONS, FAIXA_DOT_CLASS, ordemDaFaixa, labelDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';

const AULAS_POR_FAIXA = 12;

/* ── Constantes de layout — a trilha agora é uma coluna vertical única, então
   cada linha se auto-alinha no fluxo normal do documento; não é preciso
   calcular posições em pixel para os marcos, já que eles ficam na MESMA
   linha do bloco a que se referem. ── */
const TILE = 108;
const TRANSITION_TILE = 156;
const CONNECTOR_H = 48;
const GUTTER_W = 288;

/** Deslocamento horizontal (px) de cada casa, em ciclo — o "efeito cobra":
    a trilha ondula suavemente para os lados em vez de subir reta. Reinicia
    em 0 a cada troca de faixa (o bloco de transição fica centralizado). */
const WAVE = [0, 56, 80, 56, 0, -56, -80, -56];

/** Fundo sutil por faixa — mesma variedade de cor do tabuleiro de referência, dentro da paleta da plataforma. */
const FAIXA_BG_CLASS: Record<string, string> = {
  branca: 'bg-white/10',
  verde: 'bg-emerald-500/15',
  marrom: 'bg-amber-700/20',
  preta: 'bg-zinc-400/15',
};

type Aula = { id: string; titulo: string; ordem: number };
type Curso = { id: string; titulo: string; capaUrl: string | null; faixa: string | null };
type Slot = { ordem: number; aula: Aula | null; done: boolean };
type Marco = { titulo: string; desc: string };

const MARCOS: Record<string, { ordem: number; titulo: string; desc: string }[]> = {
  branca: [
    { ordem: 3, titulo: 'Aula 3 — Usuário Profissional de IA', desc: 'Usa IA generativa de forma profissional, dominando os fundamentos, o ChatGPT e a lógica necessária para transformar tarefas do dia a dia em resultados melhores.' },
    { ordem: 6, titulo: 'Aula 6 — Especialista em Prompt & Pesquisa', desc: 'Estrutura interações mais sofisticadas com IA, utilizando técnicas avançadas de prompting para pesquisar, sintetizar informações e produzir relatórios com mais qualidade e precisão.' },
    { ordem: 9, titulo: 'Aula 9 — Criador Multimídia com IA', desc: 'Amplia a IA para diferentes formatos de trabalho, criando conteúdos visuais e apresentações e utilizando IA para interpretar, explorar e analisar dados.' },
    { ordem: 12, titulo: 'Final — Profissional AI-First', desc: 'Integra IA à sua rotina de trabalho, organizando sua produtividade, estruturando diferentes ferramentas e aplicando princípios de uso responsável para transformar tarefas em fluxos mais eficientes.' },
  ],
  verde: [
    { ordem: 3, titulo: 'Aula 3 — Profissional Multi-IA', desc: 'Combina diferentes ferramentas de IA para pesquisar, analisar e tomar decisões, entendendo como aplicar IA para aumentar produtividade e gerar retorno nos processos de trabalho.' },
    { ordem: 6, titulo: 'Aula 6 — Arquiteto de Processos AI-First', desc: 'Redesenha processos incorporando agentes e múltiplas IAs, transformando atividades tradicionais em fluxos AI-First e criando protótipos de novas formas de trabalhar.' },
    { ordem: 9, titulo: 'Aula 9 — Construtor de Automações', desc: 'Transforma processos redesenhados em automações integradas, conectando ferramentas como Zapier, Make, n8n e Power Automate para reduzir tarefas manuais e fazer diferentes sistemas trabalharem juntos.' },
    { ordem: 12, titulo: 'Final — Profissional AI-First de Processos', desc: 'Projeta, automatiza e avalia processos de ponta a ponta, equilibrando produtividade, integração, governança e limites da automação para gerar ganhos reais e sustentáveis.' },
  ],
  marrom: [
    { ordem: 3, titulo: 'Aula 3 — Construtor de Agentes', desc: 'Cria agentes de IA especializados, definindo seu propósito e incorporando conhecimento para resolver problemas específicos de forma mais consistente.' },
    { ordem: 6, titulo: 'Aula 6 — Prototipador de Produtos AI', desc: 'Transforma agentes em produtos funcionais, utilizando vibe coding, dados vivos e diferentes componentes para construir soluções que vão além de uma simples conversa com IA.' },
    { ordem: 9, titulo: 'Aula 9 — Construtor de Produtos Autônomos', desc: 'Cria produtos capazes de interagir com o mundo e executar ações, conectando-se a sistemas e dados externos com maior autonomia, qualidade e robustez.' },
    { ordem: 12, titulo: 'Final — Criador de Negócios com IA', desc: 'Transforma uma solução de IA em uma proposta de produto viável, entendendo arquitetura, custos e business case e demonstrando seu funcionamento em um produto real.' },
  ],
  preta: [
    { ordem: 3, titulo: 'Aula 3 — Estrategista de IA', desc: 'Enxerga IA a partir da perspectiva do negócio, avaliando a maturidade da organização e construindo uma narrativa estratégica para orientar sua transformação.' },
    { ordem: 6, titulo: 'Aula 6 — Líder da Transformação AI-First', desc: 'Cria as bases para uma transformação organizacional, estruturando governança, cultura e capacitação para que a adoção de IA aconteça de forma consistente e em escala.' },
    { ordem: 9, titulo: 'Aula 9 — Orquestrador da Transformação', desc: 'Transforma estratégia em prioridades e ação, mobilizando stakeholders, conduzindo a mudança e estabelecendo métricas para acompanhar o impacto das iniciativas de IA.' },
    { ordem: 12, titulo: 'Final — Líder Estratégico de IA', desc: 'Constrói e defende uma estratégia de IA para a organização, conectando visão de futuro, prioridades, governança, cultura, capacitação e métricas em um plano estratégico executável.' },
  ],
};

export default function CronogramaIndex() {
  const { profile } = useAuth();
  const faixaCapas = useFaixaCapas();
  const nav = useNavigate();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [slotsPorCurso, setSlotsPorCurso] = useState<Record<string, Slot[]>>({});
  const [currentSlotKey, setCurrentSlotKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: ut } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
      const turmaIds = [...new Set((ut ?? []).map((r) => r.turma_id))];
      if (!turmaIds.length) { setCursos([]); setLoading(false); return; }

      const { data: ctRows } = await supabase.from('curso_turmas').select('curso_id').in('turma_id', turmaIds);
      const cursoIds = [...new Set((ctRows ?? []).map((r) => r.curso_id))];
      if (!cursoIds.length) { setCursos([]); setLoading(false); return; }

      // faixa/capa_url ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cs } = await (supabase as any).from('cursos').select('id,titulo,capa_url,faixa').in('id', cursoIds);
      const cursosReais: Curso[] = ((cs ?? []) as { id: string; titulo: string; capa_url: string | null; faixa: string | null }[])
        .map((c) => ({ id: c.id, titulo: c.titulo, capaUrl: c.capa_url, faixa: c.faixa }));

      // As 4 faixas sempre aparecem — a que ainda não existe na plataforma
      // vira um bloco "virtual" sem aulas (mostrado como "em breve").
      const faixasPresentes = new Set(cursosReais.map((c) => c.faixa));
      const cursosVirtuais: Curso[] = FAIXA_OPTIONS
        .filter((o) => !faixasPresentes.has(o.value))
        .map((o) => ({ id: `virtual-${o.value}`, titulo: labelDaFaixa(o.value) ?? o.label, capaUrl: null, faixa: o.value }));

      const cursosOrdenados: Curso[] = [...cursosReais, ...cursosVirtuais].sort((a, b) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa));

      const cursoIdsReais = cursosReais.map((c) => c.id);
      // lessons_public é uma view não tipada no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: as_ } = cursoIdsReais.length ? await (supabase as any).from('lessons_public').select('id,titulo,ordem,curso_id').in('curso_id', cursoIdsReais) : { data: [] };
      const aulasPorCurso: Record<string, Aula[]> = {};
      (as_ ?? []).forEach((a: { id: string; titulo: string; ordem: number; curso_id: string }) => {
        (aulasPorCurso[a.curso_id] ??= []).push({ id: a.id, titulo: a.titulo, ordem: a.ordem });
      });

      const { data: ps } = await supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true);
      const doneSet = new Set((ps ?? []).map((p) => p.aula_id));

      let currentKey: string | null = null;
      const map: Record<string, Slot[]> = {};
      for (const curso of cursosOrdenados) {
        const vistas = new Set<string>();
        const aulasReais = [...(aulasPorCurso[curso.id] ?? [])]
          .sort((a, b) => a.ordem - b.ordem)
          .filter((a) => { if (vistas.has(a.id)) return false; vistas.add(a.id); return true; });
        const porOrdem = new Map(aulasReais.map((a, i) => [i + 1, a]));
        const total = Math.max(AULAS_POR_FAIXA, aulasReais.length);
        const slots: Slot[] = [];
        for (let ordem = 1; ordem <= total; ordem++) {
          const aula = porOrdem.get(ordem) ?? null;
          const done = aula ? doneSet.has(aula.id) : false;
          slots.push({ ordem, aula, done });
        }
        map[curso.id] = slots;
        if (!currentKey) {
          const proxima = slots.find((s) => s.aula && !s.done);
          if (proxima) currentKey = `${curso.id}:${proxima.ordem}`;
        }
      }

      setCursos(cursosOrdenados);
      setSlotsPorCurso(map);
      setCurrentSlotKey(currentKey);
      setLoading(false);
    })();
  }, [profile]);

  useEffect(() => {
    if (loading || scrolledRef.current || !currentSlotKey) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => {
      document.getElementById(`slot-${currentSlotKey}`)?.scrollIntoView({ block: 'center' });
    });
  }, [loading, currentSlotKey]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-8 text-center">
        <h1 className="mb-0.5">Cronograma</h1>
        <p className="text-fg-3 text-sm">Sua trilha de aulas — avance faixa por faixa, como num tabuleiro.</p>
      </header>

      {loading ? (
        <div className="space-y-4 max-w-md mx-auto">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : cursos.length === 0 ? (
        <p className="text-fg-3 text-sm text-center">Aguarde o administrador liberar conteúdo para suas turmas.</p>
      ) : (
        <Board cursos={cursos} slotsPorCurso={slotsPorCurso} currentSlotKey={currentSlotKey} nav={nav} faixaCapas={faixaCapas} profile={profile} />
      )}
    </div>
  );
}

/* ─────────────────── Board: uma única coluna vertical ─────────────────── */

type Row =
  | { type: 'transicao'; key: string; curso: Curso; primeira: boolean }
  | { type: 'aula'; key: string; curso: Curso; slot: Slot; marco: Marco | null; marcoSide: 'left' | 'right' | null };

function Board({ cursos, slotsPorCurso, currentSlotKey, nav, faixaCapas, profile }: {
  cursos: Curso[]; slotsPorCurso: Record<string, Slot[]>; currentSlotKey: string | null;
  nav: (path: string) => void; faixaCapas: Record<string, string | null>;
  profile: { nome?: string | null; email?: string; avatar_url?: string | null } | null;
}) {
  const rows: Row[] = [];
  const offsets: number[] = [];
  let marcoToggle = 0;
  cursos.forEach((curso, cursoIdx) => {
    rows.push({ type: 'transicao', key: `transicao-${curso.id}`, curso, primeira: cursoIdx === 0 });
    offsets.push(0); // o bloco de transição fica sempre centralizado
    const marcosDoCurso = curso.faixa ? MARCOS[curso.faixa] ?? [] : [];
    const slots = slotsPorCurso[curso.id] ?? [];
    slots.forEach((slot, idxNaFaixa) => {
      const marco = marcosDoCurso.find((m) => m.ordem === slot.ordem) ?? null;
      const marcoSide = marco ? (marcoToggle++ % 2 === 0 ? 'left' : 'right') : null;
      rows.push({ type: 'aula', key: `${curso.id}-${slot.ordem}`, curso, slot, marco, marcoSide });
      // Casas com marco ficam centralizadas — evita a curva sobrepor o card lateral.
      offsets.push(marco ? 0 : WAVE[idxNaFaixa % WAVE.length]);
    });
  });

  return (
    <div className="flex flex-col items-center">
      {rows.map((row, i) => (
        <div key={row.key}>
          {row.type === 'transicao' ? (
            <TransicaoRow curso={row.curso} primeira={row.primeira} faixaCapas={faixaCapas} />
          ) : (
            <AulaRow
              curso={row.curso} slot={row.slot} marco={row.marco} marcoSide={row.marcoSide} offset={offsets[i]}
              nav={nav} isCurrent={`${row.curso.id}:${row.slot.ordem}` === currentSlotKey} profile={profile}
            />
          )}
          {i < rows.length - 1 && <Connector from={offsets[i]} to={offsets[i + 1]} />}
        </div>
      ))}
    </div>
  );
}

/** Curva suave (bezier em S) entre a casa anterior e a próxima — é o que dá o efeito "cobra" à trilha. */
function Connector({ from, to }: { from: number; to: number }) {
  const w = 200;
  const cx = w / 2;
  const x1 = cx + from;
  const x2 = cx + to;
  return (
    <svg width={w} height={CONNECTOR_H} viewBox={`0 0 ${w} ${CONNECTOR_H}`} className="block mx-auto text-line" aria-hidden>
      <path
        d={`M ${x1} 0 C ${x1} ${CONNECTOR_H * 0.55}, ${x2} ${CONNECTOR_H * 0.45}, ${x2} ${CONNECTOR_H}`}
        fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="6 6" strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Bloco de transição de faixa: a capa do curso, um pouco maior que as
   casas normais, mas dentro da mesma coluna — não interrompe a trilha. ── */
function TransicaoRow({ curso, primeira, faixaCapas }: { curso: Curso; primeira: boolean; faixaCapas: Record<string, string | null> }) {
  const capa = resolveCapaUrl(curso.capaUrl, curso.faixa, faixaCapas);
  return (
    <div className="flex flex-col items-center gap-2" style={{ width: TRANSITION_TILE }}>
      {!primeira && <p className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider">Próxima faixa</p>}
      <div className="relative rounded-2xl overflow-hidden border-2 border-brand/40 shadow-ma-2" style={{ width: TRANSITION_TILE, height: TRANSITION_TILE * 0.72 }}>
        {capa ? <SignedImage bucket="capas" path={capa} className="absolute inset-0 w-full h-full object-cover" alt="" /> : <div className="absolute inset-0 bg-brand/10" />}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('w-3 h-3 rounded-full flex-shrink-0', FAIXA_DOT_CLASS[curso.faixa ?? ''] ?? 'bg-line')} />
        <h2 className="text-fg text-sm font-medium text-center">{curso.titulo}</h2>
      </div>
    </div>
  );
}

/* ── Bloco de aula, com marco lateral (desktop) ou embutido embaixo
   (mobile), e o avatar do aluno flutuando sobre a casa atual. ── */
function AulaRow({ curso, slot, marco, marcoSide, offset, nav, isCurrent, profile }: {
  curso: Curso; slot: Slot; marco: Marco | null; marcoSide: 'left' | 'right' | null; offset: number;
  nav: (path: string) => void; isCurrent: boolean;
  profile: { nome?: string | null; email?: string; avatar_url?: string | null } | null;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <div className="hidden lg:flex justify-end flex-shrink-0" style={{ width: GUTTER_W }}>
          {marcoSide === 'left' && <MarcoCallout marco={marco!} side="left" />}
        </div>

        <div className="relative flex-shrink-0" style={{ width: TILE, height: TILE, transform: `translateX(${offset}px)` }}>
          {isCurrent && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
              <Avatar name={profile?.nome} email={profile?.email} src={profile?.avatar_url} size={34} className="ring-2 ring-brand shadow-ma-2" />
            </div>
          )}
          <TileButton slot={slot} cursoId={curso.id} faixa={curso.faixa} nav={nav} isCurrent={isCurrent} />
        </div>

        <div className="hidden lg:flex justify-start flex-shrink-0" style={{ width: GUTTER_W }}>
          {marcoSide === 'right' && <MarcoCallout marco={marco!} side="right" />}
        </div>
      </div>

      {marco && (
        <div className="lg:hidden mt-3 mx-auto rounded-lg border border-line bg-panel-2/70 p-3 text-xs" style={{ maxWidth: 360 }}>
          <p className="text-fg font-semibold leading-snug mb-1">{marco.titulo}</p>
          <p className="text-fg-3 leading-snug">{marco.desc}</p>
        </div>
      )}
    </div>
  );
}

/** A seta parte da casa (borda mais próxima) e chega até o card de texto. */
function MarcoCallout({ marco, side }: { marco: Marco; side: 'left' | 'right' }) {
  const card = (
    <div className="rounded-lg border border-brand/30 bg-panel-2/80 p-3 text-xs" style={{ width: GUTTER_W - 48 }}>
      <p className="text-fg font-semibold leading-snug mb-1">{marco.titulo}</p>
      <p className="text-fg-3 leading-snug">{marco.desc}</p>
    </div>
  );
  const arrow = (
    <div className="flex items-center flex-shrink-0" style={{ width: 32 }}>
      {side === 'left' ? (
        <><span className="flex-1 h-0 border-t-2 border-dashed border-brand/50" /><ChevronLeft className="w-4 h-4 text-brand flex-shrink-0" /></>
      ) : (
        <><ChevronRight className="w-4 h-4 text-brand flex-shrink-0" /><span className="flex-1 h-0 border-t-2 border-dashed border-brand/50" /></>
      )}
    </div>
  );
  return side === 'left' ? <>{card}{arrow}</> : <>{arrow}{card}</>;
}

function TileButton({ slot, cursoId, faixa, nav, isCurrent }: {
  slot: Slot; cursoId: string; faixa: string | null; nav: (path: string) => void; isCurrent: boolean;
}) {
  const available = !!slot.aula;
  const go = () => { if (available) nav(`/curso/${cursoId}?aula=${slot.aula!.id}`); };
  return (
    <button
      id={`slot-${cursoId}:${slot.ordem}`}
      onClick={go}
      disabled={!available}
      title={available ? (slot.aula!.titulo || `Aula ${slot.ordem}`) : 'Em breve'}
      className={cn(
        'w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-colors relative',
        available ? 'cursor-pointer hover:brightness-110' : 'cursor-default',
        isCurrent ? 'border-brand ring-4 ring-brand/25 bg-brand/20'
          : slot.done ? 'bg-brand border-brand text-brand-ink'
          : available ? cn('border-line', FAIXA_BG_CLASS[faixa ?? ''] ?? 'bg-panel')
          : 'bg-white/5 border-white/10',
      )}
    >
      {slot.done ? <Check className="w-7 h-7 text-brand-ink" /> : available ? <PlayCircle className="w-7 h-7 text-brand" /> : <Lock className="w-5 h-5 text-white/25" />}
      <span className={cn('text-xs font-semibold tabular-nums', slot.done ? 'text-brand-ink' : available ? 'text-fg-2' : 'text-white/25')}>
        {slot.ordem}
      </span>
    </button>
  );
}
