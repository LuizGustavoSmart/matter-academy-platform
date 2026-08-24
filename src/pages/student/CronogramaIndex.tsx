import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getSignedUrl } from '../../lib/storage';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton, Avatar, cn } from '../../components/ui';
import { FAIXA_OPTIONS, ordemDaFaixa, labelDaFaixa } from '../../lib/faixa';

const AULAS_POR_FAIXA = 12;

/* ── Geometria da trilha ──────────────────────────────────────────────
   A trilha é UMA ÚNICA tira poligonal contínua: cada casa é um trapézio
   que compartilha a aresta exata com a casa vizinha (sem gaps, sem
   conectores separados). O ângulo de cada casa varia continuamente, como
   uma onda (seno) — nunca fica reto, sempre inclinando levemente para um
   lado ou outro, num ciclo completo a cada `WAVE_PERIOD` casas. As capas
   de faixa são casas maiores dentro da mesma tira. ── */
const ANGLE_MAX = (26 * Math.PI) / 180;
const WAVE_PERIOD = 14;
const AULA_LEN = 62;
const CAPA_LEN = 100;
const TRACK_W = 84;
const MARGIN = 56;
const MARCO_GAP = 76;
const MARCO_W = 240;

const FAIXA_FILL: Record<string, string> = {
  branca: 'fill-white/10', verde: 'fill-emerald-500/25', marrom: 'fill-amber-700/30', preta: 'fill-zinc-400/25',
};
const FAIXA_CAPA_FILL: Record<string, string> = {
  branca: 'fill-white/20', verde: 'fill-emerald-500/45', marrom: 'fill-amber-700/55', preta: 'fill-zinc-400/45',
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

type SeqItem =
  | { type: 'capa'; key: string; curso: Curso }
  | { type: 'aula'; key: string; curso: Curso; slot: Slot; marco: Marco | null };

type TileGeom = {
  pathD: string; centroidX: number; centroidY: number; dirAngle: number;
  perpX: number; perpY: number; item: SeqItem;
};

type Pt = readonly [number, number];
type BezierSeg = { c1: Pt; c2: Pt };

/** Spline Catmull-Rom convertida em Béziers — dá o contorno arredondado "de rio",
    com continuidade de tangente exata entre segmentos vizinhos (sem quebras nas junções). */
function catmullRomSegments(pts: Pt[]): BezierSeg[] {
  const n = pts.length;
  const segs: BezierSeg[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, n - 1)];
    segs.push({
      c1: [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      c2: [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
    });
  }
  return segs;
}

/** Divide a sequência em trapézios contíguos — cada casa compartilha a aresta exata com a próxima. */
function buildTrack(seq: SeqItem[]) {
  const n = seq.length;
  const lens = seq.map((it) => (it.type === 'capa' ? CAPA_LEN : AULA_LEN));
  // Onda contínua — o ângulo nunca fica constante por muitas casas, então o
  // caminho nunca parece reto, só ondula suavemente de um lado para o outro.
  const dirs: number[] = [];
  for (let i = 0; i < n; i++) dirs.push(ANGLE_MAX * Math.sin((2 * Math.PI * i) / WAVE_PERIOD));
  const jointAngle: number[] = new Array(n + 1);
  jointAngle[0] = dirs[0];
  jointAngle[n] = dirs[n - 1];
  for (let j = 1; j < n; j++) jointAngle[j] = (dirs[j - 1] + dirs[j]) / 2;

  const cx = [0], cy = [0];
  for (let i = 0; i < n; i++) {
    cx.push(cx[i] + Math.sin(dirs[i]) * lens[i]);
    cy.push(cy[i] - Math.cos(dirs[i]) * lens[i]);
  }
  const leftX: number[] = [], leftY: number[] = [], rightX: number[] = [], rightY: number[] = [];
  for (let j = 0; j <= n; j++) {
    const a = jointAngle[j];
    const px = Math.cos(a), py = Math.sin(a);
    leftX.push(cx[j] + (px * TRACK_W) / 2); leftY.push(cy[j] + (py * TRACK_W) / 2);
    rightX.push(cx[j] - (px * TRACK_W) / 2); rightY.push(cy[j] - (py * TRACK_W) / 2);
  }

  const minX = Math.min(...leftX, ...rightX), maxX = Math.max(...leftX, ...rightX);
  const minY = Math.min(...leftY, ...rightY), maxY = Math.max(...leftY, ...rightY);
  const ox = -minX + MARGIN, oy = -minY + MARGIN;
  const shift = (x: number, y: number): Pt => [x + ox, y + oy];

  const leftPts: Pt[] = leftX.map((x, j) => shift(x, leftY[j]));
  const rightPts: Pt[] = rightX.map((x, j) => shift(x, rightY[j]));
  const leftSegs = catmullRomSegments(leftPts);
  const rightSegs = catmullRomSegments(rightPts);

  const tiles: TileGeom[] = seq.map((item, i) => {
    const [lx0, ly0] = leftPts[i]; const [lx1, ly1] = leftPts[i + 1];
    const [rx0, ry0] = rightPts[i]; const [rx1, ry1] = rightPts[i + 1];
    const lc1 = leftSegs[i].c1, lc2 = leftSegs[i].c2;
    const rc1 = rightSegs[i].c1, rc2 = rightSegs[i].c2;
    const pathD = [
      `M ${lx0},${ly0}`,
      `C ${lc1[0]},${lc1[1]} ${lc2[0]},${lc2[1]} ${lx1},${ly1}`,
      `L ${rx1},${ry1}`,
      `C ${rc2[0]},${rc2[1]} ${rc1[0]},${rc1[1]} ${rx0},${ry0}`,
      'Z',
    ].join(' ');
    const a = dirs[i];
    return {
      pathD,
      centroidX: (lx0 + lx1 + rx0 + rx1) / 4,
      centroidY: (ly0 + ly1 + ry0 + ry1) / 4,
      dirAngle: a,
      perpX: Math.cos(a), perpY: Math.sin(a),
      item,
    };
  });

  const width = (maxX - minX) + MARGIN * 2;
  const height = (maxY - minY) + MARGIN * 2;

  // Borda externa contínua: percorre a curva esquerda inteira, cruza no fim,
  // volta pela curva direita inteira (na direção inversa) e cruza no início.
  const borderParts = [`M ${leftPts[0][0]},${leftPts[0][1]}`];
  leftSegs.forEach((seg, i) => {
    const [x, y] = leftPts[i + 1];
    borderParts.push(`C ${seg.c1[0]},${seg.c1[1]} ${seg.c2[0]},${seg.c2[1]} ${x},${y}`);
  });
  const lastRight = rightPts[rightPts.length - 1];
  borderParts.push(`L ${lastRight[0]},${lastRight[1]}`);
  for (let i = rightSegs.length - 1; i >= 0; i--) {
    const seg = rightSegs[i];
    const [x, y] = rightPts[i];
    borderParts.push(`C ${seg.c2[0]},${seg.c2[1]} ${seg.c1[0]},${seg.c1[1]} ${x},${y}`);
  }
  borderParts.push('Z');
  const borderPath = borderParts.join(' ');

  // Divisórias internas entre casas — traços retos, como cortes transversais no rio.
  const dividerLines = leftPts.slice(1, -1).map((_, j) => {
    const i = j + 1;
    return `M ${leftPts[i][0]},${leftPts[i][1]} L ${rightPts[i][0]},${rightPts[i][1]}`;
  }).join(' ');

  return { tiles, width, height, borderPath, dividerLines };
}

export default function CronogramaIndex() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [slotsPorCurso, setSlotsPorCurso] = useState<Record<string, Slot[]>>({});
  const [currentSlotKey, setCurrentSlotKey] = useState<string | null>(null);
  const [capaUrls, setCapaUrls] = useState<Record<string, string>>({});
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

      const faixasPresentes = new Set(cursosReais.map((c) => c.faixa));
      const cursosVirtuais: Curso[] = FAIXA_OPTIONS
        .filter((o) => !faixasPresentes.has(o.value))
        .map((o) => ({ id: `virtual-${o.value}`, titulo: labelDaFaixa(o.value) ?? o.label, capaUrl: null, faixa: o.value }));

      const cursosOrdenados: Curso[] = [...cursosReais, ...cursosVirtuais].sort((a, b) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa));

      const urls: Record<string, string> = {};
      await Promise.all(cursosOrdenados.map(async (c) => {
        if (!c.capaUrl) return;
        try { const u = await getSignedUrl('capas', c.capaUrl); if (u) urls[c.id] = u; } catch { /* sem capa */ }
      }));

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
          slots.push({ ordem, aula, done: aula ? doneSet.has(aula.id) : false });
        }
        map[curso.id] = slots;
        if (!currentKey) {
          const proxima = slots.find((s) => s.aula && !s.done);
          if (proxima) currentKey = `${curso.id}:${proxima.ordem}`;
        }
      }

      setCursos(cursosOrdenados);
      setCapaUrls(urls);
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6 text-center">
        <h1 className="mb-0.5">Cronograma</h1>
        <p className="text-fg-3 text-sm">Sua trilha de aulas — avance faixa por faixa, como num tabuleiro.</p>
      </header>

      {loading ? (
        <div className="space-y-4 max-w-md mx-auto">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : cursos.length === 0 ? (
        <p className="text-fg-3 text-sm text-center">Aguarde o administrador liberar conteúdo para suas turmas.</p>
      ) : (
        <Board cursos={cursos} slotsPorCurso={slotsPorCurso} currentSlotKey={currentSlotKey} capaUrls={capaUrls} nav={nav} profile={profile} />
      )}
    </div>
  );
}

