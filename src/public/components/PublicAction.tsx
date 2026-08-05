import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type BaseProps = {
  variant?: Variant;
  size?: Size;
  /** Glow verde reservado — no máximo um por view (regra do DS). */
  glow?: boolean;
  /** Seta com micro-deslocamento no hover/foco. */
  arrow?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

type ActionAsLink = BaseProps & { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>;
type ActionAsAnchor = BaseProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>;
type ActionAsButton = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export type PublicActionProps = ActionAsLink | ActionAsAnchor | ActionAsButton;

function classes({ variant = 'primary', size = 'md', glow, className = '' }: BaseProps) {
  return [
    'pub-btn',
    `pub-btn--${variant}`,
    size !== 'md' ? `pub-btn--${size}` : '',
    glow ? 'pub-btn--glow' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * CTA público com o mesmo estilo para <Link>, <a> e <button>,
 * preservando semântica, foco visível e estados desabilitados.
 */
export function PublicAction(props: PublicActionProps) {
  const { variant, size, glow, arrow, loading, icon, className, children, ...rest } = props;
  const cls = classes({ variant, size, glow, className, children });
  const arrowSize = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const content = (
    <>
      {loading ? <Loader2 className={`${arrowSize} animate-spin`} aria-hidden="true" /> : icon}
      {children}
      {arrow && !loading && <ArrowRight className={`pub-btn__arrow ${arrowSize}`} aria-hidden="true" />}
    </>
  );

  if ('to' in rest) {
    const { to, ...anchor } = rest as ActionAsLink;
    return (
      <Link to={to} className={cls} {...anchor}>
        {content}
      </Link>
    );
  }
  if ('href' in rest) {
    const anchor = rest as ActionAsAnchor;
    return (
      <a className={cls} {...anchor}>
        {content}
      </a>
    );
  }
  const button = rest as ActionAsButton;
  return (
    <button className={cls} {...button} disabled={loading || button.disabled}>
      {content}
    </button>
  );
}
