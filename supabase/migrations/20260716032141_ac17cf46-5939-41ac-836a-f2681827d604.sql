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

NOTIFY pgrst, 'reload schema';