import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MotionValue } from 'motion/react';
import type { PublicSceneVariant } from '../types';
import { ASSEMBLY, CRYSTAL, FLOW, INTRO, MORPH, NET, PULSE, TOUCH, TRAIL, WAVE } from '../motion/variants';

/**
 * MatterEvolutionScene — "O Campo Matter".
 * A metáfora central da marca em 3D: um campo escultural de pirâmides
 * facetadas em slate fosco onde exatamente UMA peça brilha em verde-lima
 * ("the one that matters"). A composição se transforma com o scroll:
 *   hero      → campo ondulante flutuando à direita
 *   recursos  → seis ilhas relacionadas aos cards
 *   como      → três patamares ascendentes; a peça lima sobe as etapas
 *   para quem → uma pirâmide monumental com a peça lima no ápice
 *   cta       → retículo cúbico ("inteligência ao cubo") com a lima no núcleo
 * As transições entre formações são morfoses em cascata: cada peça parte no
 * scrub no seu próprio momento, irradiando da peça lima, com arco de voo.
 * Nenhum texto ou informação essencial vive aqui dentro.
 */

type Quality = 'full' | 'lite';

export type MatterEvolutionSceneProps = {
  variant: PublicSceneVariant;
  quality: Quality;
  /** Progresso de scroll da página (MotionValue lido por frame, sem rerender). */
  progress?: MotionValue<number>;
  active: boolean;
  /** Intro do logo in-hero: o campo forma o chevron antes de dissolver. */
  intro?: boolean;
  onReady?: () => void;
};

const LIME = '#CCFC00';
const INK = '#0B0D10';

/* Paradas de scroll aproximadas das seções da landing. */
const STOPS = [0, 0.24, 0.46, 0.68, 0.92];

export const smoothstep = (x: number) => x * x * (3 - 2 * x);
/* Desaceleração firme, final preciso, sem overshoot. */
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

function scrollSegment(p: number) {
  let k = 0;
  while (k < STOPS.length - 2 && p >= STOPS[k + 1]) k++;
  const local = Math.min(Math.max((p - STOPS[k]) / (STOPS[k + 1] - STOPS[k]), 0), 1);
  return { k, s: smoothstep(local) };
}

/* Pseudo-aleatório determinístico por índice (sem Math.random: estável). */
export const rnd = (i: number, salt: number) => {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Layout do chevron da marca (o "A" sem travessão do logo) num plano vertical:
 * pontos determinísticos amostrados dentro do polígono. Usado pela intro do
 * logo (splash) e pela fase de intro do hero.
 */
export function buildChevronLayout(count: number, scale = 2.2): Float32Array {
  const halfW = 0.62; // meia-base (proporção do logo)
  const thick = 0.26; // espessura horizontal das pernas
  const yi = 0.52; // ápice do recorte interno
  const innerHalf = halfW - thick;
  const inside = (x: number, y: number) => {
    if (y < 0 || y > 1) return false;
    if (Math.abs(x) > halfW * (1 - y)) return false;
    if (y < yi && Math.abs(x) < innerHalf * (1 - y / yi)) return false;
    return true;
  };
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 1;
    for (let a = 0; a < 48; a++) {
      const cx = (rnd(i, 30 + a * 2) - 0.5) * 2 * halfW;
      const cy = rnd(i, 31 + a * 2);
      if (inside(cx, cy)) {
        x = cx;
        y = cy;
        break;
      }
    }
    out[i * 3] = x * scale;
    out[i * 3 + 1] = (y - 0.5) * scale;
    out[i * 3 + 2] = (rnd(i, 29) - 0.5) * 0.24;
  }
  return out;
}

/** Geometria sólida do chevron da marca (mesmas proporções do layout). */
export function buildChevronGeometry(scale = 2.2): THREE.ExtrudeGeometry {
  const halfW = 0.62 * scale;
  const thick = 0.26 * scale;
  const yi = 0.52 * scale;
  const s = new THREE.Shape();
  s.moveTo(0, scale);
  s.lineTo(halfW, 0);
  s.lineTo(halfW - thick, 0);
  s.lineTo(0, yi);
  s.lineTo(-(halfW - thick), 0);
  s.lineTo(-halfW, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.15 * scale, bevelEnabled: false });
  g.translate(0, -scale / 2, -0.075 * scale); // centraliza vertical e em profundidade
  return g;
}

type GroupKey = { pos: [number, number, number]; scale: number };

function groupKeys(cx: number): GroupKey[] {
  return [
    { pos: [cx, -0.45, 0], scale: 1 },
    { pos: [cx * 1.02, 0, -0.6], scale: 0.9 },
    { pos: [cx * 0.96, -0.25, -0.3], scale: 0.9 },
    { pos: [cx * 0.98, -0.6, 0], scale: 0.95 },
    // CTA: o cubo ocupa o palco livre abaixo do card, perto da câmera (fora
    // do grosso do fog) — o payoff "inteligência ao cubo" fica visível.
    { pos: [cx * 0.3, -2.4, -1.6], scale: 0.78 },
  ];
}

/* Casa da peça-destaque dentro do campo (x, z) — uma clareira é aberta ao redor. */
const STANDOUT_HOME: [number, number] = [-0.7, 1.2];
const CLEARING_RADIUS = 1.05;

/* Posição da peça-destaque (lima) por seção, no espaço do grupo.
   No CTA ela habita o NÚCLEO do retículo cúbico — o insight dentro do cubo. */
const STANDOUT_KEYS: [number, number, number][] = [
  [STANDOUT_HOME[0], 0.42, STANDOUT_HOME[1]],
  [0, 1.3, 0],
  [2.35, 1.95, 0],
  [0, 2.75, 0],
  [0, 1.0, 0],
];

/* Degraus intermediários da subida da lima (seção "como funciona"):
   keyframes percentuais — desce ao 1º patamar e sobe degrau a degrau. */
const CLIMB_PATH: [number, number, number][] = [
  STANDOUT_KEYS[1],
  [-2.35, 0.25, 0],
  [0, 1.1, 0],
  STANDOUT_KEYS[2],
];

/**
 * Cinco layouts de posições para o campo de pirâmides.
 * Retorna [L0 campo, L1 ilhas, L2 patamares, L3 pirâmide, L4 anel].
 */
