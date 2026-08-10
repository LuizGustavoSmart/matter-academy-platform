ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';