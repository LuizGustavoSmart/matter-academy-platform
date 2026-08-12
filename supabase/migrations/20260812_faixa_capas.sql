-- Imagem de capa padrão por faixa (Branca/Verde/Marrom/Preta), reutilizada
-- automaticamente por qualquer curso/aula daquela faixa que não tenha uma
-- capa própria enviada — evita duplicar a mesma imagem dezenas de vezes.
CREATE TABLE IF NOT EXISTS public.faixa_capas (
  faixa text PRIMARY KEY CHECK (faixa IN ('branca', 'verde', 'marrom', 'preta')),
  capa_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.faixa_capas (faixa) VALUES ('branca'), ('verde'), ('marrom'), ('preta')
ON CONFLICT (faixa) DO NOTHING;

GRANT SELECT ON public.faixa_capas TO authenticated;
GRANT ALL ON public.faixa_capas TO service_role;

ALTER TABLE public.faixa_capas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read faixa_capas" ON public.faixa_capas;
CREATE POLICY "Read faixa_capas" ON public.faixa_capas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins write faixa_capas" ON public.faixa_capas;
CREATE POLICY "Admins write faixa_capas" ON public.faixa_capas FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

NOTIFY pgrst, 'reload schema';
