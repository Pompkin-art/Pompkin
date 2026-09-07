create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  bio text default '',
  mobile text,
  avatar_url text,
  username_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.pompkin_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Address',
  recipient_name text not null,
  mobile text,
  full_address text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_primary_address on public.pompkin_addresses(user_id) where is_primary;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,username,full_name,mobile) values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),coalesce(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'mobile') on conflict (id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create or replace function public.enforce_username_change() returns trigger language plpgsql as $$ begin if new.username<>old.username and old.username_changed_at is not null and old.username_changed_at > now()-interval '30 days' then raise exception 'Username can only be changed once every 30 days'; end if; if new.username<>old.username then new.username_changed_at=now(); end if; new.updated_at=now(); return new; end; $$;
drop trigger if exists profiles_username_change on public.profiles;
create trigger profiles_username_change before update on public.profiles for each row execute function public.enforce_username_change();
alter table public.profiles enable row level security; alter table public.pompkin_addresses enable row level security;
drop policy if exists profile_self on public.profiles; create policy profile_self on public.profiles for select using(auth.uid()=id); create policy profile_update on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);
drop policy if exists address_self on public.pompkin_addresses; create policy address_self on public.pompkin_addresses for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
