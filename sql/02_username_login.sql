create index if not exists profiles_username_lower_idx on public.profiles(lower(username));
-- Deploy the included Edge Function supabase/functions/login-with-username after running this SQL.
