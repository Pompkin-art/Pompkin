create table if not exists public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
alter table public.admin_users enable row level security;
create or replace function public.is_pompkin_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_users where user_id=auth.uid()); $$;
create policy admin_self on public.admin_users for select using(auth.uid()=user_id);
