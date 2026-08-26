-- Aprovação do aluno numa faixa (curso+turma) — decidida manualmente por
-- professor/admin na aba "Aprovações", usando presença/atividades/nota do
-- projeto final como referência. Reversível (toggle aprovar/desaprovar).

CREATE TABLE IF NOT EXISTS public.aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  aprovado boolean NOT NULL DEFAULT true,
  aprovado_por uuid REFERENCES public.profiles(id),
  aprovado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, turma_id, curso_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aprovacoes TO authenticated;
GRANT ALL ON public.aprovacoes TO service_role;

ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read aprovacoes" ON public.aprovacoes;
CREATE POLICY "Read aprovacoes" ON public.aprovacoes FOR SELECT TO authenticated
  USING (
    is_admin()
    OR user_id = auth.uid()
    OR is_professor_of_turma_curso(turma_id, curso_id)
    OR is_embaixador_of_turma(turma_id)
  );

DROP POLICY IF EXISTS "Staff manage aprovacoes" ON public.aprovacoes;
CREATE POLICY "Staff manage aprovacoes" ON public.aprovacoes FOR ALL TO authenticated
  USING (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id))
  WITH CHECK (is_admin() OR is_professor_of_turma_curso(turma_id, curso_id));

NOTIFY pgrst, 'reload schema';