function buildLayouts(count: number) {
  const mk = () => new Float32Array(count * 3);
  const L = [mk(), mk(), mk(), mk(), mk()];

  // L0 — campo: grade ordenada no plano x-z (a "conformidade" da marca)
  const cols = Math.ceil(Math.sqrt(count * 1.3));
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    const c = i % cols;
    const r = Math.floor(i / cols);
    L[0][j] = (c - (cols - 1) / 2) * 0.78 + (rnd(i, 1) - 0.5) * 0.08;
    L[0][j + 1] = 0;
    L[0][j + 2] = (r - Math.floor(count / cols) / 2) * 0.78 + (rnd(i, 2) - 0.5) * 0.08;
  }
  // Clareira ao redor da peça-destaque: vizinhas são empurradas para a borda
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    const dx = L[0][j] - STANDOUT_HOME[0];
    const dz = L[0][j + 2] - STANDOUT_HOME[1];
    const d = Math.hypot(dx, dz);
    if (d < CLEARING_RADIUS) {
      const f = d < 1e-4 ? CLEARING_RADIUS : CLEARING_RADIUS / d;
      L[0][j] = STANDOUT_HOME[0] + dx * f;
      L[0][j + 2] = STANDOUT_HOME[1] + dz * f;
    }
  }

  // L1 — seis ilhas (2 colunas × 3 linhas, empacotamento em espiral áurea)
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    const cl = i % 6;
    const col = cl % 2;
    const row = Math.floor(cl / 2);
    const k = Math.floor(i / 6);
    const rad = 0.34 * Math.sqrt(k + 0.5);
    const th = k * 2.39996 + cl;
    L[1][j] = (col - 0.5) * 2.5 + Math.cos(th) * rad;
    L[1][j + 1] = (rnd(i, 3) - 0.5) * 0.16;
    L[1][j + 2] = (row - 1) * 2.1 + Math.sin(th) * rad;
  }

  // L2 — três patamares ascendentes (esquerda → direita)
  const perT = Math.ceil(count / 3);
  const side = Math.ceil(Math.sqrt(perT));
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    const g = i % 3;
    const k = Math.floor(i / 3);
    const a = k % side;
    const b = Math.floor(k / side);
    L[2][j] = (g - 1) * 2.35 + (a - (side - 1) / 2) * 0.46;
    L[2][j + 1] = g * 0.85;
    L[2][j + 2] = (b - (side - 1) / 2) * 0.46;
  }

  // L3 — pirâmide monumental (camadas 6..2; o ápice é a peça lima)
  const slots: [number, number, number][] = [];
  for (let s = 6; s >= 2; s--) {
    const y = (6 - s) * 0.46;
    for (let a = 0; a < s; a++) {
      for (let b = 0; b < s; b++) {
        slots.push([(a - (s - 1) / 2) * 0.52, y, (b - (s - 1) / 2) * 0.52]);
      }
    }
  }
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    if (i < slots.length) {
      L[3][j] = slots[i][0];
      L[3][j + 1] = slots[i][1];
      L[3][j + 2] = slots[i][2];
    } else {
      // excedentes formam um anel raso na base
      const th = (i / (count - slots.length)) * Math.PI * 2;
      L[3][j] = Math.cos(th) * 3.1;
      L[3][j + 1] = (rnd(i, 4) - 0.5) * 0.1;
      L[3][j + 2] = Math.sin(th) * 3.1;
    }
  }

  // L4 — "inteligência ao cubo": retículo cúbico (12 arestas + centros de face),
  // a lima brilha no núcleo, visível pelos vãos entre as peças
  const CH = 1.5; // meia-aresta do cubo
  const CY = 1.0; // altura do centro
  const corners: [number, number, number][] = [];
  for (let xi = -1; xi <= 1; xi += 2)
    for (let yi = -1; yi <= 1; yi += 2)
      for (let zi = -1; zi <= 1; zi += 2) corners.push([xi, yi, zi]);
  // arestas = pares de cantos que diferem em exatamente um eixo
  const edges: [number, number][] = [];
  for (let a = 0; a < 8; a++)
    for (let b = a + 1; b < 8; b++) {
      const diff =
        Math.abs(corners[a][0] - corners[b][0]) +
        Math.abs(corners[a][1] - corners[b][1]) +
        Math.abs(corners[a][2] - corners[b][2]);
      if (diff === 2) edges.push([a, b]);
    }
  const perEdge = Math.max(1, Math.floor(count / 12));
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    const e = Math.floor(i / perEdge);
    if (e < 12) {
      const [a, b] = edges[e];
      const u = ((i % perEdge) + 0.5) / perEdge;
      L[4][j] = (corners[a][0] + (corners[b][0] - corners[a][0]) * u) * CH + (rnd(i, 16) - 0.5) * 0.07;
      L[4][j + 1] =
        CY + (corners[a][1] + (corners[b][1] - corners[a][1]) * u) * CH + (rnd(i, 17) - 0.5) * 0.07;
      L[4][j + 2] = (corners[a][2] + (corners[b][2] - corners[a][2]) * u) * CH + (rnd(i, 18) - 0.5) * 0.07;
    } else {
      // excedentes marcam os centros das 6 faces
      const f = (i - 12 * perEdge) % 6;
      const ax = f % 3;
      const sg = f < 3 ? 1 : -1;
      L[4][j] = (ax === 0 ? sg * CH : 0) + (rnd(i, 19) - 0.5) * 0.1;
      L[4][j + 1] = CY + (ax === 1 ? sg * CH : 0) + (rnd(i, 20) - 0.5) * 0.1;
      L[4][j + 2] = (ax === 2 ? sg * CH : 0) + (rnd(i, 21) - 0.5) * 0.1;
    }
  }

  /**
   * Atribuição por proximidade: cada formação é permutada para que a peça i
   * receba o slot mais próximo da sua posição na formação ANTERIOR (matching
   * guloso por pares ordenados, uma vez no mount). Sem isso, o índice aponta
   * para slots opostos entre formações e as trajetórias se cruzam — a morfose
   * vira enxame. Com isso, cada peça flui para o encaixe vizinho.
   */
  const reorder = (A: Float32Array, B: Float32Array) => {
    const pairs: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const ja = i * 3;
      for (let j = 0; j < count; j++) {
        const jb = j * 3;
        const dx = A[ja] - B[jb];
        const dy = A[ja + 1] - B[jb + 1];
        const dz = A[ja + 2] - B[jb + 2];
        pairs.push([dx * dx + dy * dy + dz * dz, i, j]);
      }
    }
    pairs.sort((a, b) => a[0] - b[0]);
    const out = new Float32Array(count * 3);
    const srcDone = new Uint8Array(count);
    const dstDone = new Uint8Array(count);
    let filled = 0;
    for (const [, i, j] of pairs) {
      if (srcDone[i] || dstDone[j]) continue;
      out[i * 3] = B[j * 3];
      out[i * 3 + 1] = B[j * 3 + 1];
      out[i * 3 + 2] = B[j * 3 + 2];
      srcDone[i] = 1;
      dstDone[j] = 1;
      if (++filled === count) break;
    }
    return out;
  };
  L[1] = reorder(L[0], L[1]);
  L[2] = reorder(L[1], L[2]);
  L[3] = reorder(L[2], L[3]);
  L[4] = reorder(L[3], L[4]);

  return L;
}

