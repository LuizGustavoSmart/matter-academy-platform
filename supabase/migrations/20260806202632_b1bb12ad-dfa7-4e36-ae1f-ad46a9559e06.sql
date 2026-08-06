ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS link_ao_vivo text;

CREATE TABLE IF NOT EXISTS public.aula_horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  data_hora timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turma_id, aula_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aula_horarios TO authenticated;
GRANT ALL ON public.aula_horarios TO service_role;

ALTER TABLE public.aula_horarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage aula_horarios" ON public.aula_horarios;
CREATE POLICY "Admins manage aula_horarios" ON public.aula_horarios FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Read aula_horarios for enrolled" ON public.aula_horarios;
CREATE POLICY "Read aula_horarios for enrolled" ON public.aula_horarios FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id) OR has_access_to_turma_curso(turma_id, curso_id));

NOTIFY pgrst, 'reload schema';