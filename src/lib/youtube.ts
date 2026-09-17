export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

export function getYouTubeEmbed(url: string): string | null {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/**
 * Link absoluto pro MESMO vídeo cadastrado — nunca troca de vídeo. O campo
 * de cadastro aceita várias formas (URL completa, sem "https://", ou só o
 * ID de 11 caracteres); usadas cruas como href, as duas últimas formas
 * viram um caminho relativo do nosso próprio site em vez de ir ao YouTube.
 * Uma URL já absoluta volta exatamente como veio, sem nenhuma alteração.
 */
export function toAbsoluteYouTubeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const id = getYouTubeId(trimmed);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  return `https://${trimmed}`;
}
