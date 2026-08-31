CREATE TABLE IF NOT EXISTS public.turma_capas (
  tipo text PRIMARY KEY CHECK (tipo IN ('td_matter', 'padrao')),
  capa_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.turma_capas (tipo) VALUES ('td_matter'), ('padrao')
ON CONFLICT (tipo) DO NOTHING;

GRANT SELECT ON public.turma_capas TO authenticated;
GRANT ALL ON public.turma_capas TO service_role;

ALTER TABLE public.turma_capas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read turma_capas" ON public.turma_capas;
CREATE POLICY "Read turma_capas" ON public.turma_capas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins write turma_capas" ON public.turma_capas;
CREATE POLICY "Admins write turma_capas" ON public.turma_capas FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

NOTIFY pgrst, 'reload schema';