/** Textura de brilho radial gerada em runtime (sem asset externo). */
function useGlowTexture() {
  return useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(204,252,0,0.85)');
    g.addColorStop(0.35, 'rgba(204,252,0,0.28)');
    g.addColorStop(1, 'rgba(204,252,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function Field({
  variant,
  quality,
  progress,
  intro,
}: {
  variant: PublicSceneVariant;
  quality: Quality;
  progress?: MotionValue<number>;
  intro?: boolean;
}) {
  const count = variant === 'auth' ? (quality === 'full' ? 42 : 24) : quality === 'full' ? 126 : 56;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const cubeRef = useRef<THREE.InstancedMesh>(null);
  const standoutConeRef = useRef<THREE.Mesh>(null);
  const standoutCubeRef = useRef<THREE.Mesh>(null);
  const standoutRef = useRef<THREE.Group>(null);
  const glowMatRef = useRef<THREE.SpriteMaterial>(null);
  const standoutMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const standoutCubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const limeLightRef = useRef<THREE.PointLight>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const trailRef = useRef<THREE.Points>(null);
  const glowTex = useGlowTexture();

  const layouts = useMemo(() => buildLayouts(count), [count]);

  /* Intro in-hero: a marca aparece SÓLIDA e fiel (chevron extrudado, de frente
     para a câmera), segura, e então "se solta" — o sólido dissolve enquanto as
     peças surgem no lugar dele e escapam em cascata para o campo. */
  const chevron = useMemo(() => {
    if (!intro || variant !== 'landing') return null;
    const c = buildChevronLayout(count, 2.4);
    for (let i = 0; i < count; i++) c[i * 3 + 1] += 1.2;
    return c;
  }, [intro, variant, count]);

  const chevronGroupRef = useRef<THREE.Group>(null);
  const chevronGlowMatRef = useRef<THREE.SpriteMaterial>(null);
  const chevronGeo = useMemo(() => (chevron ? buildChevronGeometry(2.4) : null), [chevron]);
  /* Faces frontais em lime EXATO (toneMapped off — cor fiel ao logo);
     laterais um tom abaixo para leitura de profundidade. */
  const chevronMats = useMemo(() => {
    if (!chevron) return null;
    return [
      new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: '#9DBF00', transparent: true, opacity: 0, toneMapped: false }),
    ];
  }, [chevron]);

  /**
   * Topologia da rede de sinais: para cada formação, os pares peça↔vizinho
   * (2 mais próximos, deduplicados). Calculada uma vez; por frame só as
   * posições dos vértices seguem `current[]` — a teia estica nas morfoses.
   */
  const linkPairs = useMemo(() => {
    return layouts.map((L) => {
      const pairs: number[] = [];
      const seen = new Set<number>();
      for (let i = 0; i < count; i++) {
        const near: [number, number][] = [];
        for (let j = 0; j < count; j++) {
          if (j === i) continue;
          const dx = L[i * 3] - L[j * 3];
          const dy = L[i * 3 + 1] - L[j * 3 + 1];
          const dz = L[i * 3 + 2] - L[j * 3 + 2];
          near.push([dx * dx + dy * dy + dz * dz, j]);
        }
        near.sort((a, b) => a[0] - b[0]);
        for (let n = 0; n < NET.neighbors; n++) {
          const j = near[n][1];
          const key = i < j ? i * 10000 + j : j * 10000 + i;
          if (!seen.has(key)) {
            seen.add(key);
            pairs.push(i, j);
          }
        }
      }
      return new Uint16Array(pairs);
    });
  }, [layouts, count]);

  const linkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const maxV = count * NET.neighbors * 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxV * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxV * 3), 3));
    return g;
  }, [count]);

  const trailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // longe da cena até o primeiro voo (e cor 0 = invisível no blend aditivo)
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL.length * 3).fill(999), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL.length * 3), 3));
    return g;
  }, []);

  const limeLin = useMemo(() => new THREE.Color(LIME), []);

  /* Campo de toque: ponteiro em NDC + projeção no plano do campo. */
  const touchNdc = useRef({ x: 0, y: 0, active: false });
  const touchPt = useMemo(() => new THREE.Vector3(), []);
  const touchOn = useRef(0);
  const tmpRay = useMemo(() => new THREE.Ray(), []);
  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const tmpV2 = useMemo(() => new THREE.Vector2(), []);
  const prevStandout = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const trailInt = useRef(0);

  useEffect(() => {
    if (quality !== 'full' || variant !== 'landing') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      touchNdc.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      touchNdc.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      touchNdc.current.active = true;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [quality, variant]);

  /**
   * Ato I — Assembleia: estado disperso + atraso por peça.
   * delay = ease(distância_à_clareira / maxDist) × spread + jitter — o campo
   * se monta irradiando a partir da clareira vazia; a lima chega por última.
   */
  const assembly = useMemo(() => {
    const spread = variant === 'auth' ? ASSEMBLY.maxSpreadAuth : ASSEMBLY.maxSpread;
    const start = new Float32Array(count * 3);
    const delays = new Float32Array(count);
    let maxDist = 0;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const d = Math.hypot(layouts[0][j] - STANDOUT_HOME[0], layouts[0][j + 2] - STANDOUT_HOME[1]);
      delays[i] = d;
      if (d > maxDist) maxDist = d;
      // matéria dispersa: espalhada para fora, abaixo e ao fundo
      start[j] = layouts[0][j] * 2.2 + (rnd(i, 13) - 0.5) * 1.2;
      start[j + 1] = -3.2 - rnd(i, 14) * 1.6;
      start[j + 2] = layouts[0][j + 2] * 2.2 - 2.5 + (rnd(i, 15) - 0.5) * 1.2;
    }
    let maxDelay = 0;
    const norm = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const n = maxDist > 0 ? delays[i] / maxDist : 0;
      norm[i] = n; // campo de origem: governa assembleia E cascata da morfose
      delays[i] = smoothstep(n) * spread + rnd(i, 11) * ASSEMBLY.jitter;
      if (delays[i] > maxDelay) maxDelay = delays[i];
    }
    return { start, delays, maxDelay, norm };
  }, [count, layouts, variant]);

  const current = useMemo(() => assembly.start.slice(), [assembly]);

  const standoutCur = useMemo(() => new THREE.Vector3(STANDOUT_HOME[0], 4.2, STANDOUT_HOME[1]), []);

  /* Relógios narrativos (só correm com a página visível — frameloop pausado). */
  const born = useRef<number | null>(null);
  const lastK = useRef(0);
  const boostStart = useRef<number | null>(null);
  const bloomStart = useRef<number | null>(null);
  /* Progresso amortecido: cada tick da roda vira um deslize contínuo. */
  const pSmooth = useRef<number | null>(null);

  const baseScale = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = 0.62 + rnd(i, 8) * 0.34;
    return arr;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Variação sutil de cor por instância (escala slate do DS), pré-computada:
  // por frame ela é misturada com lima nas peças em voo (reorganização visível).
  const baseCols = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const a = new THREE.Color('#1A1F27');
    const b = new THREE.Color('#2E3542');
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      c.copy(a).lerp(b, rnd(i, 9));
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [count]);
  const colTmp = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    for (const m of [meshRef.current, cubeRef.current]) {
      if (!m) continue;
      for (let i = 0; i < count; i++) {
        colTmp.setRGB(baseCols[i * 3], baseCols[i * 3 + 1], baseCols[i * 3 + 2]);
        m.setColorAt(i, colTmp);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [count, baseCols, colTmp]);

  /* Origem da onda: pouso/chegadas partem da lima; cliques injetam sinal
     no ponto clicado — o usuário participa da rede. */
  const waveOrigin = useMemo(() => new THREE.Vector3(), []);
  const clickNdc = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (quality !== 'full' || variant !== 'landing') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const onDown = (e: PointerEvent) => {
      clickNdc.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    };
    window.addEventListener('pointerdown', onDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onDown);
  }, [quality, variant]);

  useFrame((state, rawDelta) => {
    const mesh = meshRef.current;
    const cubes = cubeRef.current;
    const standout = standoutRef.current;
    if (!mesh || !cubes || !standout) return;
    const delta = Math.min(rawDelta, 0.05);
    const t = state.clock.elapsedTime;
    if (born.current === null) born.current = t;
    const ta = t - born.current; // relógio da assembleia
    const damp = 1 - Math.exp(-3.2 * delta);
    // Fluidez contínua: o progresso bruto é amortecido antes de guiar a cena
    // (inércia de scroll — cada input desliza, nunca salta).
    const pRaw = variant === 'landing' ? Math.min(Math.max(progress?.get() ?? 0, 0), 1) : 0;
    if (pSmooth.current === null) pSmooth.current = pRaw;
    pSmooth.current += (pRaw - pSmooth.current) * (1 - Math.exp(-FLOW.smooth * delta));
    const p = pSmooth.current;
    const { k, s } = scrollSegment(p);
    const A = layouts[k];
    const B = layouts[Math.min(k + 1, layouts.length - 1)];

    // Ordem progressiva: a orientação aleatória das peças converge para o
    // alinhamento conforme a narrativa avança (campo caótico → cubo cristalino).
    const order = variant === 'landing' ? (k + s) / 4 : 0;

    // Clique injeta sinal: a onda parte do ponto clicado no plano do campo
    if (clickNdc.current && mesh.parent) {
      state.raycaster.setFromCamera(tmpV2.set(clickNdc.current.x, clickNdc.current.y), state.camera);
      tmpRay.copy(state.raycaster.ray);
      tmpMat.copy(mesh.parent.matrixWorld).invert();
      tmpRay.applyMatrix4(tmpMat);
      if (Math.abs(tmpRay.direction.y) > 1e-4) {
        const th = (0.2 - tmpRay.origin.y) / tmpRay.direction.y;
        if (th > 0) {
          waveOrigin.copy(tmpRay.origin).addScaledVector(tmpRay.direction, th);
          boostStart.current = t;
        }
      }
      clickNdc.current = null;
    }

    // Onda de confirmação: envelope do impulso (usado na escala do campo e no glow)
    const waveAge = boostStart.current === null ? -1 : t - boostStart.current;
    const boost = waveAge < 0 ? 0 : Math.exp(-waveAge / PULSE.boostDecay);

    // Campo de toque: projeta o ponteiro no plano do campo (espaço local do grupo)
    let touchHit = false;
    if (touchNdc.current.active && mesh.parent) {
      state.raycaster.setFromCamera(tmpV2.set(touchNdc.current.x, touchNdc.current.y), state.camera);
      tmpRay.copy(state.raycaster.ray);
      tmpMat.copy(mesh.parent.matrixWorld).invert();
      tmpRay.applyMatrix4(tmpMat);
      if (Math.abs(tmpRay.direction.y) > 1e-4) {
        const th = (0.2 - tmpRay.origin.y) / tmpRay.direction.y;
        if (th > 0) {
          touchPt.copy(tmpRay.origin).addScaledVector(tmpRay.direction, th);
          touchHit = true;
        }
      }
    }
    touchOn.current += ((touchHit ? 1 : 0) - touchOn.current) * damp;

    for (let i = 0; i < count; i++) {
      const j = i * 3;

      // Ato II — morfose em cascata: o mesmo campo de origem (distância à
      // clareira) escalona a PARTIDA de cada peça dentro do scrub; janelas
      // sobrepostas, como posições relativas de timeline. Reversível.
      const startS = assembly.norm[i] * MORPH.spread;
      const ls =
        s <= startS ? 0 : s >= startS + (1 - MORPH.spread) ? 1 : smoothstep((s - startS) / (1 - MORPH.spread));
      let tx = A[j] + (B[j] - A[j]) * ls;
      let ty = A[j + 1] + (B[j + 1] - A[j + 1]) * ls;
      let tz = A[j + 2] + (B[j + 2] - A[j + 2]) * ls;

      // Intro in-hero: enquanto a marca SÓLIDA está em cena as peças ficam
      // ocultas dentro dela; na soltura elas surgem no lugar do sólido e
      // escapam em cascata para o alvo normal (tingidas de lima no voo).
      let iTint = 0;
      let iVis = 1;
      if (chevron) {
        const introEnd = INTRO.converge + INTRO.heroHold;
        const shatter = 0.22; // a rachadura abre antes da dispersão
        if (ta < introEnd) {
          // logo sólido em cena: os fragmentos SÃO o próprio logo (ocultos)
          tx = chevron[j];
          ty = chevron[j + 1];
          tz = chevron[j + 2];
          iTint = 1;
          iVis = 0;
        } else {
          // Rachar: os cacos surgem cheios cobrindo a forma e então se AFASTAM
          // levemente, abrindo fendas escuras entre si (o logo greta e revela
          // os triângulos), antes de dispersarem em cascata para o campo.
          iVis = Math.min(Math.max((ta - introEnd) / 0.05, 0), 1);
          const crack = smoothstep(Math.min(Math.max((ta - introEnd) / 0.26, 0), 1));
          const dxo = chevron[j];
          const dyo = chevron[j + 1] - 1.2;
          const dzo = chevron[j + 2];
          const dl = Math.hypot(dxo, dyo, dzo) || 1;
          const push = crack * (0.12 + rnd(i, 46) * 0.07);
          const cxk = chevron[j] + (dxo / dl) * push;
          const cyk = chevron[j + 1] + (dyo / dl) * push;
          const czk = chevron[j + 2] + (dzo / dl) * push + (rnd(i, 47) - 0.5) * crack * 0.12;
          const cg = (ta - introEnd - shatter) / INTRO.heroDissolve;
          const st = assembly.norm[i] * MORPH.spread;
          const ci = cg <= st ? 0 : cg >= st + (1 - MORPH.spread) ? 1 : smoothstep((cg - st) / (1 - MORPH.spread));
          tx = cxk + (tx - cxk) * ci;
          ty = cyk + (ty - cyk) * ci + Math.sin(Math.PI * ci) * 0.25;
          tz = czk + (tz - czk) * ci;
          iTint = 1 - ci;
        }
      }

      // Campo de toque: a matéria cede suavemente ao redor do cursor
      if (touchOn.current > 0.01) {
        const dxC = tx - touchPt.x;
        const dzC = tz - touchPt.z;
        const dC = Math.hypot(dxC, dzC);
        if (dC < TOUCH.radius) {
          const f = (1 - dC / TOUCH.radius) ** 2 * touchOn.current;
          const invd = dC < 1e-3 ? 0 : (f * TOUCH.push) / dC;
          tx += dxC * invd;
          tz += dzC * invd;
          ty += f * TOUCH.lift;
        }
      }

      // Keyframe intermediário implícito: arco de voo proporcional ao trajeto
      // (a peça é "erguida e assentada", nunca deslizada) — sem overshoot.
      if (ls > 0 && ls < 1) {
        const dxT = B[j] - A[j];
        const dzT = B[j + 2] - A[j + 2];
        ty += Math.sin(Math.PI * ls) * Math.min(Math.hypot(dxT, dzT) * MORPH.arc, MORPH.arcMax);
      }

      // Ondulação ambiente do campo (deriva lenta composta)
      const phase = tx + tz;
      ty += Math.sin(t * 0.9 + phase * 0.9) * 0.055 + Math.sin(t * 0.31 + i) * 0.02;

      // Ato I — cada peça viaja do disperso ao alvo no seu próprio tempo;
      // interpola para o ALVO ATUAL (robusto a scroll durante a intro).
      const aP = (ta - assembly.delays[i]) / ASSEMBLY.perPiece;
      if (aP < 1) {
        const e = aP <= 0 ? 0 : easeOutCubic(aP);
        current[j] = assembly.start[j] + (tx - assembly.start[j]) * e;
        current[j + 1] = assembly.start[j + 1] + (ty - assembly.start[j + 1]) * e;
        current[j + 2] = assembly.start[j + 2] + (tz - assembly.start[j + 2]) * e;
      } else {
        current[j] += (tx - current[j]) * damp;
        current[j + 1] += (ty - current[j + 1]) * damp;
        current[j + 2] += (tz - current[j + 2]) * damp;
      }

      dummy.position.set(current[j], current[j + 1], current[j + 2]);
      // Oscilação limitada (±4°) — matéria viva, sem rotação contínua.
      // O componente aleatório do yaw desvanece com a ordem narrativa.
      dummy.rotation.set(
        0,
        rnd(i, 10) * Math.PI * 2 * (1 - order) + Math.sin(t * 0.22 + rnd(i, 12) * Math.PI * 2) * 0.07,
        0,
      );

      let sc = baseScale[i];
      if (iVis < 1) sc *= iVis; // intro: oculta dentro da marca sólida / pop-in
      // Stagger de valor (assembleia): a peça materializa no próprio voo
      if (aP < 1) sc *= 0.4 + 0.6 * (aP <= 0 ? 0 : easeOutCubic(Math.min(aP, 1)));
      // Onda de confirmação: frente radial parte da lima quando uma formação
      // se completa — o "sinal" atravessa o campo uma única vez por parada.
      if (boost > 0.02) {
        const dW = Math.hypot(
          current[j] - waveOrigin.x,
          current[j + 1] - waveOrigin.y,
          current[j + 2] - waveOrigin.z,
        );
        const g = (dW - waveAge * WAVE.speed) / WAVE.width;
        sc *= 1 + Math.exp(-g * g) * WAVE.amp * boost;
      }

      // Cristalização: pirâmide (matéria bruta) → cubo (módulo de conhecimento),
      // irradiando da lima conforme a ordem narrativa avança.
      const mRaw = order * CRYSTAL.lead - assembly.norm[i] * CRYSTAL.spread;
      const mC = mRaw <= 0 ? 0 : mRaw >= 1 ? 1 : smoothstep(mRaw);
      const sPyr = Math.max(sc * (1 - mC), 1e-3);
      dummy.scale.set(sPyr, sPyr, sPyr);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const sCube = Math.max(sc * mC * CRYSTAL.size, 1e-3);
      dummy.scale.set(sCube, sCube, sCube);
      dummy.updateMatrix();
      cubes.setMatrixAt(i, dummy.matrix);

      // Peça em voo tinge para o lima — a reorganização é visível onde ocorre
      colTmp.setRGB(baseCols[i * 3], baseCols[i * 3 + 1], baseCols[i * 3 + 2]);
      if (iTint > 0) colTmp.lerp(limeLin, 0.85 * iTint); // logo da intro em lima
      if (ls > 0 && ls < 1) colTmp.lerp(limeLin, Math.sin(Math.PI * ls) * CRYSTAL.flightTint);
      mesh.setColorAt(i, colTmp);
      cubes.setColorAt(i, colTmp);
    }
    mesh.instanceMatrix.needsUpdate = true;
    cubes.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true;

    // Marca sólida da intro: entra polida e lisa no ÂNGULO DIAGONAL do campo
    // (herda o transform escultural — idêntica à orientação das peças, então a
    // repartição é perfeita), segura e então dissolve enquanto as peças surgem.
    if (chevron && chevronGroupRef.current && chevronMats) {
      const cgp = chevronGroupRef.current;
      const introEnd = INTRO.converge + INTRO.heroHold;
      const eIn = smoothstep(Math.min(ta / 0.5, 1));
      // some rápido assim que o mosaico de cacos cobre a forma — as fendas que
      // se abrem entre os cacos ficam escuras (rachaduras), não lime por baixo
      const rel = Math.min(Math.max((ta - introEnd) / 0.1, 0), 1);
      const op = eIn * (1 - rel);
      chevronMats[0].opacity = op;
      chevronMats[1].opacity = op * 0.9;
      cgp.visible = op > 0.001;
      cgp.scale.setScalar((0.9 + 0.1 * eIn) * (1 + 0.05 * rel));
      cgp.rotation.y = Math.sin(t * 0.4) * 0.04; // respiração idle mínima
      const bp = Math.min(Math.max((ta - 0.5) / 0.5, 0), 1);
      const bloomC = bp > 0 && bp < 1 ? Math.sin(Math.PI * bp) : 0;
      const idleC = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / PULSE.period);
      if (chevronGlowMatRef.current)
        chevronGlowMatRef.current.opacity = op * (0.1 + idleC * 0.04 + bloomC * 0.3);
    }

    // Peça-destaque: alvo por seção. Na transição ilhas→patamares a lima sobe
    // degrau a degrau (keyframes percentuais); nas demais, voa em arco curto.
    let sk: [number, number, number];
    if (variant === 'auth') {
      sk = STANDOUT_KEYS[0];
    } else if (k === 1 && s > 0 && s < 1) {
      const f = Math.min(s * (CLIMB_PATH.length - 1), CLIMB_PATH.length - 1.0001);
      const seg = Math.floor(f);
      const u = smoothstep(f - seg);
      const P = CLIMB_PATH[seg];
      const Q = CLIMB_PATH[seg + 1];
      sk = [
        P[0] + (Q[0] - P[0]) * u,
        P[1] + (Q[1] - P[1]) * u + Math.sin(Math.PI * u) * MORPH.standoutArc,
        P[2] + (Q[2] - P[2]) * u,
      ];
    } else {
      sk = [0, 1, 2].map(
        (a) => STANDOUT_KEYS[k][a] + (STANDOUT_KEYS[Math.min(k + 1, 4)][a] - STANDOUT_KEYS[k][a]) * s,
      ) as [number, number, number];
      if (s > 0 && s < 1) sk[1] += Math.sin(Math.PI * s) * MORPH.standoutArc;
    }
    const bob = Math.sin(t * 0.8) * 0.09;

    // A lima chega por última: queda rápida → assentamento suave (sem overshoot).
    // Na intro in-hero ela espera o chevron dissolver antes de pousar.
    const sDelay =
      assembly.maxDelay +
      ASSEMBLY.standoutLag +
      (chevron ? INTRO.converge + INTRO.heroHold + INTRO.heroDissolve * 0.6 : 0);
    const sP = (ta - sDelay) / ASSEMBLY.perPiece;
    if (sP < 1) {
      standout.visible = sP > 0;
      const e = sP <= 0 ? 0 : easeOutCubic(Math.min(sP, 1));
      standoutCur.x = STANDOUT_HOME[0] + (sk[0] - STANDOUT_HOME[0]) * e;
      standoutCur.z = STANDOUT_HOME[1] + (sk[2] - STANDOUT_HOME[1]) * e;
      const rest = sk[1] + bob;
      if (sP <= 0) standoutCur.y = 4.2;
      else if (sP < 0.6) standoutCur.y = 4.2 + (rest + 0.5 - 4.2) * easeOutCubic(sP / 0.6);
      else standoutCur.y = rest + 0.5 * (1 - smoothstep((sP - 0.6) / 0.4));
    } else {
      standout.visible = true;
      if (bloomStart.current === null) bloomStart.current = t; // pousou: o insight acende
      standoutCur.x += (sk[0] - standoutCur.x) * damp;
      standoutCur.y += (sk[1] + bob - standoutCur.y) * damp;
      standoutCur.z += (sk[2] - standoutCur.z) * damp;
    }
    standout.position.copy(standoutCur);
    standout.rotation.y = 0.3 + Math.sin(t * 0.3) * 0.14; // oscilação limitada (±8°)

    // Atos II/III — glow como EVENTO (blend aditivo: idle mínimo + impulsos raros)
    const assembled = sP >= 1;
    if (k !== lastK.current) {
      lastK.current = k;
      if (assembled) {
        waveOrigin.copy(standoutCur); // chegada: o sinal parte da lima
        boostStart.current = t;
      }
    }

    // A lima cristaliza por último: cone → cubo de luz no núcleo ("ao cubo")
    const mS =
      order <= CRYSTAL.standoutFrom
        ? 0
        : smoothstep(Math.min((order - CRYSTAL.standoutFrom) / (1 - CRYSTAL.standoutFrom), 1));
    if (standoutConeRef.current) standoutConeRef.current.scale.setScalar(Math.max(1 - mS, 1e-3));
    if (standoutCubeRef.current) standoutCubeRef.current.scale.setScalar(Math.max(mS, 1e-3));
    const idle = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / PULSE.period);
    let bloom = 0;
    if (bloomStart.current !== null) {
      const bp = (t - bloomStart.current) / ASSEMBLY.bloom;
      if (bp < 1) bloom = Math.sin(Math.PI * bp);
    }
    // "conhecimento ganha estrutura": peso da seção pirâmide (k=3)
    const w3 = variant === 'landing' ? Math.min(Math.max(1 - Math.abs(p - 0.8) / 0.12, 0), 1) : 0;
    // o glow acende na aproximação do pouso
    const lit = sP <= 0.85 ? 0 : sP >= 1 ? 1 : smoothstep((sP - 0.85) / 0.15);

    if (glowMatRef.current)
      glowMatRef.current.opacity = lit * (0.2 + idle * PULSE.idleAmp + boost * 0.2 + bloom * 0.35);
    const emissive = 0.45 + lit * (0.75 + idle * 0.12 + boost * PULSE.boostAmp + bloom * 1.0 + w3 * 0.2);
    if (standoutMatRef.current) standoutMatRef.current.emissiveIntensity = emissive;
    if (standoutCubeMatRef.current) standoutCubeMatRef.current.emissiveIntensity = emissive;
    if (limeLightRef.current)
      limeLightRef.current.intensity =
        lit * ((quality === 'full' ? 8 : 4.5) + idle * 0.8 + boost * 4 + bloom * 8);

    // ---- Rede de sinais: fios entre vizinhos, brilho perto da lima + onda ----
    const lines = linesRef.current;
    if (lines) {
      const pairs = linkPairs[s < 0.5 ? k : Math.min(k + 1, layouts.length - 1)];
      const pAttr = linkGeo.getAttribute('position') as THREE.BufferAttribute;
      const cAttr = linkGeo.getAttribute('color') as THREE.BufferAttribute;
      const pArr = pAttr.array as Float32Array;
      const cArr = cAttr.array as Float32Array;
      const flow = s > 0 && s < 1 ? NET.morphGlow : 0;
      for (let l = 0; l < pairs.length; l += 2) {
        const a = pairs[l] * 3;
        const b = pairs[l + 1] * 3;
        const v = l * 3;
        pArr[v] = current[a];
        pArr[v + 1] = current[a + 1];
        pArr[v + 2] = current[a + 2];
        pArr[v + 3] = current[b];
        pArr[v + 4] = current[b + 1];
        pArr[v + 5] = current[b + 2];
        const nx = (current[a] + current[b]) * 0.5 - standoutCur.x;
        const ny = (current[a + 1] + current[b + 1]) * 0.5 - standoutCur.y;
        const nz = (current[a + 2] + current[b + 2]) * 0.5 - standoutCur.z;
        const near = Math.max(1 - Math.sqrt(nx * nx + ny * ny + nz * nz) / NET.radius, 0);
        const wx = (current[a] + current[b]) * 0.5 - waveOrigin.x;
        const wy = (current[a + 1] + current[b + 1]) * 0.5 - waveOrigin.y;
        const wz = (current[a + 2] + current[b + 2]) * 0.5 - waveOrigin.z;
        const dm = Math.sqrt(wx * wx + wy * wy + wz * wz);
        const gW = (dm - waveAge * WAVE.speed) / WAVE.width;
        const wI = waveAge < 0 ? 0 : Math.exp(-gW * gW) * boost * NET.waveGain;
        const I = lit * Math.min(near * near * NET.base + wI + flow, 1);
        cArr[v] = cArr[v + 3] = limeLin.r * I;
        cArr[v + 1] = cArr[v + 4] = limeLin.g * I;
        cArr[v + 2] = cArr[v + 5] = limeLin.b * I;
      }
      pAttr.needsUpdate = true;
      cAttr.needsUpdate = true;
      linkGeo.setDrawRange(0, pairs.length);
    }

    // ---- Cauda de cometa: rastro da lima, visível apenas em voo ----
    if (trailRef.current) {
      const speed = prevStandout.distanceTo(standoutCur) / Math.max(delta, 1e-4);
      prevStandout.copy(standoutCur);
      const target = Math.min(speed / TRAIL.speedRef, 1);
      trailInt.current += (target - trailInt.current) * (target > trailInt.current ? 0.5 : damp);
      const tp = trailGeo.getAttribute('position') as THREE.BufferAttribute;
      const tc = trailGeo.getAttribute('color') as THREE.BufferAttribute;
      const tpA = tp.array as Float32Array;
      const tcA = tc.array as Float32Array;
      // desloca o histórico e grava a posição atual na cabeça
      for (let n = TRAIL.length - 1; n > 0; n--) {
        tpA[n * 3] = tpA[(n - 1) * 3];
        tpA[n * 3 + 1] = tpA[(n - 1) * 3 + 1];
        tpA[n * 3 + 2] = tpA[(n - 1) * 3 + 2];
      }
      tpA[0] = standoutCur.x;
      tpA[1] = standoutCur.y;
      tpA[2] = standoutCur.z;
      for (let n = 0; n < TRAIL.length; n++) {
        const fade = (1 - n / TRAIL.length) ** 2 * trailInt.current * lit;
        tcA[n * 3] = limeLin.r * fade;
        tcA[n * 3 + 1] = limeLin.g * fade;
        tcA[n * 3 + 2] = limeLin.b * fade;
      }
      tp.needsUpdate = true;
      tc.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <coneGeometry args={[0.26, 0.46, 4]} />
        <meshStandardMaterial color="#ffffff" roughness={0.72} metalness={0.12} flatShading />
      </instancedMesh>

      {/* Módulos cristalizados: cubos que substituem as pirâmides conforme a
          ordem avança (material levemente mais lapidado que a matéria bruta) */}
      <instancedMesh ref={cubeRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[0.36, 0.36, 0.36]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0.18} flatShading />
      </instancedMesh>

      {/* Marca sólida da intro (fiel ao logo): visível só na fase de abertura */}
      {chevron && chevronGeo && chevronMats && (
        <group ref={chevronGroupRef} position={[0, 1.2, 0]} visible={false}>
          <mesh geometry={chevronGeo} material={chevronMats} />
          <sprite scale={[4.4, 4.4, 1]} position={[0, 0, -0.5]}>
            <spriteMaterial
              ref={chevronGlowMatRef}
              map={glowTex}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        </group>
      )}

      {/* Base que recebe a luz lima (aterra a composição) */}
      {variant === 'landing' && (
        <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[5.6, 40]} />
          <meshStandardMaterial color="#0E1116" roughness={1} metalness={0} />
        </mesh>
      )}

      {/* Rede de sinais: fios aditivos entre vizinhos (1 draw call) */}
      <lineSegments ref={linesRef} geometry={linkGeo} frustumCulled={false}>
        <lineBasicMaterial transparent vertexColors depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* Cauda de cometa da lima (pontos aditivos; cor 0 = invisível em repouso) */}
      <points ref={trailRef} geometry={trailGeo} frustumCulled={false}>
        <pointsMaterial
          map={glowTex}
          transparent
          vertexColors
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          size={TRAIL.size}
          sizeAttenuation
        />
      </points>

      {/* A peça que importa: cone em quase toda a jornada; cristaliza em cubo
          de luz no fim ("inteligência ao cubo", literal até na protagonista) */}
      <group ref={standoutRef}>
        <mesh ref={standoutConeRef}>
          <coneGeometry args={[0.34, 0.58, 4]} />
          <meshStandardMaterial
            ref={standoutMatRef}
            color="#9DBF00"
            emissive={LIME}
            emissiveIntensity={1.5}
            roughness={0.35}
            metalness={0}
            flatShading
          />
        </mesh>
        <mesh ref={standoutCubeRef} scale={0.001}>
          <boxGeometry args={[0.46, 0.46, 0.46]} />
          <meshStandardMaterial
            ref={standoutCubeMatRef}
            color="#9DBF00"
            emissive={LIME}
            emissiveIntensity={1.5}
            roughness={0.3}
            metalness={0}
            flatShading
          />
        </mesh>
        <sprite scale={[2.4, 2.4, 1]}>
          <spriteMaterial
            ref={glowMatRef}
            map={glowTex}
            transparent
            opacity={0.38}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight ref={limeLightRef} color={LIME} intensity={9} distance={8} decay={2} />
      </group>
    </group>
  );
}

