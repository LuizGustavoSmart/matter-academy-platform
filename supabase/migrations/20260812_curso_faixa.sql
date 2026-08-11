-- Classificação fixa do curso (Faixa Branca/Verde/Marrom/Preta), usada para
-- ordenar os blocos de curso na mesma sequência sempre, substituindo o
-- reordenamento manual (arrastar/mover) que existia por turma.
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS faixa text
  CHECK (faixa IN ('branca', 'verde', 'marrom', 'preta'));

NOTIFY pgrst, 'reload schema';
