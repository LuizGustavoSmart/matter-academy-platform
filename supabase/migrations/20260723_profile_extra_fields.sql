-- Campos adicionais de perfil, preenchidos pelo próprio usuário na
-- ativação da conta (sexo, cargo, data de nascimento).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sexo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_nascimento date;

NOTIFY pgrst, 'reload schema';
