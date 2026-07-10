ALTER TABLE public.user_turmas DROP CONSTRAINT IF EXISTS user_turmas_pkey;
ALTER TABLE public.user_turmas ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE public.user_turmas SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.user_turmas ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.user_turmas ADD PRIMARY KEY (id);
ALTER TABLE public.user_turmas ADD COLUMN IF NOT EXISTS curso_id uuid REFERENCES public.cursos(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS user_turmas_user_turma_curso_key ON public.user_turmas (user_id, turma_id, curso_id);