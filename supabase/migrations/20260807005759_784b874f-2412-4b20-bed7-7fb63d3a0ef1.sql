ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sexo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_nascimento date;
NOTIFY pgrst, 'reload schema';