-- Professores/monitores precisam ver quais alunos estão matriculados em
-- suas turmas (para corrigir atividades, ver respostas, etc). A policy
-- original só permitia ao usuário ler sua própria linha em user_turmas.
DROP POLICY IF EXISTS "Professors read user_turmas of their turma" ON public.user_turmas;
CREATE POLICY "Professors read user_turmas of their turma" ON public.user_turmas FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id));

-- Dúvidas por aula: aluno abre uma dúvida a partir de qualquer aula;
-- professor/monitor da turma respondem e marcam como resolvida.
CREATE TABLE IF NOT EXISTS public.duvidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  anexo_url text,
  anexo_nome text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'resolvida')),
  resposta text,
  professor_id uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.duvidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read duvidas" ON public.duvidas;
CREATE POLICY "Read duvidas" ON public.duvidas FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id) OR aluno_id = auth.uid());

DROP POLICY IF EXISTS "Students insert duvidas" ON public.duvidas;
CREATE POLICY "Students insert duvidas" ON public.duvidas FOR INSERT TO authenticated
  WITH CHECK (
    aluno_id = auth.uid()
    AND (is_admin() OR is_professor_of_turma(turma_id) OR has_access_to_turma_curso(turma_id, curso_id))
  );

DROP POLICY IF EXISTS "Professors and admins answer duvidas" ON public.duvidas;
CREATE POLICY "Professors and admins answer duvidas" ON public.duvidas FOR UPDATE TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id))
  WITH CHECK (is_admin() OR is_professor_of_turma(turma_id));

-- Bucket de storage para anexos das dúvidas
INSERT INTO storage.buckets (id, name, public)
VALUES ('duvidas', 'duvidas', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users upload duvidas files" ON storage.objects;
CREATE POLICY "Authenticated users upload duvidas files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'duvidas');

DROP POLICY IF EXISTS "Owners delete duvidas files" ON storage.objects;
CREATE POLICY "Owners delete duvidas files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'duvidas' AND owner = auth.uid());

DROP POLICY IF EXISTS "Public read duvidas files" ON storage.objects;
CREATE POLICY "Public read duvidas files" ON storage.objects FOR SELECT
  USING (bucket_id = 'duvidas');

NOTIFY pgrst, 'reload schema';
