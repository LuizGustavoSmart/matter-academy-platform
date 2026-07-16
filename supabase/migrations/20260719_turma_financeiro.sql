-- Modelo financeiro flexível por turma. Cada turma escolhe um dos tipos:
--   fixo              -> valor único fixo da turma
--   por_aluno         -> valor cobrado por aluno matriculado (total = valor x nº alunos)
--   recorrente_mensal -> valor mensal recorrente da turma
-- Campos ficam nulos até o admin configurar a cobrança da turma.
ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS tipo_cobranca text
    CHECK (tipo_cobranca IN ('fixo', 'por_aluno', 'recorrente_mensal'));

ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS valor numeric;

NOTIFY pgrst, 'reload schema';
