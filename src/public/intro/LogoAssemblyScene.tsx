import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { INTRO } from '../motion/variants';
import {
  buildChevronGeometry,
  buildChevronLayout,
  easeOutCubic,
  rnd,
  smoothstep,
} from '../scene/MatterEvolutionScene';

/**
 * LogoAssemblyScene — o chevron da marca nasce da matéria.
 * Estilhaços lima convergem do disperso (stagger irradiando do ápice, sem
 * overshoot), fundem-se no chevron sólido extrudado com um único bloom, e a
 * peça assenta num idle quase imperceptível. Usada pelo splash da intro.
 */

const LIME = '#CCFC00';
const SCALE = 2.2;

function ChevronAssembly({ quality }: { quality: 'full' | 'lite' }) {
  const count = INTRO.shardCount;
  const shardsRef = useRef<THREE.InstancedMesh>(null);
  const solidRef = useRef<THREE.Mesh>(null);
  const solidMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const glowMatRef = useRef<THREE.SpriteMaterial>(null);
  const born = useRef<number | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const targets = useMemo(() => buildChevronLayout(count, SCALE), [count]);

  /* Estado disperso + atraso por estilhaço (irradia do ápice, com jitter). */
  const assembly = useMemo(() => {
    const start = new Float32Array(count * 3);
    const delays = new Float32Array(count);
    const apexY = SCALE / 2;
    let maxDist = 0;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const d = Math.hypot(targets[j], targets[j + 1] - apexY);
      delays[i] = d;
      if (d > maxDist) maxDist = d;
      const th = rnd(i, 40) * Math.PI * 2;
      const ph = (rnd(i, 41) - 0.5) * Math.PI;
      const r = 3.2 + rnd(i, 42) * 2.2;
      start[j] = Math.cos(th) * Math.cos(ph) * r;
      start[j + 1] = Math.sin(ph) * r * 0.8 - 0.6;
      start[j + 2] = Math.sin(th) * Math.cos(ph) * r * 0.6 - 1.2;
    }
    for (let i = 0; i < count; i++) {
      delays[i] = smoothstep(maxDist > 0 ? delays[i] / maxDist : 0) * 0.5 + rnd(i, 43) * 0.1;
    }
    return { start, delays };
  }, [count, targets]);

  const geo = useMemo(() => buildChevronGeometry(SCALE), []);

  const glowTex = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(204,252,0,0.8)');
    g.addColorStop(0.4, 'rgba(204,252,0,0.22)');
    g.addColorStop(1, 'rgba(204,252,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame((state) => {
    const shards = shardsRef.current;
    const solid = solidRef.current;
    if (!shards || !solid) return;
    const t = state.clock.elapsedTime;
    if (born.current === null) born.current = t;
    const ta = t - born.current;

    // Fusão: estilhaços → chevron sólido (com bloom único durante a fusão)
    const fp = Math.min(Math.max((ta - INTRO.converge) / INTRO.fuse, 0), 1);
    const fuse = smoothstep(fp);

    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const aP = (ta - assembly.delays[i]) / 0.55;
      const e = aP <= 0 ? 0 : easeOutCubic(Math.min(aP, 1));
      dummy.position.set(
        assembly.start[j] + (targets[j] - assembly.start[j]) * e,
        assembly.start[j + 1] + (targets[j + 1] - assembly.start[j + 1]) * e,
        assembly.start[j + 2] + (targets[j + 2] - assembly.start[j + 2]) * e,
      );
      dummy.rotation.set(0, rnd(i, 44) * Math.PI * 2 * (1 - fuse), rnd(i, 45) * 0.6 * (1 - fuse));
      // materializa no voo; some na fusão
      const sc = Math.max((0.35 + 0.65 * e) * (1 - fuse), 1e-3);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;

    // Sólido cresce na fusão; oscilação limitada (±3°) e idle de emissivo
    solid.scale.setScalar(Math.max(0.92 + 0.08 * fuse, 1e-3) * (fuse > 0 ? 1 : 1e-3));
    solid.visible = fuse > 0;
    solid.rotation.y = -0.32 + Math.sin(t * 0.4) * 0.05;
    solid.rotation.x = -0.08;
    const bloom = fp > 0 && fp < 1 ? Math.sin(Math.PI * fp) : 0;
    const idle = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 3.4);
    if (solidMatRef.current) solidMatRef.current.emissiveIntensity = 0.75 + bloom * 1.1 + idle * 0.08;
    if (glowMatRef.current) glowMatRef.current.opacity = 0.16 + bloom * 0.3 + idle * 0.04;
  });

  return (
    <group>
      <instancedMesh ref={shardsRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <coneGeometry args={[0.09, 0.16, 4]} />
        <meshStandardMaterial color="#9DBF00" emissive={LIME} emissiveIntensity={0.6} roughness={0.4} flatShading />
      </instancedMesh>

      <mesh ref={solidRef} geometry={geo} visible={false} rotation={[-0.08, -0.32, 0]}>
        <meshStandardMaterial
          ref={solidMatRef}
          color="#9DBF00"
          emissive={LIME}
          emissiveIntensity={0.75}
          roughness={0.35}
          metalness={0}
          flatShading
        />
      </mesh>

      <sprite scale={[5.2, 5.2, 1]} position={[0, 0, -0.8]}>
        <spriteMaterial map={glowTex} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      <ambientLight intensity={0.5} color="#c9d4e4" />
      <directionalLight position={[3, 4, 6]} intensity={quality === 'full' ? 1.05 : 0.9} color="#dfe7f2" />
      <directionalLight position={[-4, -1, 3]} intensity={0.25} color="#6B7A92" />
    </group>
  );
}

export default function LogoAssemblyScene({
  quality,
  onReady,
}: {
  quality: 'full' | 'lite';
  onReady?: () => void;
}) {
  return (
    <Canvas
      dpr={quality === 'full' ? [1, 2] : 1}
      camera={{ position: [0, 0, 6], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false }}
      onCreated={() => onReady?.()}
      style={{ pointerEvents: 'none' }}
    >
      <ChevronAssembly quality={quality} />
    </Canvas>
  );
}
