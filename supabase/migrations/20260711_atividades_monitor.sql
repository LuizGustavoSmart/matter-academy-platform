-- Monitores passam a ter as mesmas permissões de professor sobre atividades
CREATE OR REPLACE FUNCTION public.is_professor_of_turma(t_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_turmas ut
    JOIN profiles p ON p.id = ut.user_id
    WHERE ut.turma_id = t_id AND ut.user_id = auth.uid() AND p.role IN ('professor', 'monitor')
  );
$$;
