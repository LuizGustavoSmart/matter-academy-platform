-- profiles.nome
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome text;

-- Professors/monitors read student profiles in their turma
DROP POLICY IF EXISTS "Professors read student profiles in their turma" ON public.profiles;
CREATE POLICY "Professors read student profiles in their turma" ON public.profiles FOR SELECT TO authenticated
  USING (
    is_admin()
    OR auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM user_turmas ut
      WHERE ut.user_id = profiles.id
        AND is_professor_of_turma(ut.turma_id)
    )
  );

-- turmas.data_inicio
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS data_inicio date;

-- turmas financeiro
ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS tipo_cobranca text
    CHECK (tipo_cobranca IN ('fixo', 'por_aluno', 'recorrente_mensal'));
ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS valor numeric;

NOTIFY pgrst, 'reload schema';