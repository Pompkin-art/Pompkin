-- Pompkin username-based accounts
-- Run this once in Supabase > SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Customers can read only their own profile.
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- The trigger creates profiles from signup metadata.
create or replace function public.handle_new_pompkin_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Username-based Pompkin accounts provide a username during signup.
  -- Google accounts can be added to profiles later after the customer chooses one.
  if new.raw_user_meta_data ->> 'username' is not null then
    insert into public.profiles (id, username, display_name, email)
    values (
      new.id,
      new.raw_user_meta_data ->> 'username',
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
      new.email
    )
    on conflict (id) do update set
      display_name = excluded.display_name,
      email = excluded.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_pompkin on auth.users;
create trigger on_auth_user_created_pompkin
after insert on auth.users
for each row execute procedure public.handle_new_pompkin_user();

-- Keep the profile email in sync if the customer's auth email changes.
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated_pompkin on auth.users;
create trigger on_auth_user_email_updated_pompkin
after update of email on auth.users
for each row execute procedure public.handle_user_email_update();
