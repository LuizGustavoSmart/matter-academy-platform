import { lazy, ReactNode, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { m, useScroll, useTransform } from 'motion/react';
import '../theme.css';
import { PublicMotionProvider } from '../motion/PublicMotionProvider';
import { PublicScene } from '../scene/PublicScene';
import { PublicLogo } from './PublicLogo';
import { PublicAction } from './PublicAction';
import { fade, viewportOnce } from '../motion/variants';

/* Splash da intro em chunk próprio; enquanto carrega, cobre com ink puro. */
const LazyLogoIntro = lazy(() => import('../intro/LogoIntro').then((mod) => ({ default: mod.LogoIntro })));

/** Modo da intro (teste): ?intro=splash | hero | off — default hero 3D. */
function useIntroMode(): 'splash' | 'hero' | 'off' {
  return useMemo(() => {
    const v = new URLSearchParams(window.location.search).get('intro');
    return v === 'splash' || v === 'off' ? v : 'hero';
  }, []);
}

/**
 * Concha das páginas públicas de marketing: tema isolado, cena 3D única ao
 * fundo, máscara de proteção do conteúdo, header sticky com pill nav e footer.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <PublicMotionProvider>
      <ShellInner>{children}</ShellInner>
    </PublicMotionProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const { scrollYProgress } = useScroll();
  const introMode = useIntroMode();
  // A máscara esquerda protege o texto; suaviza no CTA final (conteúdo opaco).
  const maskOpacity = useTransform(scrollYProgress, [0.78, 0.94], [1, 0.55]);

  return (
    <div className="public-theme relative min-h-screen overflow-x-clip">
      <a href="#conteudo" className="pub-skiplink">
        Pular para o conteúdo
      </a>

      {introMode === 'splash' && (
        <Suspense fallback={<div aria-hidden="true" className="fixed inset-0 z-50 bg-[color:var(--pub-ink)]" />}>
          <LazyLogoIntro />
        </Suspense>
      )}
      <PublicScene
        variant="landing"
        progress={scrollYProgress}
        intro={introMode === 'hero'}
        className="fixed inset-0 z-0"
      />
      <m.div aria-hidden="true" className="pub-scrim pointer-events-none fixed inset-0 z-[1]" style={{ opacity: maskOpacity }} />

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <nav className="pub-nav" aria-label="Principal">
            <Link to="/" aria-label="Matter Academy — início" className="shrink-0 rounded-full">
              <PublicLogo height={64} />
            </Link>
            <div className="hidden items-center gap-7 md:flex">
              <a href="#recursos" className="pub-navlink">
                Recursos
              </a>
              <a href="#como-funciona" className="pub-navlink">
                Como funciona
              </a>
              <a href="#para-quem" className="pub-navlink">
                Para quem
              </a>
            </div>
            <div className="ml-auto">
              <PublicAction to="/login" size="sm" arrow>
                Entrar
              </PublicAction>
            </div>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="relative z-10">
        {children}
      </main>

      <footer className="relative z-10 py-12">
        <m.div
          className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fade}
        >
          <PublicLogo height={88} />
          <p className="pub-meta">© {new Date().getFullYear()} Matter Academy. Todos os direitos reservados.</p>
        </m.div>
      </footer>
    </div>
  );
}
