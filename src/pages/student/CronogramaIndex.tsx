import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getSignedUrl } from '../../lib/storage';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton, Avatar, cn } from '../../components/ui';
import { FAIXA_OPTIONS, ordemDaFaixa, labelDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';
import { FAIXA_CRONOGRAMA_IMG } from '../../lib/faixaCronogramaImgs';

const AULAS_POR_FAIXA = 12;

/* ── Geometria da trilha ──────────────────────────────────────────────
   A trilha é UMA ÚNICA tira poligonal contínua: cada casa é um trapézio
   que compartilha a aresta exata com a casa vizinha (sem gaps, sem
   conectores separados). O ângulo segue uma onda contínua (senoide) —
   nunca fica reto por várias casas seguidas, sempre curvando. O período é
   curto de propósito: o board inteiro é escalado para caber na largura da
   tela, então quanto menor o alcance horizontal do balanço, maior cada
   casa aparece renderizada. A amplitude passa de 90°, então em alguns
   trechos a trilha chega a inclinar de volta "para baixo" por um instante,
   como uma curva bem fechada de rio. As capas de faixa são casas maiores
   dentro da mesma tira. ── */
const ANGLE_MAX = (98 * Math.PI) / 180;
const WAVE_PERIOD = 18;
const AULA_LEN = 108;
// Proporção ~4:3, igual à arte das capas — preenche o retângulo sem sobrar margem.
const CAPA_LEN = 176;
const TRACK_W = 132;
const MARGIN = 140;
const INICIO_R = TRACK_W * 0.62;
const INICIO_GAP = 18;
/** Faixa lateral fixa, fora de qualquer trecho possível da trilha — os
    marcos ficam sempre aqui, nunca sobrepondo as casas do tabuleiro. */
const GUTTER_W = 250;
const MARCO_W = 222;
const CAPA_RX = 16;

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

// Só as aulas 6 e 12 (final) marcam um momento — cada texto já incorpora as
// características que antes estavam nas aulas 3 e 9, condensadas.
const MARCOS: Record<string, { ordem: number; titulo: string; desc: string }[]> = {
  branca: [
    { ordem: 6, titulo: 'Aula 6 — Usuário Profissional & Especialista em Prompt', desc: 'Domina os fundamentos da IA generativa e o ChatGPT, e já estrutura prompts avançados para pesquisar, sintetizar e produzir relatórios com mais qualidade.' },
    { ordem: 12, titulo: 'Final — Criador Multimídia & Profissional AI-First', desc: 'Cria conteúdos visuais, apresentações e análises de dados com IA, e integra tudo à rotina de trabalho com produtividade e uso responsável.' },
  ],
  verde: [
    { ordem: 6, titulo: 'Aula 6 — Multi-IA & Arquiteto de Processos', desc: 'Combina ferramentas de IA para pesquisar e decidir com mais produtividade, e já redesenha processos com agentes e múltiplas IAs em fluxos AI-First.' },
    { ordem: 12, titulo: 'Final — Automações & Profissional AI-First de Processos', desc: 'Conecta ferramentas como Zapier, Make e n8n em automações integradas, e projeta processos de ponta a ponta com governança e ganhos sustentáveis.' },
  ],
  marrom: [
    { ordem: 6, titulo: 'Aula 6 — Construtor de Agentes & Prototipador', desc: 'Cria agentes de IA especializados e já transforma esses agentes em produtos funcionais, usando vibe coding e dados vivos além de uma simples conversa.' },
    { ordem: 12, titulo: 'Final — Produtos Autônomos & Criador de Negócios com IA', desc: 'Constrói produtos que interagem com o mundo e executam ações com autonomia, e transforma essa solução em uma proposta de negócio viável e real.' },
  ],
  preta: [
    { ordem: 6, titulo: 'Aula 6 — Estrategista & Líder da Transformação', desc: 'Avalia a maturidade da organização e constrói a narrativa estratégica, estruturando governança, cultura e capacitação para a adoção de IA em escala.' },
    { ordem: 12, titulo: 'Final — Orquestrador & Líder Estratégico de IA', desc: 'Mobiliza stakeholders e conduz a mudança com métricas de impacto, construindo e defendendo um plano estratégico de IA executável para a organização.' },
  ],
};

type SeqItem =
  | { type: 'capa'; key: string; curso: Curso }
  | { type: 'aula'; key: string; curso: Curso; slot: Slot; marco: Marco | null };

type TileGeom = {
  pathD: string; centroidX: number; centroidY: number; dirAngle: number; item: SeqItem;
  edgeLeft: Pt; edgeRight: Pt;
  rectBounds: { x: number; y: number; w: number; h: number } | null;
};

type Pt = readonly [number, number];
type BezierSeg = { c1: Pt; c2: Pt };

/** Spline Catmull-Rom convertida em Béziers — dá o contorno arredondado "de rio",
    com continuidade de tangente exata entre segmentos vizinhos (sem quebras nas junções). */
function catmullRomSegments(pts: Pt[], hardIdx: Set<number> = new Set()): BezierSeg[] {
  const n = pts.length;
  const segs: BezierSeg[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    // Os dois cortes de um bloco de capa são cantos "duros" (mudança brusca
    // de direção, de propósito). Olhar através deles para estimar a tangente
    // da casa vizinha é o que produzia a curva estranha logo antes/depois da
    // capa — então, exatamente como nas pontas do traçado (Math.max/min
    // acima), duplicamos o próprio ponto em vez de alcançar o outro lado do canto.
    const p0 = (i - 1 < 0 || hardIdx.has(i - 1)) ? p1 : pts[i - 1];
    const p3 = (i + 2 > n - 1 || hardIdx.has(i + 2)) ? p2 : pts[i + 2];
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
  // Onda contínua — o ângulo nunca fica constante por várias casas seguidas,
  // então o caminho nunca parece reto, só ondula de um lado para o outro
  // (a amplitude passa de 90°, então nos picos a trilha chega a apontar de
  // volta "para baixo" por um instante, como uma curva bem fechada de rio).
  const dirs: number[] = [];
  for (let i = 0; i < n; i++) dirs.push(ANGLE_MAX * Math.sin((2 * Math.PI * i) / WAVE_PERIOD));
  // Um bloco de capa vira uma casa puramente horizontal (±90°), para que os
  // dois cortes (entrada/saída) fiquem verticais — exatamente as laterais de
  // um retângulo comum. Mantém o sentido (esquerda/direita) que a onda já
  // tinha naquele ponto, só "achata" o ângulo em vez de trocar de lado.
  const capaIndexes: number[] = [];
  seq.forEach((it, i) => {
    if (it.type !== 'capa') return;
    capaIndexes.push(i);
    dirs[i] = dirs[i] >= 0 ? Math.PI / 2 : -Math.PI / 2;
  });

  const jointAngle: number[] = new Array(n + 1);
  jointAngle[0] = dirs[0];
  jointAngle[n] = dirs[n - 1];
  for (let j = 1; j < n; j++) jointAngle[j] = (dirs[j - 1] + dirs[j]) / 2;
  // Força os dois cortes da capa a ficarem exatamente no ângulo horizontal
  // da própria capa (não a média com a casa vizinha) — sem isso, a aresta
  // compartilhada ficaria levemente inclinada e o retângulo não fecharia certo.
  capaIndexes.forEach((i) => { jointAngle[i] = dirs[i]; jointAngle[i + 1] = dirs[i]; });

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
  // Desloca em X por GUTTER_W (não MARGIN) — reserva as faixas laterais fixas
  // dos marcos fora do alcance de qualquer trecho da trilha, por mais que ela balance.
  const ox = -minX + GUTTER_W, oy = -minY + MARGIN;
  const shift = (x: number, y: number): Pt => [x + ox, y + oy];

  const leftPts: Pt[] = leftX.map((x, j) => shift(x, leftY[j]));
  const rightPts: Pt[] = rightX.map((x, j) => shift(x, rightY[j]));
  // Só o lado que de fato "olhava através" do canto vira limite — o outro
  // lado de cada capa não tinha esse problema e deve continuar exatamente
  // como antes. Entrada da capa (k) é o canto que distorcia a lateral
  // esquerda da casa seguinte; saída da capa (k+1) é o canto que distorcia
  // a lateral direita da casa anterior.
  const leftHardIdx = new Set<number>();
  const rightHardIdx = new Set<number>();
  capaIndexes.forEach((i) => { leftHardIdx.add(i); rightHardIdx.add(i + 1); });
  const leftSegs = catmullRomSegments(leftPts, leftHardIdx);
  const rightSegs = catmullRomSegments(rightPts, rightHardIdx);

  const tiles: TileGeom[] = seq.map((item, i) => {
    const [lx0, ly0] = leftPts[i]; const [lx1, ly1] = leftPts[i + 1];
    const [rx0, ry0] = rightPts[i]; const [rx1, ry1] = rightPts[i + 1];
    // O bloco de capa é um retângulo de verdade (cantos/arestas retos) — como
    // os dois cortes já foram forçados a ficar verticais acima, um contorno
    // reto aqui fecha exatamente igual a um <rect>, sem precisar de curva.
    const pathD = item.type === 'capa'
      ? `M ${lx0},${ly0} L ${lx1},${ly1} L ${rx1},${ry1} L ${rx0},${ry0} Z`
      : [
        `M ${lx0},${ly0}`,
        `C ${leftSegs[i].c1[0]},${leftSegs[i].c1[1]} ${leftSegs[i].c2[0]},${leftSegs[i].c2[1]} ${lx1},${ly1}`,
        `L ${rx1},${ry1}`,
        `C ${rightSegs[i].c2[0]},${rightSegs[i].c2[1]} ${rightSegs[i].c1[0]},${rightSegs[i].c1[1]} ${rx0},${ry0}`,
        'Z',
      ].join(' ');
    return {
      pathD,
      centroidX: (lx0 + lx1 + rx0 + rx1) / 4,
      centroidY: (ly0 + ly1 + ry0 + ry1) / 4,
      dirAngle: dirs[i],
      item,
      edgeLeft: [(lx0 + lx1) / 2, (ly0 + ly1) / 2] as Pt,
      edgeRight: [(rx0 + rx1) / 2, (ry0 + ry1) / 2] as Pt,
      rectBounds: item.type === 'capa'
        ? { x: Math.min(lx0, lx1, rx0, rx1), y: Math.min(ly0, ly1, ry0, ry1), w: Math.abs(lx1 - lx0) || Math.abs(rx1 - rx0), h: Math.abs(ry0 - ly0) || Math.abs(ry1 - ly1) }
        : null,
    };
  });

  const width = (maxX - minX) + GUTTER_W * 2;
  const height = (maxY - minY) + MARGIN * 2;

  const isCapaSeg = (i: number) => seq[i]?.type === 'capa';

  // Borda externa contínua: percorre a curva esquerda inteira, cruza no fim,
  // volta pela curva direita inteira (na direção inversa) e cruza no início.
  // Nos trechos de capa usa linha reta, para casar exatamente com o retângulo
  // desenhado por cima (senão a curva "vazaria" um pouco atrás dele).
  const borderParts = [`M ${leftPts[0][0]},${leftPts[0][1]}`];
  leftSegs.forEach((seg, i) => {
    const [x, y] = leftPts[i + 1];
    borderParts.push(isCapaSeg(i) ? `L ${x},${y}` : `C ${seg.c1[0]},${seg.c1[1]} ${seg.c2[0]},${seg.c2[1]} ${x},${y}`);
  });
  const lastRight = rightPts[rightPts.length - 1];
  borderParts.push(`L ${lastRight[0]},${lastRight[1]}`);
  for (let i = rightSegs.length - 1; i >= 0; i--) {
    const seg = rightSegs[i];
    const [x, y] = rightPts[i];
    borderParts.push(isCapaSeg(i) ? `L ${x},${y}` : `C ${seg.c2[0]},${seg.c2[1]} ${seg.c1[0]},${seg.c1[1]} ${x},${y}`);
  }
  borderParts.push('Z');
  const borderPath = borderParts.join(' ');

  // Divisórias internas entre casas — traços retos, como cortes transversais no
  // rio. Pulamos as junções que tocam um bloco de capa: ele é desenhado como um
  // retângulo comum por cima da trilha, e essas linhas cruzariam por dentro dele.
  const skipJoints = new Set<number>();
  seq.forEach((it, i) => { if (it.type === 'capa') { skipJoints.add(i); skipJoints.add(i + 1); } });
  const dividerLines = leftPts.slice(1, -1).map((_, j) => {
    const i = j + 1;
    if (skipJoints.has(i)) return '';
    return `M ${leftPts[i][0]},${leftPts[i][1]} L ${rightPts[i][0]},${rightPts[i][1]}`;
  }).filter(Boolean).join(' ');

  const startMid: Pt = [(leftPts[0][0] + rightPts[0][0]) / 2, (leftPts[0][1] + rightPts[0][1]) / 2];
  const startForward: Pt = [Math.sin(dirs[0]), -Math.cos(dirs[0])];

  return { tiles, width, height, borderPath, dividerLines, startMid, startForward };
}

/** Semicírculo — usado só no bloco decorativo "Início". A metade cortada
    (o diâmetro) fica virada para `forward`; o arco arredondado bojeia para
    o lado oposto (para trás, longe da primeira casa). */
function semicirclePath(center: Pt, radius: number, forward: Pt): string {
  const af = Math.atan2(forward[1], forward[0]);
  const start = af + Math.PI / 2;
  const steps = 24;
  const pts: Pt[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = start + (Math.PI * s) / steps;
    pts.push([center[0] + radius * Math.cos(t), center[1] + radius * Math.sin(t)]);
  }
  return `M ${pts.map((p) => p.join(',')).join(' L ')} Z`;
}

export default function CronogramaIndex() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const faixaCapas = useFaixaCapas();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [slotsPorCurso, setSlotsPorCurso] = useState<Record<string, Slot[]>>({});
  const [currentSlotKey, setCurrentSlotKey] = useState<string | null>(null);
  const [capaUrls, setCapaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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

      // Usa a capa do próprio curso; se ele ainda não tiver uma, cai para a
      // capa padrão já cadastrada para aquela faixa (faixa_capas).
      const urls: Record<string, string> = {};
      await Promise.all(cursosOrdenados.map(async (c) => {
        const path = resolveCapaUrl(c.capaUrl, c.faixa, faixaCapas);
        if (!path) return;
        try { const u = await getSignedUrl('capas', path); if (u) urls[c.id] = u; } catch { /* sem capa */ }
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
      // aprovacoes ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: aprov } = cursoIdsReais.length
        ? await (supabase as any).from('aprovacoes').select('curso_id').eq('user_id', profile.id).eq('aprovado', true).in('curso_id', cursoIdsReais)
        : { data: [] };
      const aprovadoSet = new Set(((aprov ?? []) as { curso_id: string }[]).map((a) => a.curso_id));

      // O avatar fica na aula mais avançada já concluída (não na "próxima
      // pendente") — por isso percorremos tudo em ordem e guardamos a última
      // marcada como feita, em vez de parar no primeiro slot incompleto.
      // Se o aluno foi aprovado numa faixa, o avatar avança até a casa de
      // graduação (capa) daquele curso, mesmo que nem todas as aulas estejam
      // marcadas como concluídas. Se nada foi concluído/aprovado ainda,
      // `lastDoneKey` continua null e o avatar cai no bloco "Início".
      let lastDoneKey: string | null = null;
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
          if (done) lastDoneKey = `${curso.id}:${ordem}`;
        }
        map[curso.id] = slots;
        if (aprovadoSet.has(curso.id)) lastDoneKey = `${curso.id}:capa`;
      }
      const currentKey = lastDoneKey;

      setCursos(cursosOrdenados);
      setCapaUrls(urls);
      setSlotsPorCurso(map);
      setCurrentSlotKey(currentKey);
      setLoading(false);
    })();
    // faixaCapas carrega de forma assíncrona (cache compartilhado); reprocessa
    // as capas quando ele chegar, para não perder o fallback por faixa.
  }, [profile, faixaCapas]);

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
      // A capa agora vem DEPOIS das 12 aulas — funciona como a "graduação"
      // daquela faixa, não mais como a introdução antes da aula 1.
      const marcosDoCurso = curso.faixa ? MARCOS[curso.faixa] ?? [] : [];
      (slotsPorCurso[curso.id] ?? []).forEach((slot) => {
        const marco = marcosDoCurso.find((m) => m.ordem === slot.ordem) ?? null;
        list.push({ type: 'aula', key: `${curso.id}-${slot.ordem}`, curso, slot, marco });
      });
      list.push({ type: 'capa', key: `capa-${curso.id}`, curso });
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursos, slotsPorCurso]);

  const track = useMemo(() => buildTrack(seq), [seq]);

  let marcoToggle = 0;
  const marcoCards: { y: number; side: 'left' | 'right'; marco: Marco; tileEdgeX: number; tileEdgeY: number }[] = [];
  track.tiles.forEach((tile) => {
    if (tile.item.type !== 'aula' || !tile.item.marco) return;
    const side: 'left' | 'right' = marcoToggle++ % 2 === 0 ? 'left' : 'right';
    // A seta aponta para a borda da casa que fica do MESMO lado da tela em
    // que a casa está (não do lado do marco) — "edgeLeft"/"edgeRight" seguem
    // a convenção interna da geometria (perpendicular à direção da casa),
    // que não corresponde à esquerda/direita real conforme a trilha vira;
    // por isso comparamos as coordenadas X de fato e a posição da casa em
    // relação ao centro do tabuleiro.
    const [screenLeft, screenRight] = tile.edgeLeft[0] <= tile.edgeRight[0]
      ? [tile.edgeLeft, tile.edgeRight]
      : [tile.edgeRight, tile.edgeLeft];
    let tileOnRight = tile.centroidX > track.width / 2;
    // Lado invertido a pedido, para estes dois marcos específicos.
    const { faixa } = tile.item.curso;
    const { ordem } = tile.item.slot;
    if ((faixa === 'preta' && ordem === 6) || (faixa === 'marrom' && ordem === 12)) tileOnRight = !tileOnRight;
    const [ex, ey] = tileOnRight ? screenRight : screenLeft;
    marcoCards.push({ y: tile.centroidY, side, marco: tile.item.marco, tileEdgeX: ex, tileEdgeY: ey });
  });

  const current = track.tiles.find((t) => {
    if (t.item.type === 'aula') return `${t.item.curso.id}:${t.item.slot.ordem}` === currentSlotKey;
    if (t.item.type === 'capa') return `${t.item.curso.id}:capa` === currentSlotKey;
    return false;
  });

  // Centro do bloco "Início" — reaproveitado tanto pelo desenho decorativo
  // quanto pela posição do avatar quando nenhuma aula foi concluída ainda.
  const inicioCenter: Pt = [
    track.startMid[0] - track.startForward[0] * INICIO_GAP,
    track.startMid[1] - track.startForward[1] * INICIO_GAP,
  ];

  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / track.width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [track.width]);

  // Centraliza no elemento atual só depois que a escala do tabuleiro já
  // assentou (senão a rolagem calcula a posição em cima de um layout
  // provisório, ainda em scale=1, e o resultado sai desalinhado).
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current) return;
    scrolledRef.current = true;
    const id = currentSlotKey ? `slot-${currentSlotKey}` : 'slot-inicio';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: 'center', inline: 'center' });
      });
    });
  }, [scale, currentSlotKey]);

  return (
    <>
    <div ref={outerRef} className="w-full" style={{ height: track.height * scale }}>
      <div className="relative mx-auto" style={{ width: track.width, height: track.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <svg width={track.width} height={track.height} viewBox={`0 0 ${track.width} ${track.height}`} className="block overflow-visible">
          <defs>
            <marker id="marco-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" className="fill-brand" />
            </marker>
          </defs>
          <path d={track.borderPath} className="fill-panel stroke-line" strokeWidth={2} />
          {/* Bloco decorativo "Início" — meio círculo colado antes da primeira casa,
              com um pequeno vão entre as duas formas (não faz parte da tira contígua). */}
          {(() => {
            const labelCenter: Pt = [
              inicioCenter[0] - track.startForward[0] * INICIO_R * 0.5,
              inicioCenter[1] - track.startForward[1] * INICIO_R * 0.5,
            ];
            return (
              <g id="slot-inicio">
                <path d={semicirclePath(inicioCenter, INICIO_R, track.startForward)} className="fill-brand/25 stroke-brand" strokeWidth={2} />
                <text x={labelCenter[0]} y={labelCenter[1]} textAnchor="middle" dominantBaseline="middle" className="fill-fg text-[18px] font-bold">
                  Início
                </text>
              </g>
            );
          })()}
          {track.tiles.map((tile) => (
            <TileShape key={tile.item.key} tile={tile} capaUrls={capaUrls} isCurrent={tile === current} nav={nav} />
          ))}
          <path d={track.dividerLines} className="stroke-black/20" strokeWidth={1.5} fill="none" />
          {current && (
            <path d={current.pathD} className="fill-none stroke-brand" strokeWidth={3} />
          )}
          {/* Seta ligando cada marco lateral à casa exata que ele descreve. */}
          {marcoCards.map((m, i) => {
            const anchorX = m.side === 'left' ? GUTTER_W - 12 : track.width - GUTTER_W + 12;
            return (
              <path
                key={i}
                d={`M ${anchorX},${m.y} L ${m.tileEdgeX},${m.tileEdgeY}`}
                className="hidden lg:block stroke-brand/60"
                strokeWidth={1.5} strokeDasharray="5 4" fill="none" markerEnd="url(#marco-arrow)"
              />
            );
          })}
        </svg>

        {(() => {
          // Para "Início" (sem tile próprio), avança na direção real da trilha
          // (não um offset vertical fixo) além do raio do semicírculo, para o
          // avatar sempre ficar visivelmente acima/antes do bloco decorativo,
          // mesmo quando a trilha começa em diagonal e não reto para cima.
          const avatarPos = current
            ? [current.centroidX, current.centroidY - TRACK_W / 2 - 16]
            : [inicioCenter[0] - track.startForward[0] * (INICIO_R + 16), inicioCenter[1] - track.startForward[1] * (INICIO_R + 16)];
          return (
            <div className="absolute z-10" style={{ left: avatarPos[0], top: avatarPos[1], transform: 'translate(-50%, -100%)' }}>
              <Avatar name={profile?.nome} email={profile?.email} src={profile?.avatar_url} size={48} className="ring-2 ring-brand shadow-ma-2" />
            </div>
          );
        })()}

        {marcoCards.map((m, i) => (
          <div
            key={i}
            className="hidden lg:block absolute rounded-lg border border-brand/30 bg-panel-2/90 p-4 text-base shadow-ma-1"
            style={{
              width: MARCO_W,
              top: m.y,
              ...(m.side === 'left' ? { right: `calc(100% - ${GUTTER_W - 12}px)` } : { left: `calc(100% - ${GUTTER_W - 12}px)` }),
              transform: 'translateY(-50%)',
            }}
          >
            <p className="text-fg font-semibold leading-snug mb-1.5">{m.marco.titulo}</p>
            <p className="text-fg-3 text-[15px] leading-snug">{m.marco.desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Em telas menores os marcos ficam listados abaixo do tabuleiro, já que não há espaço lateral. */}
    <div className="lg:hidden max-w-xl mx-auto mt-6 space-y-2">
      {marcoCards.map((m, i) => (
        <div key={i} className="rounded-lg border border-line bg-panel-2/70 p-4 text-base">
          <p className="text-fg font-semibold leading-snug mb-1.5">{m.marco.titulo}</p>
          <p className="text-fg-3 text-[15px] leading-snug">{m.marco.desc}</p>
        </div>
      ))}
    </div>
    </>
  );
}

function TileShape({ tile, capaUrls, isCurrent, nav }: {
  tile: TileGeom; capaUrls: Record<string, string>; isCurrent: boolean; nav: (path: string) => void;
}) {
  const { item } = tile;
  const clipId = `clip-${item.key}`;

  if (item.type === 'capa') {
    // No cronograma o bloco de faixa usa sempre a arte oficial de graduação,
    // independente da capa cadastrada no curso.
    const url = FAIXA_CRONOGRAMA_IMG[item.curso.faixa ?? ''] ?? capaUrls[item.curso.id];
    const { x: rx, y: ry, w, h } = tile.rectBounds ?? { x: tile.centroidX, y: tile.centroidY, w: 0, h: 0 };
    // Retângulo de verdade — mesmas dimensões exatas da própria trilha nesse
    // trecho (forçado a ficar horizontal), então encosta perfeitamente nas
    // casas vizinhas, sem sobrepor nem deixar vão.
    return (
      <g id={`slot-${item.curso.id}:capa`}>
        <defs><clipPath id={clipId}><rect x={rx} y={ry} width={w} height={h} rx={CAPA_RX} /></clipPath></defs>
        <rect x={rx} y={ry} width={w} height={h} rx={CAPA_RX} className={FAIXA_CAPA_FILL[item.curso.faixa ?? ''] ?? 'fill-panel-3'} />
        {url && (
          // "slice" preenche o retângulo por completo, sem sobrar margem —
          // CAPA_LEN/TRACK_W já foram calibrados perto da proporção real da arte.
          <image
            href={url} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice"
            x={rx} y={ry} width={w} height={h}
          />
        )}
      </g>
    );
  }

  const { slot } = item;
  const available = !!slot.aula;
  const go = () => { if (available) nav(`/curso/${item.curso.id}?aula=${slot.aula!.id}`); };
  // Todas as casas da faixa usam a mesma cor de fundo, disponível ou não —
  // só "concluída" e "atual" (progresso do aluno) mudam a cor da casa.
  const fillClass = isCurrent
    ? 'fill-brand/35'
    : slot.done ? 'fill-brand'
    : FAIXA_FILL[item.curso.faixa ?? ''] ?? 'fill-panel-3';

  return (
    <g id={`slot-${item.curso.id}:${slot.ordem}`} onClick={go} className={available ? 'cursor-pointer' : 'cursor-default'}>
      <path d={tile.pathD} className={fillClass} />
      <text
        x={tile.centroidX} y={tile.centroidY} textAnchor="middle" dominantBaseline="middle"
        className={cn('text-[26px] font-bold tabular-nums select-none', slot.done ? 'fill-brand-ink' : 'fill-fg')}
      >
        {slot.done ? '✓' : slot.ordem}
      </text>
    </g>
  );
}
