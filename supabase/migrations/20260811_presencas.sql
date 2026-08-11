-- Presença/chamada nas aulas.
--
-- Uma linha por (aula, aluno, turma). A mesma aula pode ser dada em turmas
-- diferentes, então a turma faz parte da identidade do registro.
--
-- `origem` guarda COMO a presença foi capturada e nunca é sobrescrita por uma
-- edição manual: o professor só altera `presente`, mantendo o rastro de como o
-- registro nasceu. Quando não existe registro algum, a marcação manual cria a
-- linha com origem 'manual_professor'.

-- ─────────────── Tempo assistido no progresso ───────────────
-- Pré-requisito da marcação automática: hoje `progresso` só guarda o booleano
-- `concluido`, sem quanto do vídeo foi efetivamente assistido.
ALTER TABLE public.progresso ADD COLUMN IF NOT EXISTS segundos_assistidos integer NOT NULL DEFAULT 0;
ALTER TABLE public.progresso ADD COLUMN IF NOT EXISTS percentual_assistido numeric(5,2) NOT NULL DEFAULT 0;

-- ─────────────── Funções auxiliares ───────────────
-- Curso da aula, sem passar pela RLS de `aulas` (usada dentro de policies).
CREATE OR REPLACE FUNCTION public.aula_curso_id(a_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT curso_id FROM aulas WHERE id = a_id;
$$;

-- Quem pode lançar/editar presença de uma aula numa turma: admin, o professor
-- responsável pelo curso naquela turma (curso_turmas.professor_id) e o
-- professor/monitor vinculado à turma (mesmo critério das demais telas).
CREATE OR REPLACE FUNCTION public.can_manage_presenca(t_id uuid, a_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT is_admin()
      OR is_professor_of_turma(t_id)
      OR EXISTS (
        SELECT 1 FROM aulas a
        JOIN curso_turmas ct ON ct.curso_id = a.curso_id AND ct.turma_id = t_id
        WHERE a.id = a_id AND ct.professor_id = auth.uid()
      );
$$;

-- ─────────────── Tabela ───────────────
CREATE TABLE IF NOT EXISTS public.presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  origem text NOT NULL CHECK (origem IN ('plataforma_ao_vivo', 'plataforma_gravado', 'teams_importado', 'manual_professor')),
  percentual_assistido numeric(5,2),
  presente boolean NOT NULL DEFAULT false,
  editado_por uuid REFERENCES public.profiles(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aula_id, user_id, turma_id)
);

CREATE INDEX IF NOT EXISTS idx_presencas_turma_aula ON public.presencas (turma_id, aula_id);
CREATE INDEX IF NOT EXISTS idx_presencas_user ON public.presencas (user_id);

ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

-- ─────────────── RLS ───────────────
DROP POLICY IF EXISTS "Read presencas" ON public.presencas;
CREATE POLICY "Read presencas" ON public.presencas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR can_manage_presenca(turma_id, aula_id));

DROP POLICY IF EXISTS "Staff insert presencas" ON public.presencas;
CREATE POLICY "Staff insert presencas" ON public.presencas FOR INSERT TO authenticated
  WITH CHECK (can_manage_presenca(turma_id, aula_id));

DROP POLICY IF EXISTS "Staff update presencas" ON public.presencas;
CREATE POLICY "Staff update presencas" ON public.presencas FOR UPDATE TO authenticated
  USING (can_manage_presenca(turma_id, aula_id))
  WITH CHECK (can_manage_presenca(turma_id, aula_id));

DROP POLICY IF EXISTS "Staff delete presencas" ON public.presencas;
CREATE POLICY "Staff delete presencas" ON public.presencas FOR DELETE TO authenticated
  USING (can_manage_presenca(turma_id, aula_id));

-- O aluno só consegue registrar a PRÓPRIA presença automática (assistiu >80%),
-- nunca marcar ausência nem forjar origem de Teams/professor. Uma linha já
-- tocada manualmente (`editado_por` preenchido) fica travada para ele, para
-- que a auto-marcação não desfaça a decisão do professor.
DROP POLICY IF EXISTS "Students self insert presencas" ON public.presencas;
CREATE POLICY "Students self insert presencas" ON public.presencas FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND presente = true
    AND editado_por IS NULL
    AND origem IN ('plataforma_ao_vivo', 'plataforma_gravado')
    AND has_access_to_turma_curso(turma_id, aula_curso_id(aula_id))
  );

-- O USING também exige que a linha ATUAL seja de origem automática: presença
-- vinda do Teams ou lançada pelo professor não é sobrescrita pelo player.
DROP POLICY IF EXISTS "Students self update presencas" ON public.presencas;
CREATE POLICY "Students self update presencas" ON public.presencas FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND editado_por IS NULL
    AND origem IN ('plataforma_ao_vivo', 'plataforma_gravado')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND presente = true
    AND editado_por IS NULL
    AND origem IN ('plataforma_ao_vivo', 'plataforma_gravado')
    AND has_access_to_turma_curso(turma_id, aula_curso_id(aula_id))
  );

NOTIFY pgrst, 'reload schema';
