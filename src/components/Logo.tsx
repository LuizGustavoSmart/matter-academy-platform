type LogoProps = {
  className?: string;
  height?: number;
  iconOnly?: boolean;
};

export function Logo({ className = '', height = 32, iconOnly = false }: LogoProps) {
  return (
    <span
      className="inline-flex flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-ma"
      style={{ width: iconOnly ? height * 0.58 : height * (16 / 9), height }}
    >
    <img
      src="/logos/matter-academy.svg"
      alt="Matter Academy"
      style={{ height }}
      className={`max-w-none w-auto select-none ${className}`}
      draggable={false}
    />
    </span>
  );
}
