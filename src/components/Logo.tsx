export function Logo({ className = '', height = 32 }: { className?: string; height?: number }) {
  return (
    <img
      src="/Logo_negativo.jpg"
      alt="Matter Academy"
      style={{ height }}
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
