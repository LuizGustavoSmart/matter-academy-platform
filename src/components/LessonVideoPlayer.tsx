import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type WatchProgress = { segundosAssistidos: number; duracao: number; pct: number };

type Props = {
  lessonId: string;
  /** Chamado a cada avanço de reprodução com o total efetivamente assistido. */
  onProgress?: (p: WatchProgress) => void;
  /** Chamado assim que o id do vídeo é resolvido (ou null se não houver/der erro) — usado pelo botão "Problemas para assistir". */
  onVideoId?: (id: string | null) => void;
};

/**
 * Salto máximo (em segundos de mídia) que ainda conta como reprodução contínua.
 * O polling roda a cada 500ms, então mesmo a 2x um tick avança ~1s; a folga
 * cobre travadas de buffer. Saltos maiores são seek e não somam tempo assistido.
 */
const MAX_SALTO_CONTINUO = 3;

/** Se o player não avisar que está pronto dentro desse tempo, mostra erro com
 * "Tentar novamente" em vez de deixar o loader girando pra sempre. */
const READY_TIMEOUT_MS = 15000;

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

/**
 * Player da aula — usa o player e os controles nativos do YouTube (sem
 * sobreposição própria); a API do YouTube é usada só nos bastidores para
 * medir o tempo assistido (marcação automática de aula concluída).
 */
export default function LessonVideoPlayer({ lessonId, onProgress, onVideoId }: Props) {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);

  // Tempo efetivamente reproduzido, somado tick a tick. Não usamos a posição do
  // vídeo como progresso: arrastar a barra para o fim marcaria a aula inteira
  // como assistida, e rebobinar contaria o mesmo trecho duas vezes.
  const assistidoRef = useRef(0);
  const ultimoTempoRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { assistidoRef.current = 0; ultimoTempoRef.current = 0; }, [lessonId]);

  const [videoId, setVideoId] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchVideo = useCallback(async () => {
    setFetching(true);
    setLoadErr(null);
    setIsReady(false);
    try {
      const { data, error } = await supabase.functions.invoke('get-lesson-video', {
        body: { lesson_id: lessonId },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let msg = 'Erro de rede';
        try {
          const j = await ctx?.json?.();
          if (j?.error) msg = j.error;
        } catch { /* ignore */ }
        if (ctx?.status === 403) msg = 'Você não tem acesso a esta aula';
        if (ctx?.status === 404) msg = 'Esta aula ainda não possui vídeo cadastrado.';
        setLoadErr(msg);
        onVideoId?.(null);
        return;
      }
      const id = data?.videoId ?? null;
      setVideoId(id);
      onVideoId?.(id);
    } catch {
      setLoadErr('Erro de rede. Tente novamente.');
      onVideoId?.(null);
    } finally {
      setFetching(false);
    }
  }, [lessonId, onVideoId]);

  useEffect(() => { fetchVideo(); }, [fetchVideo, reloadKey]);

  // Init YT player when videoId ready
  useEffect(() => {
    if (!videoId || !playerHostRef.current) return;
    let cancelled = false;
    let player: any;

    loadYouTubeAPI().then(() => {
      if (cancelled || !playerHostRef.current) return;
      player = new window.YT.Player(playerHostRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
          enablejsapi: 1,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            setDuration(player.getDuration() ?? 0);
            setIsReady(true);
            if (readyTimeoutRef.current) { window.clearTimeout(readyTimeoutRef.current); readyTimeoutRef.current = null; }
          },
          onStateChange: (e: any) => {
            if (e.data === 1) setDuration(player.getDuration() ?? 0);
          },
        },
      });
    });

    readyTimeoutRef.current = window.setTimeout(() => {
      if (!cancelled) setLoadErr('O vídeo demorou demais para carregar.');
    }, READY_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (readyTimeoutRef.current) { window.clearTimeout(readyTimeoutRef.current); readyTimeoutRef.current = null; }
      try { player?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
      setIsReady(false);
    };
  }, [videoId]);

  // Polling do tempo assistido — roda por trás mesmo com os controles nativos do YouTube.
  useEffect(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      try {
        const t = p.getCurrentTime() ?? 0;
        const dur = duration || (p.getDuration?.() ?? 0);
        if (!duration && dur) setDuration(dur);

        const delta = t - ultimoTempoRef.current;
        ultimoTempoRef.current = t;
        // delta negativo = rebobinou; delta grande = pulou para frente.
        // Nos dois casos nada é somado — só reprodução contínua conta.
        if (delta > 0 && delta <= MAX_SALTO_CONTINUO && dur > 0) {
          assistidoRef.current += delta;
          onProgressRef.current?.({
            segundosAssistidos: assistidoRef.current,
            duracao: dur,
            pct: Math.min(100, (assistidoRef.current / dur) * 100),
          });
        }
      } catch { /* ignore */ }
    }, 500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [duration]);

  const retry = () => setReloadKey((k) => k + 1);

  if (loadErr) {
    return (
      <div className="aspect-video rounded-lg overflow-hidden border border-line bg-black grid place-items-center text-center px-6">
        <div>
          <p className="text-white mb-3">{loadErr}</p>
          <button onClick={retry} className="px-4 py-2 rounded-md bg-[#cbfb00] text-black text-sm font-medium">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video rounded-lg overflow-hidden border border-line bg-black">
      <div ref={playerHostRef} className="w-full h-full" />
      {(fetching || !isReady) && (
        <div className="absolute inset-0 z-10 bg-black grid place-items-center pointer-events-none">
          <Loader2 className="w-8 h-8 text-[#cbfb00] animate-spin" />
        </div>
      )}
    </div>
  );
}
