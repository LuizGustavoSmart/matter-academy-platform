import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Evita que uma exceção de renderização resulte em uma tela inteiramente vazia. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app-render] erro não tratado', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen grid place-items-center bg-canvas px-5 text-center">
          <section className="max-w-md">
            <h1 className="text-xl text-fg font-semibold">Não foi possível carregar esta página</h1>
            <p className="mt-2 text-sm text-fg-3">Recarregue a página. Se o problema continuar, informe o suporte.</p>
            <button className="mt-5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-ink" onClick={() => window.location.reload()}>
              Recarregar página
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
