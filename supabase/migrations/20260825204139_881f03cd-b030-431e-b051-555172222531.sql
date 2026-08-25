-- Restringe o acesso de staff (professor/monitor) ao CURSO específico em que
-- dá aula, não mais à turma inteira. Antes, is_professor_of_turma(turma_id)
-- bastava ter uma linha de staff em QUALQUER curso da turma para liberar
-- aulas/atividades/dúvidas/comunidade de TODOS os cursos dela — agora que o
-- toggle "dá aula" é por curso (ver UserFormDrawer), isso vazava conteúdo de
-- cursos onde o usuário só é aluno.
--
-- Compatibilidade: linhas antigas de staff (curso_id NULL, de antes do toggle
-- por curso) continuam liberando a turma inteira, para não quebrar o acesso
-- de professores já cadastrados até que sejam re-salvos pelo admin.

CREATE OR REPLACE FUNCTION public.is_professor_of_turma_curso(t_id uuid, c_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_turmas ut
    JOIN profiles p ON p.id = ut.user_id
    WHERE ut.turma_id = t_id AND ut.user_id = auth.uid()
      AND p.role IN ('professor', 'monitor') AND ut.is_staff
      AND (ut.curso_id = c_id OR ut.curso_id IS NULL)
  );
$$;

-- ─────────────── user_turmas: professor vê matrícula de alunos só no curso que leciona ───────────────

DROP POLICY IF EXISTS "Professors read user_turmas of their turma" ON public.user_turmas;

CREATE POLICY "Professors read user_turmas of their turma" ON public.user_turmas FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id));

-- ─────────────── atividades ───────────────

DROP POLICY IF EXISTS "Read atividades" ON public.atividades;

CREATE POLICY "Read atividades" ON public.atividades FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id) OR (publicada = true AND has_access_to_turma_curso(turma_id, curso_id)));

DROP POLICY IF EXISTS "Professors and admins insert atividades" ON public.atividades;

CREATE POLICY "Professors and admins insert atividades" ON public.atividades FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id));

DROP POLICY IF EXISTS "Professors and admins update atividades" ON public.atividades;

CREATE POLICY "Professors and admins update atividades" ON public.atividades FOR UPDATE TO authenticated
  USING (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id))
  WITH CHECK (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id));

DROP POLICY IF EXISTS "Professors and admins delete atividades" ON public.atividades;

CREATE POLICY "Professors and admins delete atividades" ON public.atividades FOR DELETE TO authenticated
  USING (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id));

-- ─────────────── atividade_envios ───────────────

DROP POLICY IF EXISTS "Read atividade_envios" ON public.atividade_envios;

CREATE POLICY "Read atividade_envios" ON public.atividade_envios FOR SELECT TO authenticated
  USING (
    is_admin()
    OR aluno_id = auth.uid()
    OR EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma_curso(a.turma_id, a.curso_id))
  );

DROP POLICY IF EXISTS "Professors and admins grade envios" ON public.atividade_envios;

CREATE POLICY "Professors and admins grade envios" ON public.atividade_envios FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma_curso(a.turma_id, a.curso_id))
  )
  WITH CHECK (
    is_admin()
    OR EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma_curso(a.turma_id, a.curso_id))
  );

DROP POLICY IF EXISTS "Professors insert envios for grading" ON public.atividade_envios;

CREATE POLICY "Professors insert envios for grading" ON public.atividade_envios FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR (EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma_curso(a.turma_id, a.curso_id))));

-- ─────────────── aula_horarios ───────────────

DROP POLICY IF EXISTS "Read aula_horarios for enrolled" ON public.aula_horarios;

CREATE POLICY "Read aula_horarios for enrolled" ON public.aula_horarios FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id) OR has_access_to_turma_curso(turma_id, curso_id));

-- ─────────────── duvidas ───────────────

DROP POLICY IF EXISTS "Read duvidas" ON public.duvidas;

CREATE POLICY "Read duvidas" ON public.duvidas FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id) OR aluno_id = auth.uid());

DROP POLICY IF EXISTS "Professors and admins answer duvidas" ON public.duvidas;

CREATE POLICY "Professors and admins answer duvidas" ON public.duvidas FOR UPDATE TO authenticated
  USING (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id))
  WITH CHECK (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id));

-- ─────────────── community_messages ───────────────

DROP POLICY IF EXISTS "Read community_messages" ON public.community_messages;

CREATE POLICY "Read community_messages" ON public.community_messages FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id) OR has_access_to_turma_curso(turma_id, curso_id));

DROP POLICY IF EXISTS "Insert community_messages" ON public.community_messages;

CREATE POLICY "Insert community_messages" ON public.community_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id) OR has_access_to_turma_curso(turma_id, curso_id))
  );

-- ─────────────── presencas: can_manage_presenca passa a checar o curso da aula ───────────────

CREATE OR REPLACE FUNCTION public.can_manage_presenca(t_id uuid, a_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT is_admin()
      OR is_professor_of_turma_curso(t_id, aula_curso_id(a_id))
      OR EXISTS (
        SELECT 1 FROM aulas a
        JOIN curso_turmas ct ON ct.curso_id = a.curso_id AND ct.turma_id = t_id
        WHERE a.id = a_id AND ct.professor_id = auth.uid()
      );
$$;

NOTIFY pgrst, 'reload schema';