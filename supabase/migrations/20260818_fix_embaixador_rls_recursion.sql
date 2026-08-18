-- A migration anterior (20260814_embaixador_role.sql) criou uma policy em
-- user_turmas cujo próprio USING consulta user_turmas de novo — isso causa
-- "infinite recursion detected in policy for relation user_turmas" no
-- Postgres, porque a subconsulta reaplica a mesma policy indefinidamente.
-- Como user_turmas é lido por quase toda a plataforma (perfil, presença,
-- atividades, login), isso quebrou o login inteiro.
--
-- Correção: usar funções SECURITY DEFINER (mesmo padrão de is_admin() e
-- is_professor_of_turma()), que rodam com privilégios do owner e por isso
-- não reaplicam RLS internamente, eliminando a recursão.

CREATE OR REPLACE FUNCTION public.is_embaixador_of_turma(p_turma_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_turmas
    WHERE turma_id = p_turma_id AND user_id = auth.uid() AND is_embaixador
  );
$$;

CREATE OR REPLACE FUNCTION public.is_embaixador_over_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_turmas ut_embaixador
    JOIN public.user_turmas ut_aluno ON ut_aluno.turma_id = ut_embaixador.turma_id
    WHERE ut_embaixador.user_id = auth.uid() AND ut_embaixador.is_embaixador
      AND ut_aluno.user_id = p_user_id
  );
$$;

-- user_turmas: substitui a policy recursiva por uma baseada na função.
DROP POLICY IF EXISTS "Embaixadores leem user_turmas da turma" ON public.user_turmas;
CREATE POLICY "Embaixadores leem user_turmas da turma" ON public.user_turmas FOR SELECT TO authenticated
  USING (is_admin() OR is_embaixador_of_turma(turma_id));

DROP POLICY IF EXISTS "Embaixadores leem profiles de alunos da turma" ON public.profiles;
CREATE POLICY "Embaixadores leem profiles de alunos da turma" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin() OR is_embaixador_over_user(profiles.id));

DROP POLICY IF EXISTS "Embaixadores leem presencas da turma" ON public.presencas;
CREATE POLICY "Embaixadores leem presencas da turma" ON public.presencas FOR SELECT TO authenticated
  USING (is_admin() OR is_embaixador_of_turma(presencas.turma_id));

DROP POLICY IF EXISTS "Embaixadores leem atividades da turma" ON public.atividades;
CREATE POLICY "Embaixadores leem atividades da turma" ON public.atividades FOR SELECT TO authenticated
  USING (is_admin() OR is_embaixador_of_turma(atividades.turma_id));

DROP POLICY IF EXISTS "Embaixadores leem envios da turma" ON public.atividade_envios;
CREATE POLICY "Embaixadores leem envios da turma" ON public.atividade_envios FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.atividades a
      WHERE a.id = atividade_envios.atividade_id AND is_embaixador_of_turma(a.turma_id)
    )
  );

DROP POLICY IF EXISTS "Embaixadores leem duvidas da turma" ON public.duvidas;
CREATE POLICY "Embaixadores leem duvidas da turma" ON public.duvidas FOR SELECT TO authenticated
  USING (is_admin() OR is_embaixador_of_turma(duvidas.turma_id));

DROP POLICY IF EXISTS "Embaixadores leem progresso da turma" ON public.progresso;
CREATE POLICY "Embaixadores leem progresso da turma" ON public.progresso FOR SELECT TO authenticated
  USING (is_admin() OR is_embaixador_over_user(progresso.user_id));

NOTIFY pgrst, 'reload schema';
