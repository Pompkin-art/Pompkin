-- Pompkin account/profile upgrade
-- Run this in Supabase > SQL Editor AFTER the existing username setup.
-- It adds bio, avatar, mobile/address fields, username cooldown, and avatar storage.

alter table public.profiles
  alter column username drop not null;

alter table public.profiles
  add column if not exists bio text not null default '',
  add column if not exists avatar_url text,
  add column if not exists mobile_phone text,
  add column if not exists mobile_verified boolean not null default false,
  add column if not exists address_line1 text not null default '',
  add column if not exists address_line2 text not null default '',
  add column if not exists barangay text not null default '',
  add column if not exists city text not null default '',
  add column if not exists province text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists country text not null default 'Philippines',
  add column if not exists username_changed_at timestamptz;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

-- Secure username change with a real 30-day database-side cooldown.
create or replace function public.change_pompkin_username(p_new_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  clean_username text;
  next_change timestamptz;
begin
  clean_username := trim(p_new_username);

  if clean_username !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Username must be 3–24 letters, numbers, or underscores.';
  end if;

  select * into current_profile
  from public.profiles
  where id = auth.uid()
  for update;

  if current_profile.id is null then
    insert into public.profiles (id, username, email)
    values (auth.uid(), clean_username, (select email from auth.users where id = auth.uid()));
    return jsonb_build_object('ok', true, 'username', clean_username, 'next_change_at', now() + interval '30 days');
  end if;

  if current_profile.username = clean_username then
    return jsonb_build_object('ok', true, 'username', clean_username, 'next_change_at', current_profile.username_changed_at + interval '30 days');
  end if;

  if current_profile.username_changed_at is not null
     and current_profile.username_changed_at > now() - interval '30 days' then
    next_change := current_profile.username_changed_at + interval '30 days';
    raise exception 'You can change your username again on %.', to_char(next_change at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = lower(clean_username)
      and id <> auth.uid()
  ) then
    raise exception 'That username is already taken.';
  end if;

  update public.profiles
  set username = clean_username,
      username_changed_at = now()
  where id = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'username', clean_username,
    'next_change_at', now() + interval '30 days'
  );
end;
$$;

revoke all on function public.change_pompkin_username(text) from public;
grant execute on function public.change_pompkin_username(text) to authenticated;

-- Avatar storage bucket.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Pompkin users can upload their own avatar" on storage.objects;
create policy "Pompkin users can upload their own avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Pompkin users can update their own avatar" on storage.objects;
create policy "Pompkin users can update their own avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Pompkin users can delete their own avatar" on storage.objects;
create policy "Pompkin users can delete their own avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Anyone can view Pompkin avatars" on storage.objects;
create policy "Anyone can view Pompkin avatars"
on storage.objects for select to public
using (bucket_id = 'avatars');

-- Keep profile data synced when a new account is created.
create or replace function public.handle_new_pompkin_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, email, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_pompkin on auth.users;
create trigger on_auth_user_created_pompkin
after insert on auth.users
for each row execute procedure public.handle_new_pompkin_user();

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


-- Prevent usernames that differ only by capitalization.
create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username))
where username is not null;
