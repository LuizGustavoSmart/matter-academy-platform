ALTER TABLE public.curso_turmas ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.curso_turmas ADD COLUMN IF NOT EXISTS data_fim date;
ALTER TABLE public.curso_turmas ADD COLUMN IF NOT EXISTS professor_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.curso_turmas ADD COLUMN IF NOT EXISTS horario_inicio time;
ALTER TABLE public.curso_turmas ADD COLUMN IF NOT EXISTS horario_fim time;
ALTER TABLE public.curso_turmas ADD COLUMN IF NOT EXISTS dia_semana text;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS avaliada_com_nota boolean NOT NULL DEFAULT true;
NOTIFY pgrst, 'reload schema';