function Board({ cursos, slotsPorCurso, currentSlotKey, capaUrls, nav, profile }: {
  cursos: Curso[]; slotsPorCurso: Record<string, Slot[]>; currentSlotKey: string | null; capaUrls: Record<string, string>;
  nav: (path: string) => void;
  profile: { nome?: string | null; email?: string; avatar_url?: string | null } | null;
}) {
  const seq: SeqItem[] = useMemo(() => {
    const list: SeqItem[] = [];
    cursos.forEach((curso) => {
      list.push({ type: 'capa', key: `capa-${curso.id}`, curso });
      const marcosDoCurso = curso.faixa ? MARCOS[curso.faixa] ?? [] : [];
      (slotsPorCurso[curso.id] ?? []).forEach((slot) => {
        const marco = marcosDoCurso.find((m) => m.ordem === slot.ordem) ?? null;
        list.push({ type: 'aula', key: `${curso.id}-${slot.ordem}`, curso, slot, marco });
      });
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursos, slotsPorCurso]);

  const track = useMemo(() => buildTrack(seq), [seq]);

  let marcoToggle = 0;
  const marcoCards: { x: number; y: number; side: 'left' | 'right'; marco: Marco }[] = [];
  track.tiles.forEach((tile) => {
    if (tile.item.type !== 'aula' || !tile.item.marco) return;
    const side: 'left' | 'right' = marcoToggle++ % 2 === 0 ? 'left' : 'right';
    const dir = side === 'left' ? 1 : -1;
    const x = tile.centroidX + tile.perpX * dir * (TRACK_W / 2 + MARCO_GAP);
    const y = tile.centroidY + tile.perpY * dir * (TRACK_W / 2 + MARCO_GAP);
    marcoCards.push({ x, y, side, marco: tile.item.marco });
  });

  const current = track.tiles.find((t) => t.item.type === 'aula' && `${t.item.curso.id}:${t.item.slot.ordem}` === currentSlotKey);

  return (
    <div className="overflow-x-auto">
      <div className="relative mx-auto" style={{ width: track.width, height: track.height }}>
        <svg width={track.width} height={track.height} viewBox={`0 0 ${track.width} ${track.height}`} className="block">
          <path d={track.borderPath} className="fill-panel stroke-line" strokeWidth={2} />
          {track.tiles.map((tile) => (
            <TileShape key={tile.item.key} tile={tile} capaUrls={capaUrls} isCurrent={tile === current} nav={nav} />
          ))}
          <path d={track.dividerLines} className="stroke-black/20" strokeWidth={1.5} fill="none" />
          {current && (
            <path d={current.pathD} className="fill-none stroke-brand" strokeWidth={3} />
          )}
        </svg>

        {current && (
          <div className="absolute z-10" style={{ left: current.centroidX, top: current.centroidY - TRACK_W / 2 - 16, transform: 'translate(-50%, -100%)' }}>
            <Avatar name={profile?.nome} email={profile?.email} src={profile?.avatar_url} size={36} className="ring-2 ring-brand shadow-ma-2" />
          </div>
        )}

        {marcoCards.map((m, i) => (
          <div
            key={i}
            className="hidden lg:block absolute rounded-lg border border-brand/30 bg-panel-2/90 p-3 text-xs shadow-ma-1"
            style={{
              width: MARCO_W,
              left: m.x, top: m.y,
              transform: m.side === 'left' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
            }}
          >
            <p className="text-fg font-semibold leading-snug mb-1">{m.marco.titulo}</p>
            <p className="text-fg-3 leading-snug">{m.marco.desc}</p>
          </div>
        ))}
      </div>

      {/* Em telas menores os marcos ficam listados abaixo do tabuleiro, já que não há espaço lateral. */}
      <div className="lg:hidden max-w-xl mx-auto mt-6 space-y-2">
        {marcoCards.map((m, i) => (
          <div key={i} className="rounded-lg border border-line bg-panel-2/70 p-3 text-xs">
            <p className="text-fg font-semibold leading-snug mb-1">{m.marco.titulo}</p>
            <p className="text-fg-3 leading-snug">{m.marco.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TileShape({ tile, capaUrls, isCurrent, nav }: {
  tile: TileGeom; capaUrls: Record<string, string>; isCurrent: boolean; nav: (path: string) => void;
}) {
  const { item } = tile;
  const clipId = `clip-${item.key}`;

  if (item.type === 'capa') {
    const url = capaUrls[item.curso.id];
    return (
      <g>
        <defs><clipPath id={clipId}><path d={tile.pathD} /></clipPath></defs>
        <path d={tile.pathD} className={FAIXA_CAPA_FILL[item.curso.faixa ?? ''] ?? 'fill-panel-3'} />
        {url && (
          <image
            href={url} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice"
            x={tile.centroidX - CAPA_LEN} y={tile.centroidY - CAPA_LEN} width={CAPA_LEN * 2} height={CAPA_LEN * 2}
          />
        )}
        <text x={tile.centroidX} y={tile.centroidY} textAnchor="middle" dominantBaseline="middle" className="fill-fg text-[13px] font-semibold" style={{ paintOrder: 'stroke', stroke: 'rgba(11,12,14,0.65)', strokeWidth: 4 }}>
          {item.curso.titulo}
        </text>
      </g>
    );
  }

  const { slot } = item;
  const available = !!slot.aula;
  const go = () => { if (available) nav(`/curso/${item.curso.id}?aula=${slot.aula!.id}`); };
  const fillClass = isCurrent
    ? 'fill-brand/35'
    : slot.done ? 'fill-brand'
    : available ? (FAIXA_FILL[item.curso.faixa ?? ''] ?? 'fill-panel-3')
    : 'fill-white/5';

  return (
    <g id={`slot-${item.curso.id}:${slot.ordem}`} onClick={go} className={available ? 'cursor-pointer' : 'cursor-default'}>
      <path d={tile.pathD} className={fillClass} />
      <text
        x={tile.centroidX} y={tile.centroidY} textAnchor="middle" dominantBaseline="middle"
        className={cn('text-[15px] font-bold tabular-nums select-none', slot.done ? 'fill-brand-ink' : available ? 'fill-fg' : 'fill-white/25')}
      >
        {slot.done ? '✓' : slot.ordem}
      </text>
    </g>
  );
}
