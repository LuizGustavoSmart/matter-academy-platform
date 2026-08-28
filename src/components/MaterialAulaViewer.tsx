import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
// eslint-disable-next-line import/no-unresolved
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';
import { IconButton, cn } from './ui';
import { getSignedUrl } from '../lib/storage';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/** IDs colocados no AppShell (aside/header) só para medir, na hora de abrir
 * a tela cheia, onde termina o menu lateral e a topbar mobile — sem isso não
 * dá pra saber quanto espaço reservar sem cobrir a moldura da plataforma. */
const SIDEBAR_ID = 'app-shell-sidebar';
const TOPBAR_ID = 'app-shell-topbar';

/**
 * Renderiza o PDF em um <canvas> próprio, página por página, com pdf.js —
 * nunca aponta um iframe/objeto para a URL do arquivo. O Chrome bloqueia
 * PDF embutido em iframe apontando pro Storage ("Esta página foi bloqueada
 * pelo Chrome", tratando como download automático disparado de dentro do
 * iframe), mesmo servindo o arquivo como blob local — então a única forma
 * confiável de mostrar o material dentro da própria página é desenhar os
 * pixels nós mesmos.
 */
export default function MaterialAulaViewer({ path }: { path: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setDoc(null); setErr(null); setPage(1); setZoom(1);
    (async () => {
      const url = await getSignedUrl('materiais', path);
      const pdf = await pdfjsLib.getDocument({ url }).promise;
      if (!active) return;
      setDoc(pdf);
      setNumPages(pdf.numPages);
    })().catch(() => { if (active) setErr('Não foi possível carregar o material.'); });
    return () => { active = false; };
  }, [path]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      const pdfPage = await doc.getPage(page);
      const containerWidth = scrollRef.current?.clientWidth ?? 800;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: (containerWidth / base.width) * zoom });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
    })().catch(() => { if (!cancelled) setErr('Não foi possível exibir esta página.'); });
    return () => { cancelled = true; };
  }, [doc, page, zoom, fullscreen]);

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
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-line flex-shrink-0">
        <p className="text-sm font-medium text-fg pl-1">Material da aula</p>
        <div className="flex items-center gap-1">
          <IconButton label="Página anterior" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></IconButton>
          <span className="text-xs text-fg-3 tabular-nums px-1 min-w-[64px] text-center">{numPages ? `${page} / ${numPages}` : '—'}</span>
          <IconButton label="Próxima página" size="sm" disabled={page >= numPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></IconButton>
          <div className="w-px h-5 bg-line mx-1" />
          <IconButton label="Diminuir zoom" size="sm" disabled={zoom <= 0.6} onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}><ZoomOut className="w-4 h-4" /></IconButton>
          <IconButton label="Aumentar zoom" size="sm" disabled={zoom >= 2.4} onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))}><ZoomIn className="w-4 h-4" /></IconButton>
          <div className="w-px h-5 bg-line mx-1" />
          <IconButton label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} size="sm" onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </IconButton>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-canvas flex justify-center p-4">
        {err ? (
          <p className="text-sm text-danger self-start">{err}</p>
        ) : !doc ? (
          <p className="text-sm text-fg-3 self-start">Carregando material...</p>
        ) : (
          <canvas ref={canvasRef} className="shadow-sm" />
        )}
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
