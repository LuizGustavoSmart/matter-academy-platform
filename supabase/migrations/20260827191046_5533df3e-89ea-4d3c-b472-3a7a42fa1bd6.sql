ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS capa_aulas_padrao_url text;
NOTIFY pgrst, 'reload schema';