function Rig({
  variant,
  quality,
  progress,
  children,
}: {
  variant: PublicSceneVariant;
  quality: Quality;
  progress?: MotionValue<number>;
  children: React.ReactNode;
}) {
  const viewport = useThree((s) => s.viewport);
  const parallax = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const sculpt = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0, enabled: false });
  const pSmooth = useRef<number | null>(null);

  const cx = useMemo(() => {
    if (variant === 'auth') return 0;
    return viewport.width >= 8 ? Math.min(viewport.width * 0.29, 3.8) : 0;
  }, [variant, viewport.width]);

  const keys = useMemo(() => groupKeys(cx), [cx]);

  useEffect(() => {
    if (quality !== 'full' || !window.matchMedia('(pointer: fine)').matches) return;
    pointer.current.enabled = true;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [quality]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const damp = 1 - Math.exp(-3 * delta);
    const par = parallax.current;
    const g = group.current;
    if (!par || !g) return;

    // Parallax máx. ~3°, apenas ponteiro preciso
    const MAX = 0.05;
    const targetY = pointer.current.enabled ? pointer.current.x * MAX : 0;
    const targetX = pointer.current.enabled ? pointer.current.y * MAX * 0.6 : 0;
    par.rotation.y += (targetY - par.rotation.y) * damp;
    par.rotation.x += (targetX - par.rotation.x) * damp;

    const pRaw = variant === 'landing' ? Math.min(Math.max(progress?.get() ?? 0, 0), 1) : 0;
    if (pSmooth.current === null) pSmooth.current = pRaw;
    pSmooth.current += (pRaw - pSmooth.current) * (1 - Math.exp(-FLOW.smooth * delta));
    const p = pSmooth.current;
    const { k, s } = scrollSegment(p);
    const a = keys[k];
    const b = keys[Math.min(k + 1, keys.length - 1)];

    g.position.x += (a.pos[0] + (b.pos[0] - a.pos[0]) * s - g.position.x) * damp;
    g.position.y += (a.pos[1] + (b.pos[1] - a.pos[1]) * s - g.position.y) * damp;
    g.position.z += (a.pos[2] + (b.pos[2] - a.pos[2]) * s - g.position.z) * damp;
    const sc = a.scale + (b.scale - a.scale) * s;
    g.scale.setScalar(g.scale.x + (sc - g.scale.x) * damp);

    // Órbita cinematográfica: o conjunto gira ~20° ao longo da página inteira,
    // dando a cada formação um ângulo levemente novo — continuidade de câmera.
    if (sculpt.current) sculpt.current.rotation.y = 0.45 + p * FLOW.orbit;
  });

  return (
    <group ref={parallax}>
      <group ref={group} position={[cx, -0.2, 0]}>
        {/* Ângulo escultural (levemente aéreo); o yaw orbita com o scroll */}
        <group ref={sculpt} rotation={[-0.52, 0.45, 0.03]}>{children}</group>
      </group>
    </group>
  );
}

