-- Preenche os dois modelos de capa de turma reaproveitando imagens já
-- enviadas para turmas existentes, em vez de exigir um novo upload.
UPDATE public.turma_capas
SET capa_url = (
  SELECT capa_url FROM public.turmas
  WHERE (nome ILIKE 'TDMatter' OR codigo ILIKE 'TDMatter') AND capa_url IS NOT NULL
  LIMIT 1
), updated_at = now()
WHERE tipo = 'td_matter';

UPDATE public.turma_capas
SET capa_url = (
  SELECT capa_url FROM public.turmas
  WHERE (codigo ILIKE 'T001' OR nome ILIKE 'T001') AND capa_url IS NOT NULL
  LIMIT 1
), updated_at = now()
WHERE tipo = 'padrao';

NOTIFY pgrst, 'reload schema';
