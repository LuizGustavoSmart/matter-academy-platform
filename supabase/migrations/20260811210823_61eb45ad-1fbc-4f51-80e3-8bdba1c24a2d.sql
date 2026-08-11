ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS faixa text CHECK (faixa IN ('branca', 'verde', 'marrom', 'preta'));

NOTIFY pgrst, 'reload schema';