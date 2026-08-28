CREATE OR REPLACE FUNCTION public.can_manage_progresso(a_id uuid, u_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
SELECT is_admin()
OR EXISTS (
  SELECT 1 FROM user_turmas ut
  WHERE ut.user_id = u_id
    AND ut.curso_id = aula_curso_id(a_id)
    AND is_professor_of_turma_curso(ut.turma_id, ut.curso_id)
);
$$;

DROP POLICY IF EXISTS "Users insert own progresso" ON public.progresso;
CREATE POLICY "Users and staff insert progresso" ON public.progresso FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR can_manage_progresso(aula_id, user_id));

DROP POLICY IF EXISTS "Users update own progresso" ON public.progresso;
CREATE POLICY "Users and staff update progresso" ON public.progresso FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR can_manage_progresso(aula_id, user_id))
WITH CHECK (user_id = auth.uid() OR can_manage_progresso(aula_id, user_id));

NOTIFY pgrst, 'reload schema';