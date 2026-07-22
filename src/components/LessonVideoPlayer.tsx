import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
// watermark removed
import { supabase } from '../lib/supabase';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Props = {
  lessonId: string;
  onEnded?: () => void;
  onNext?: () => void;
  hasNext?: boolean;
};

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

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

export default function LessonVideoPlayer({ lessonId, onEnded, onNext, hasNext }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);
  const hideControlsTimer = useRef<number | null>(null);

  const [videoId, setVideoId] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const [playerState, setPlayerState] = useState<number>(-1); // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [pseudoFs, setPseudoFs] = useState(false);

  // Fetch videoId from edge function
  const fetchVideo = useCallback(async () => {
    setFetching(true);
    setLoadErr(null);
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
        setLoadErr(msg);
        return;
      }
      setVideoId(data?.videoId ?? null);
      // userEmail no longer needed (watermark removed)
    } catch (e) {
      setLoadErr('Erro de rede. Tente novamente.');
    } finally {
      setFetching(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  // Init YT player when videoId ready
  useEffect(() => {
    if (!videoId || !playerHostRef.current) return;
    let cancelled = false;
    let player: any;

    loadYouTubeAPI().then(() => {
      if (cancelled || !playerHostRef.current) return;
      player = new window.YT.Player(playerHostRef.current, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        playerVars: {
          controls: 0,
          rel: 0,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          playsinline: 1,
          cc_load_policy: 0,
          origin: window.location.origin,
          enablejsapi: 1,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            setDuration(player.getDuration() ?? 0);
            setVolume(player.getVolume() ?? 100);
            setIsReady(true);
            const iframe = player.getIframe?.();
            if (iframe) {
              iframe.setAttribute(
                'sandbox',
                'allow-scripts allow-same-origin allow-presentation'
              );
              iframe.setAttribute('title', 'Aula');
            }
          },
          onStateChange: (e: any) => {
            setPlayerState(e.data);
            if (e.data === 1) {
              setDuration(player.getDuration() ?? 0);
            }
            if (e.data === 0) onEnded?.();
          },
          onPlaybackRateChange: (e: any) => setRate(e.data),
        },
      });
    });

    return () => {
      cancelled = true;
      try { player?.destroy?.(); } catch {}
      playerRef.current = null;
    };
  }, [videoId, onEnded]);

  // Polling current time
  useEffect(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      try {
        setCurrent(p.getCurrentTime() ?? 0);
        if (!duration) setDuration(p.getDuration() ?? 0);
      } catch {}
    }, 500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [duration]);

  // (watermark removed)

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = playerRef.current;
      if (!p) return;
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        const s = p.getPlayerState?.();
        if (s === 1) p.pauseVideo(); else p.playVideo();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        p.seekTo((p.getCurrentTime() ?? 0) + 5, true);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        p.seekTo(Math.max(0, (p.getCurrentTime() ?? 0) - 5), true);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        const v = Math.min(100, (p.getVolume() ?? 100) + 10);
        p.setVolume(v); setVolume(v);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const v = Math.max(0, (p.getVolume() ?? 100) - 10);
        p.setVolume(v); setVolume(v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(() => setShowControls(false), 3000);
  };

  const togglePlay = () => {
    const p = playerRef.current; if (!p) return;
    const s = p.getPlayerState();
    if (s === 1) p.pauseVideo(); else p.playVideo();
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    playerRef.current?.seekTo(t, true);
    setCurrent(t);
  };

  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    setVolume(v);
    playerRef.current?.setVolume(v);
    if (v === 0) { playerRef.current?.mute(); setMuted(true); }
    else if (muted) { playerRef.current?.unMute(); setMuted(false); }
  };

  const toggleMute = () => {
    const p = playerRef.current; if (!p) return;
    if (muted) { p.unMute(); setMuted(false); } else { p.mute(); setMuted(true); }
  };

  const changeRate = (r: number) => {
    setRate(r);
    playerRef.current?.setPlaybackRate(r);
  };

  const goFullscreen = async () => {
    const el = containerRef.current as any;
    if (!el) return;
    const doc: any = document;
    const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    if (isFs) {
      try { (doc.exitFullscreen?.() || doc.webkitExitFullscreen?.()); } catch { /* ignore */ }
      setPseudoFs(false);
      return;
    }
    if (pseudoFs) { setPseudoFs(false); return; }
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/(Macintosh)/.test(ua) && 'ontouchend' in document);
    // iOS Safari doesn't support requestFullscreen on <div>/<iframe>; go straight to pseudo-fs
    if (!isIOS) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        try {
          await req.call(el);
          try { await (screen.orientation as any)?.lock?.('landscape'); } catch { /* ignore */ }
          return;
        } catch { /* fallback */ }
      }
    }
    setPseudoFs(true);
  };

  useEffect(() => {
    const onFsChange = () => {
      const doc: any = document;
      const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!isFs) {
        try { (screen.orientation as any)?.unlock?.(); } catch { /* ignore */ }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange as any);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange as any);
    };
  }, []);

  useEffect(() => {
    if (!pseudoFs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPseudoFs(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [pseudoFs]);

  const replay = () => {
    const p = playerRef.current; if (!p) return;
    p.seekTo(0, true); p.playVideo();
  };

  if (loadErr) {
    return (
      <div className="aspect-video rounded-lg overflow-hidden border border-[#1c1f26] bg-black grid place-items-center text-center px-6">
        <div>
          <p className="text-white mb-3">{loadErr}</p>
          {loadErr.includes('rede') && (
            <button onClick={fetchVideo} className="px-4 py-2 rounded-md bg-[#cbfb00] text-black text-sm font-medium">
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="aspect-video rounded-lg overflow-hidden border border-[#1c1f26] bg-black grid place-items-center">
        <Loader2 className="w-8 h-8 text-[#cbfb00] animate-spin" />
      </div>
    );
  }

  const isBuffering = playerState === 3;
  const isUnstarted = playerState === -1;
  const isPaused = playerState === 2;
  const isEnded = playerState === 0;
  const isPlaying = playerState === 1;
  const showInitialLoader = !isReady;
  const showCenterPlay = isReady && (isUnstarted || isPaused);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black select-none ${pseudoFs ? 'fixed inset-0 z-[9999] w-screen h-screen' : 'aspect-video rounded-lg overflow-hidden border border-[#1c1f26]'}`}
      onContextMenu={(e) => e.preventDefault()}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* CAMADA 0: player */}
      <div className="absolute inset-0 z-0">
        <div ref={playerHostRef} className="w-full h-full pointer-events-none" />
      </div>

      {/* CAMADA 1: clique central (play/pause) — sempre presente sobre o vídeo, exceto quando ended */}
      {!isEnded && (
        <div
          className="absolute left-0 right-0 top-0 z-10 cursor-pointer"
          style={{ bottom: 64 }}
          onClick={() => {
            if (!isReady) return;
            const p = playerRef.current; if (!p) return;
            const s = p.getPlayerState?.();
            if (s === 1) p.pauseVideo(); else p.playVideo();
          }}
        />
      )}

      {/* CAMADA 2: loader inicial (apenas antes do player estar pronto) */}
      {showInitialLoader && (
        <div className="absolute inset-0 z-20 bg-black grid place-items-center">
          <Loader2 className="w-10 h-10 text-[#cbfb00] animate-spin" />
        </div>
      )}

      {/* CAMADA 2b: buffering durante reprodução — spinner discreto, sem cobrir o vídeo */}
      {isReady && isBuffering && (
        <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none">
          <Loader2 className="w-10 h-10 text-white/80 animate-spin drop-shadow-lg" />
        </div>
      )}

      {/* CAMADA 3: botão central de play (pronto e não tocando) */}
      {showCenterPlay && (
        <div className={`absolute inset-0 z-20 grid place-items-center ${isPaused ? 'bg-black/40' : 'bg-black/20'} pointer-events-none`}>
          <button
            onClick={() => playerRef.current?.playVideo()}
            className="pointer-events-auto w-20 h-20 rounded-full bg-white grid place-items-center hover:scale-105 transition-transform shadow-2xl"
            aria-label="Reproduzir"
          >
            <Play className="w-8 h-8 text-black fill-black ml-1" />
          </button>
        </div>
      )}

      {/* CAMADA 4: ended */}
      {isEnded && (
        <div className="absolute inset-0 z-20 bg-black/90 grid place-items-center">
          <div className="text-center px-6">
            <CheckCircle2 className="w-14 h-14 text-[#cbfb00] mx-auto mb-4" />
            <p className="text-white text-xl font-medium mb-6">Aula concluída</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={replay}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#1c1f26] text-white hover:bg-white/5 text-sm"
              >
                <RotateCcw className="w-4 h-4" /> Assistir novamente
              </button>
              {hasNext && (
                <button
                  onClick={() => onNext?.()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#cbfb00] text-black hover:opacity-90 text-sm font-medium"
                >
                  Próxima aula <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* (click overlay is camada 1) */}

      {/* CAMADA 6: barra de controles */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 px-4 pt-10 pb-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-200 ${
          showControls || isPaused ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={onSeek}
          className="w-full h-1 accent-[#cbfb00] cursor-pointer"
          style={{ background: `linear-gradient(to right, #cbfb00 0%, #cbfb00 ${(current / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(current / (duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)` }}
        />
        <div className="mt-2 flex items-center gap-3 text-white">
          <button onClick={togglePlay} className="p-1 hover:text-[#cbfb00]" aria-label="Play/Pause">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <span className="text-xs tabular-nums text-white/80">
            {fmt(current)} / {fmt(duration)}
          </span>

          <div className="flex items-center gap-2 ml-2">
            <button onClick={toggleMute} className="p-1 hover:text-[#cbfb00]" aria-label="Mudo">
              {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : volume}
              onChange={onVolume}
              className="w-20 h-1 accent-[#cbfb00] cursor-pointer"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <select
              value={rate}
              onChange={(e) => changeRate(parseFloat(e.target.value))}
              className="bg-black/60 border border-white/20 text-white text-xs rounded px-2 py-1 outline-none"
            >
              {[0.5, 1, 1.25, 1.5, 2].map((r) => (
                <option key={r} value={r}>{r}x</option>
              ))}
            </select>
            <button onClick={goFullscreen} className="p-1 hover:text-[#cbfb00]" aria-label="Tela cheia">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
