-- Data em que a turma efetivamente começou (distinta de created_at, que é
-- só o momento em que o registro foi criado no sistema).
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS data_inicio date;

NOTIFY pgrst, 'reload schema';
