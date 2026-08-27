-- Notificações in-app (sino) — geradas exclusivamente pela edge function
-- "notify-events" (service role), nunca inseridas direto pelo cliente, para
-- impedir que um usuário forje notificação para outro.
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nova_aula','nova_atividade','atividade_corrigida','nova_submissao')),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  link text,
  lida boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificacoes_user_lida_idx ON public.notificacoes (user_id, lida, criado_em DESC);

GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own notificacoes" ON public.notificacoes;
CREATE POLICY "Read own notificacoes" ON public.notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Update own notificacoes" ON public.notificacoes;
CREATE POLICY "Update own notificacoes" ON public.notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Sem policy de INSERT para "authenticated": linhas só entram via service role
-- (edge function notify-events).

NOTIFY pgrst, 'reload schema';
