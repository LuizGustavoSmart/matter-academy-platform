import { ReactNode } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Região de alerta sempre presente no DOM: leitores de tela anunciam o texto
 * quando ele é inserido, e a transição visual não remove a mensagem.
 */
export function FormAlert({ error }: { error: string | null }) {
  return (
    <div role="alert" aria-live="assertive" className="min-h-[1.25rem]">
      {error && <p className="pub-alert">{error}</p>}
    </div>
  );
}

export function LoadingView({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 justify-center" role="status" aria-live="polite">
      <Loader2 className="w-5 h-5 animate-spin text-[color:var(--pub-fg-muted)]" aria-hidden="true" />
      <p className="pub-meta text-sm">{label}</p>
    </div>
  );
}

export function SuccessView({ title, note }: { title: string; note: string }) {
  return (
    <div className="text-center py-10" role="status" aria-live="polite">
      <CheckCircle2 className="w-12 h-12 pub-success-icon mx-auto mb-4" aria-hidden="true" />
      <h1 className="mb-2">{title}</h1>
      <p className="text-[color:var(--pub-fg-soft)]">{note}</p>
    </div>
  );
}

export function ErrorView({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10">
      <div role="alert" aria-live="assertive">
        <p className="pub-alert mb-4">{message}</p>
      </div>
      {action}
    </div>
  );
}
