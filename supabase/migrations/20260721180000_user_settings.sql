-- Preferencias pessoais, perfil ampliado e solicitacoes de privacidade.
-- A migracao e idempotente para facilitar a aplicacao em ambientes existentes.

alter table public.profiles
  add column if not exists cargo text,
  add column if not exists avatar_url text;

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  language text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  theme text not null default 'dark' check (theme in ('light', 'dark', 'hybrid')),
  font_scale text not null default 'default' check (font_scale in ('default', 'large')),
  high_contrast boolean not null default false,
  reduced_motion boolean not null default false,
  focus_emphasis boolean not null default false,
  notification_preferences jsonb not null default '{"email_enabled":true,"sound_enabled":false,"activities":true,"deadlines":true,"answers":true,"announcements":true,"community":true,"administrative":true}'::jsonb,
  privacy_preferences jsonb not null default '{"profile_visible":true,"show_company":true,"show_role":true}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences
  alter column notification_preferences
  set default '{"email_enabled":true,"sound_enabled":false,"activities":true,"deadlines":true,"answers":true,"announcements":true,"community":true,"administrative":true}'::jsonb;

update public.user_preferences
set notification_preferences = '{"email_enabled":true,"sound_enabled":false}'::jsonb || notification_preferences
where not (notification_preferences ? 'email_enabled')
   or not (notification_preferences ? 'sound_enabled');

create or replace view public.profile_directory
with (security_barrier = true)
as
select
  p.id,
  p.nome,
  p.sobrenome,
  case when coalesce((up.privacy_preferences ->> 'show_company')::boolean, true) then p.empresa else null end as empresa,
  case when coalesce((up.privacy_preferences ->> 'show_role')::boolean, true) then p.cargo else null end as cargo,
  p.avatar_url,
  p.role
from public.profiles p
left join public.user_preferences up on up.user_id = p.id
where coalesce((up.privacy_preferences ->> 'profile_visible')::boolean, true);

revoke all on public.profile_directory from public, anon;
grant select on public.profile_directory to authenticated;

alter table public.user_preferences enable row level security;

drop policy if exists "Users read own preferences" on public.user_preferences;
create policy "Users read own preferences"
  on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own preferences" on public.user_preferences;
create policy "Users insert own preferences"
  on public.user_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own preferences" on public.user_preferences;
create policy "Users update own preferences"
  on public.user_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'deletion')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.privacy_requests enable row level security;

drop policy if exists "Users create own privacy requests" on public.privacy_requests;
create policy "Users create own privacy requests"
  on public.privacy_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users read own privacy requests" on public.privacy_requests;
create policy "Users read own privacy requests"
  on public.privacy_requests for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Admins update privacy requests" on public.privacy_requests;
create policy "Admins update privacy requests"
  on public.privacy_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read avatars" on storage.objects;
create policy "Users read avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
