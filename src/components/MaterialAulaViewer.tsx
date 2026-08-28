import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button, cn } from './ui';
import { getSignedUrl } from '../lib/storage';

/** IDs colocados no AppShell (aside/header) só para medir, na hora de abrir
 * a tela cheia, onde termina o menu lateral e a topbar mobile — sem isso não
 * dá pra saber quanto espaço reservar sem cobrir a moldura da plataforma. */
const SIDEBAR_ID = 'app-shell-sidebar';
const TOPBAR_ID = 'app-shell-topbar';

export default function MaterialAulaViewer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    (async () => {
      // Baixa o PDF e exibe a partir de um blob: local, em vez de apontar o
      // iframe direto pra URL assinada do Storage — o Storage costuma servir
      // o arquivo com Content-Disposition de download, e o Chrome bloqueia
      // esse tipo de download automático disparado de dentro de um iframe
      // ("Esta página foi bloqueada pelo Chrome"). Um blob: local não sofre
      // esse bloqueio.
      const signedUrl = await getSignedUrl('materiais', path);
      const resp = await fetch(signedUrl);
      const blob = await resp.blob();
      if (!active) return;
      objectUrl = URL.createObjectURL(blob.type === 'application/pdf' ? blob : blob.slice(0, blob.size, 'application/pdf'));
      setUrl(objectUrl);
    })().catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);

  useEffect(() => {
    if (!fullscreen) return;
    const update = () => {
      const sidebar = document.getElementById(SIDEBAR_ID);
      const topbar = document.getElementById(TOPBAR_ID);
      setRect({
        left: sidebar?.getBoundingClientRect().right ?? 0,
        top: topbar?.getBoundingClientRect().bottom ?? 0,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const viewer = (
    <div className={cn('flex flex-col border border-line rounded-xl overflow-hidden bg-panel', fullscreen ? 'w-full h-full' : 'h-[70vh]')}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line flex-shrink-0">
        <p className="text-sm font-medium text-fg">Material da aula</p>
        <Button
          size="sm" variant="secondary"
          icon={fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          onClick={() => setFullscreen((f) => !f)}
        >
          {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        </Button>
      </div>
      <div className="flex-1 min-h-0 bg-canvas">
        {url
          ? <iframe src={url} title="Material da aula" className="w-full h-full border-0" />
          : <div className="p-6 text-sm text-fg-3">Carregando material...</div>}
      </div>
    </div>
  );

  if (fullscreen && rect) {
    return createPortal(
      <div className="fixed z-40 bg-canvas p-3" style={{ top: rect.top, left: rect.left, right: 0, bottom: 0 }}>
        {viewer}
      </div>,
      document.body,
    );
  }
  return viewer;
}
