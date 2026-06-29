-- Permite múltiplas linhas por user+turma (uma por curso liberado)
-- Remove PK composta antiga (user_id, turma_id)
ALTER TABLE public.user_turmas DROP CONSTRAINT IF EXISTS user_turmas_pkey;

-- Adiciona coluna id como nova PK
ALTER TABLE public.user_turmas ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE public.user_turmas SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.user_turmas ADD PRIMARY KEY (id);

-- Adiciona curso_id: vincula o usuário a um curso específico dentro da turma
ALTER TABLE public.user_turmas
  ADD COLUMN IF NOT EXISTS curso_id uuid REFERENCES public.cursos(id) ON DELETE CASCADE;

-- Evita duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS user_turmas_user_turma_curso_key
  ON public.user_turmas (user_id, turma_id, curso_id);
