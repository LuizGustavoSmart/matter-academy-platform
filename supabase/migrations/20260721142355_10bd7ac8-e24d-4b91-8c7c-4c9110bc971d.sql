alter table public.profiles
  add column if not exists sobrenome text,
  add column if not exists telefone  text,
  add column if not exists empresa   text;

comment on column public.profiles.sobrenome is 'Sobrenome do usuário (cadastro/importação).';
comment on column public.profiles.telefone  is 'Telefone de contato normalizado (E.164 quando possível).';
comment on column public.profiles.empresa   is 'Empresa/instituição vinculada ao usuário.';