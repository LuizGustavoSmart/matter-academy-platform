ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome text;
NOTIFY pgrst, 'reload schema';