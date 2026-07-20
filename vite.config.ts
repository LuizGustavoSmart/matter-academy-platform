import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Endpoint apenas de desenvolvimento (`apply: 'serve'`) para gravar o poster
 * WebP gerado a partir da cena 3D pública — o fallback real do modo static.
 * Não existe no build de produção.
 */
function publicPosterDev(): Plugin {
  const allowed = new Set(['matter-portal.webp']);
  return {
    name: 'public-poster-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__public-poster', (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const name = url.searchParams.get('name') ?? '';
        if (req.method !== 'POST' || !allowed.has(name)) {
          res.statusCode = 400;
          res.end('invalid');
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length === 0 || buf.length > 3 * 1024 * 1024) {
            res.statusCode = 400;
            res.end('size');
            return;
          }
          const dir = path.resolve(process.cwd(), 'public/posters');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, name), buf);
          res.end('ok');
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), publicPosterDev()],
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: false,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          // Agrupa o ecossistema Three/R3F num único chunk, carregado apenas
          // pelo import dinâmico da cena pública.
          if (
            /[\\/]node_modules[\\/](three|three-stdlib|three-mesh-bvh|@react-three|maath|meshline|camera-controls|troika-three-text|troika-three-utils|troika-worker-utils|@monogrid|stats-gl|suspend-react|tunnel-rat|its-fine|react-reconciler|@use-gesture|@react-spring|zustand|use-sync-external-store|webgl-sdf-generator|bidi-js|detect-gpu|glsl-noise|hls\.js)[\\/]/.test(
              id,
            )
          ) {
            return 'three-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
