ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'student', 'professor', 'monitor', 'embaixador'));

ALTER TABLE public.user_turmas ADD COLUMN IF NOT EXISTS is_embaixador boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Embaixadores leem user_turmas da turma" ON public.user_turmas;
CREATE POLICY "Embaixadores leem user_turmas da turma" ON public.user_turmas FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_turmas ut2
      WHERE ut2.turma_id = user_turmas.turma_id AND ut2.user_id = auth.uid() AND ut2.is_embaixador
    )
  );

DROP POLICY IF EXISTS "Embaixadores leem profiles de alunos da turma" ON public.profiles;
CREATE POLICY "Embaixadores leem profiles de alunos da turma" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_turmas ut_embaixador
      JOIN public.user_turmas ut_aluno ON ut_aluno.turma_id = ut_embaixador.turma_id
      WHERE ut_embaixador.user_id = auth.uid() AND ut_embaixador.is_embaixador
        AND ut_aluno.user_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "Embaixadores leem presencas da turma" ON public.presencas;
CREATE POLICY "Embaixadores leem presencas da turma" ON public.presencas FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_turmas ut
      WHERE ut.turma_id = presencas.turma_id AND ut.user_id = auth.uid() AND ut.is_embaixador
    )
  );

DROP POLICY IF EXISTS "Embaixadores leem atividades da turma" ON public.atividades;
CREATE POLICY "Embaixadores leem atividades da turma" ON public.atividades FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_turmas ut
      WHERE ut.turma_id = atividades.turma_id AND ut.user_id = auth.uid() AND ut.is_embaixador
    )
  );

DROP POLICY IF EXISTS "Embaixadores leem envios da turma" ON public.atividade_envios;
CREATE POLICY "Embaixadores leem envios da turma" ON public.atividade_envios FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.atividades a
      JOIN public.user_turmas ut ON ut.turma_id = a.turma_id
      WHERE a.id = atividade_envios.atividade_id AND ut.user_id = auth.uid() AND ut.is_embaixador
    )
  );

DROP POLICY IF EXISTS "Embaixadores leem duvidas da turma" ON public.duvidas;
CREATE POLICY "Embaixadores leem duvidas da turma" ON public.duvidas FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_turmas ut
      WHERE ut.turma_id = duvidas.turma_id AND ut.user_id = auth.uid() AND ut.is_embaixador
    )
  );

DROP POLICY IF EXISTS "Embaixadores leem progresso da turma" ON public.progresso;
CREATE POLICY "Embaixadores leem progresso da turma" ON public.progresso FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_turmas ut_embaixador
      JOIN public.user_turmas ut_aluno ON ut_aluno.turma_id = ut_embaixador.turma_id
      WHERE ut_embaixador.user_id = auth.uid() AND ut_embaixador.is_embaixador
        AND ut_aluno.user_id = progresso.user_id
    )
  );

NOTIFY pgrst, 'reload schema';