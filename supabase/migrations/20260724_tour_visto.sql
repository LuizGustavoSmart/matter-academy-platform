-- Controla se o aluno já viu o tour de boas-vindas (aparece só na primeira vez)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tour_visto boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
