ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS data_inicio date;
NOTIFY pgrst, 'reload schema';