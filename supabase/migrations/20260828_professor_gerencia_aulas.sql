-- Professor/monitor staff de um curso já tinha, na tela, os botões de criar/
-- editar aula e definir data/horário — mas a RLS de `aulas` e
-- `aula_horarios` só liberava INSERT/UPDATE/DELETE para admin, então essas
-- ações do professor sempre falhavam silenciosamente. Agora ele tem o mesmo
-- controle do admin (criar/editar/excluir aula, incluir capa e material em
-- PDF, definir data/horário) para os cursos em que é staff.

CREATE OR REPLACE FUNCTION public.is_professor_of_curso(c_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT is_admin()
      OR EXISTS (
        SELECT 1 FROM curso_turmas ct
        WHERE ct.curso_id = c_id AND is_professor_of_turma_curso(ct.turma_id, ct.curso_id)
      );
$$;

DROP POLICY IF EXISTS "Admins insert aulas" ON public.aulas;
CREATE POLICY "Admins and staff insert aulas" ON public.aulas FOR INSERT TO authenticated
  WITH CHECK (is_professor_of_curso(curso_id));

DROP POLICY IF EXISTS "Admins update aulas" ON public.aulas;
CREATE POLICY "Admins and staff update aulas" ON public.aulas FOR UPDATE TO authenticated
  USING (is_professor_of_curso(curso_id)) WITH CHECK (is_professor_of_curso(curso_id));

DROP POLICY IF EXISTS "Admins delete aulas" ON public.aulas;
CREATE POLICY "Admins and staff delete aulas" ON public.aulas FOR DELETE TO authenticated
  USING (is_professor_of_curso(curso_id));

DROP POLICY IF EXISTS "Admins manage aula_horarios" ON public.aula_horarios;
CREATE POLICY "Admins and staff manage aula_horarios" ON public.aula_horarios FOR ALL TO authenticated
  USING (is_professor_of_curso(curso_id)) WITH CHECK (is_professor_of_curso(curso_id));

NOTIFY pgrst, 'reload schema';
