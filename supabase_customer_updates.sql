-- POMPKIN CUSTOMER / ORDER UPDATE
-- Run this once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists barangay text;

create table if not exists public.pompkin_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  address_line1 text not null,
  address_line2 text,
  barangay text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  country text not null default 'Philippines',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.update_pompkin_address_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pompkin_addresses_updated_at on public.pompkin_addresses;
create trigger pompkin_addresses_updated_at
before update on public.pompkin_addresses
for each row execute function public.update_pompkin_address_updated_at();

alter table public.pompkin_addresses enable row level security;

drop policy if exists "Customers can view their own addresses" on public.pompkin_addresses;
drop policy if exists "Customers can create their own addresses" on public.pompkin_addresses;
drop policy if exists "Customers can update their own addresses" on public.pompkin_addresses;
drop policy if exists "Customers can delete their own addresses" on public.pompkin_addresses;

create policy "Customers can view their own addresses"
on public.pompkin_addresses for select to authenticated
using (user_id = auth.uid());

create policy "Customers can create their own addresses"
on public.pompkin_addresses for insert to authenticated
with check (user_id = auth.uid());

create policy "Customers can update their own addresses"
on public.pompkin_addresses for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Customers can delete their own addresses"
on public.pompkin_addresses for delete to authenticated
using (user_id = auth.uid());

create index if not exists pompkin_addresses_user_id_idx
on public.pompkin_addresses(user_id);

create unique index if not exists pompkin_addresses_one_primary_idx
on public.pompkin_addresses(user_id)
where is_primary = true;

-- Preserve any complete legacy profile address as the first saved address.
insert into public.pompkin_addresses (
  user_id, label, address_line1, address_line2, barangay,
  city, province, postal_code, country, is_primary
)
select
  p.id,
  'Home',
  p.address_line1,
  p.address_line2,
  p.barangay,
  p.city,
  p.province,
  p.postal_code,
  coalesce(nullif(p.country, ''), 'Philippines'),
  true
from public.profiles p
where coalesce(p.address_line1, '') <> ''
  and coalesce(p.barangay, '') <> ''
  and coalesce(p.city, '') <> ''
  and coalesce(p.province, '') <> ''
  and coalesce(p.postal_code, '') <> ''
  and not exists (
    select 1 from public.pompkin_addresses a where a.user_id = p.id
  );

alter table public.pompkin_orders
  add column if not exists barangay text,
  add column if not exists jnt_tracking_number text,
  add column if not exists jnt_tracking_url text,
  add column if not exists shipping_notified_at timestamptz;

create index if not exists pompkin_orders_tracking_idx
on public.pompkin_orders(jnt_tracking_number);
