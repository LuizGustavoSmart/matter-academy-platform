type LogoProps = {
  className?: string;
  height?: number;
  iconOnly?: boolean;
};

export function Logo({ className = '', height = 32, iconOnly = false }: LogoProps) {
  return (
    <span
      className="relative inline-flex flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-ma"
      style={{ width: iconOnly ? height * 0.58 : height * (16 / 9), height }}
    >
      <img
        src="/logos/matter-academy.svg"
        alt="Matter Academy"
        style={{ height }}
        className={`app-logo-dark absolute inset-y-0 left-0 max-w-none w-auto select-none ${className}`}
        draggable={false}
      />
      <img
        src="/logos/matter-academy-light.svg?v=2"
        alt=""
        aria-hidden="true"
        style={{ height }}
        className={`app-logo-light absolute inset-y-0 left-0 hidden max-w-none w-auto select-none ${className}`}
        draggable={false}
      />
    </span>
  );
}
