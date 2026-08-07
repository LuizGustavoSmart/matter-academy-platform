ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_visto boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';