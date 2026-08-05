import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, m } from 'motion/react';
import '../theme.css';
import { PublicMotionProvider } from '../motion/PublicMotionProvider';
import { usePublicMotion } from '../motion/context';
import { PublicScene } from '../scene/PublicScene';
import { PublicLogo } from './PublicLogo';
import { stateSwap } from '../motion/variants';
import type { PublicAuthVisualState } from '../types';

export type PublicAuthLayoutProps = {
  /** Estado visual atual (controla a transição animada entre telas). */
  state: PublicAuthVisualState;
  children: ReactNode;
};

/**
 * Layout comum das quatro páginas de autenticação: cena ambiente à esquerda
 * no desktop, card do formulário à direita; no mobile o formulário tem
 * prioridade sobre fundo simplificado. Não assume nenhuma lógica de auth.
 */
export function PublicAuthLayout({ state, children }: PublicAuthLayoutProps) {
  return (
    <PublicMotionProvider>
      <AuthInner state={state}>{children}</AuthInner>
    </PublicMotionProvider>
  );
}

function AuthInner({ state, children }: PublicAuthLayoutProps) {
  const { reduceMotion } = usePublicMotion();
  // Em aba oculta o rAF fica suspenso e uma animação de saída nunca termina;
  // nesse caso a troca de estado é instantânea (anima só com a página visível).
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return (
    <div className="public-theme min-h-screen lg:grid lg:grid-cols-[1.05fr,1fr]">
      <aside aria-hidden="true" className="relative hidden overflow-hidden lg:block">
        <PublicScene variant="auth" className="absolute inset-0" />
        {/* Transição suave da cena para a coluna do formulário */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(11,13,16,0.35) 0%, rgba(11,13,16,0) 35%, rgba(11,13,16,0) 70%, rgba(11,13,16,0.9) 100%)',
          }}
        />
      </aside>

      <section className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-block rounded-md" aria-label="Matter Academy — início">
            <PublicLogo height={108} />
          </Link>
          <div className="pub-card pub-card--auth">
            {reduceMotion || !pageVisible ? (
              <div>{children}</div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <m.div key={state} variants={stateSwap} initial="hidden" animate="visible" exit="exit">
                  {children}
                </m.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
