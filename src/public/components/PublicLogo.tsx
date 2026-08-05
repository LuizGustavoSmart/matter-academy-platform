/**
 * Logo oficial transparente (assets/logos/matter-academy-negative.png do
 * Claude Design — RGBA real, sem fundo preto). Usada como está, sem
 * blend hacks: funciona sobre qualquer superfície escura da identidade.
 */
export function PublicLogo({ height = 44, className = '' }: { height?: number; className?: string }) {
  return (
    <img
      src="/logos/matter-academy-negative.png"
      alt="Matter Academy"
      style={{ height }}
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
