/** Junta classes condicionais, ignorando valores falsy. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Iniciais para avatares (até 2 letras). */
export function initials(name?: string | null, email?: string | null): string {
  const src = (name && name.trim()) || (email ? email.split('@')[0] : '') || '?';
  const words = src.trim().split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Cor estável (hue) derivada de uma string, para avatares. */
export function stringHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
