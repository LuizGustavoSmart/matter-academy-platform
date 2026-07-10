ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS anexo_url text;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS anexo_nome text;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS aula_id uuid REFERENCES public.aulas(id) ON DELETE SET NULL;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS nota_maxima numeric NOT NULL DEFAULT 10;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS prazo timestamptz;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS professor_id uuid REFERENCES public.profiles(id);
NOTIFY pgrst, 'reload schema';