/**
 * Luz principal com acento narrativo: quando a pirâmide monumental está
 * ativa (seção "para quem"), a intensidade sobe sutilmente (+0.12) —
 * "conhecimento ganha estrutura".
 */
function KeyLight({ variant, progress }: { variant: PublicSceneVariant; progress?: MotionValue<number> }) {
  const ref = useRef<THREE.DirectionalLight>(null);

  useFrame((_, rawDelta) => {
    const light = ref.current;
    if (!light) return;
    const delta = Math.min(rawDelta, 0.05);
    const damp = 1 - Math.exp(-3 * delta);
    const p = variant === 'landing' ? Math.min(Math.max(progress?.get() ?? 0, 0), 1) : 0;
    const w3 = Math.min(Math.max(1 - Math.abs(p - 0.8) / 0.12, 0), 1);
    const target = 0.95 + w3 * 0.12;
    light.intensity += (target - light.intensity) * damp;
  });

  return <directionalLight ref={ref} position={[6, 8, 4]} intensity={0.95} color="#dfe7f2" />;
}

export default function MatterEvolutionScene({
  variant,
  quality,
  progress,
  active,
  intro,
  onReady,
}: MatterEvolutionSceneProps) {
  return (
    <Canvas
      dpr={quality === 'full' ? [1, 1.5] : 1}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0.4, 8.5], fov: 42 }}
      gl={{
        antialias: quality === 'full',
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
      }}
      onCreated={() => onReady?.()}
      style={{ pointerEvents: 'none' }}
    >
      <fog attach="fog" args={[INK, 8.5, 17]} />
      <ambientLight intensity={0.42} color="#c9d4e4" />
      <KeyLight variant={variant} progress={progress} />
      {/* Luz rasante fria: evidencia as arestas facetadas do flat shading */}
      <directionalLight position={[-6, 1.2, -4.5]} intensity={0.22} color="#6B7A92" />
      <Rig variant={variant} quality={quality} progress={progress}>
        <Field variant={variant} quality={quality} progress={progress} intro={intro} />
      </Rig>
    </Canvas>
  );
}
