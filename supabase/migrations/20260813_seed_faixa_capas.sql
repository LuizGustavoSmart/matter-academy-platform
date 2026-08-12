-- Garante a tabela (idempotente, caso a migration anterior ainda não tenha
-- sido aplicada) e preenche a capa padrão de cada faixa reaproveitando a
-- capa que já existe em algum curso daquela faixa — assim só falta subir a
-- imagem da Faixa Preta manualmente.
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

-- Semeia a capa de cada faixa a partir de um curso existente daquela faixa
-- que já tenha uma capa própria (não sobrescreve se a faixa já tiver capa).
WITH candidato AS (
  SELECT DISTINCT ON (faixa) faixa, capa_url
  FROM public.cursos
  WHERE faixa IS NOT NULL AND capa_url IS NOT NULL
  ORDER BY faixa, created_at DESC
)
UPDATE public.faixa_capas fc
SET capa_url = candidato.capa_url, updated_at = now()
FROM candidato
WHERE fc.faixa = candidato.faixa AND fc.capa_url IS NULL;

NOTIFY pgrst, 'reload schema';
