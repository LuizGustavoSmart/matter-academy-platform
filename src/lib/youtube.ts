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
 * Link absoluto pro MESMO vídeo cadastrado (mesmo ID), no formato
 * youtube.com/watch — nunca troca de vídeo. Sempre canoniza pra esse
 * formato, por dois motivos: (1) o campo de cadastro aceita várias formas
 * (URL completa, sem "https://", ou só o ID de 11 caracteres) e as duas
 * últimas, usadas cruas como href, viram um caminho relativo do nosso
 * próprio site em vez de ir ao YouTube; (2) links "youtu.be/..." abertos em
 * nova aba com noopener esbarram num bloqueio do Chrome no redirecionamento
 * dele pro youtube.com (ERR_BLOCKED_BY_RESPONSE) — não relacionado à
 * visibilidade do vídeo, só ao domínio do link.
 */
export function toAbsoluteYouTubeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const id = getYouTubeId(trimmed);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
