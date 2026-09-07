-- POMPKIN ADMIN + PRODUCT CATALOG SETUP
-- Run this once in Supabase SQL Editor.
--
-- After running this file, add YOUR Pompkin account as admin:
-- 1. Make sure you have already created/logged into your Pompkin account.
-- 2. Run:
--
-- insert into public.admin_users (user_id)
-- select id from auth.users
-- where lower(email) = lower('YOUR-GMAIL-HERE')
-- on conflict do nothing;
--
-- Replace YOUR-GMAIL-HERE with the Gmail/email used by your Pompkin account.
-- Never put your Supabase secret/service key in the website.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_pompkin_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_pompkin_admin() from public;
grant execute on function public.is_pompkin_admin() to authenticated;

drop policy if exists "admins can view admin users" on public.admin_users;
create policy "admins can view admin users"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  author text not null default '',
  category text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  weight_grams numeric(12,2) not null default 0 check (weight_grams >= 0),
  stock integer not null default 0 check (stock >= 0),
  sold_count integer not null default 0 check (sold_count >= 0),
  status text not null default 'available'
    check (status in ('available', 'sold_out', 'hidden')),
  image_url text,
  description text not null default '',
  keywords text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "public can view visible products" on public.products;
create policy "public can view visible products"
on public.products for select
to anon, authenticated
using (status <> 'hidden' or public.is_pompkin_admin());

drop policy if exists "admins can insert products" on public.products;
create policy "admins can insert products"
on public.products for insert
to authenticated
with check (public.is_pompkin_admin());

drop policy if exists "admins can update products" on public.products;
create policy "admins can update products"
on public.products for update
to authenticated
using (public.is_pompkin_admin())
with check (public.is_pompkin_admin());

drop policy if exists "admins can delete products" on public.products;
create policy "admins can delete products"
on public.products for delete
to authenticated
using (public.is_pompkin_admin());

create or replace function public.set_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
before update on public.products
for each row execute procedure public.set_products_updated_at();

-- Product images: public read, admin-only upload/update/delete.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public can view product images" on storage.objects;
create policy "public can view product images"
on storage.objects for select
to public
using (bucket_id = 'product-images');

drop policy if exists "admins can upload product images" on storage.objects;
create policy "admins can upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_pompkin_admin());

drop policy if exists "admins can update product images" on storage.objects;
create policy "admins can update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_pompkin_admin())
with check (bucket_id = 'product-images' and public.is_pompkin_admin());

drop policy if exists "admins can delete product images" on storage.objects;
create policy "admins can delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_pompkin_admin());

-- Customer reviews.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text not null default '',
  photo_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (product_id, user_id)
);

alter table public.reviews enable row level security;

drop policy if exists "customers can view approved reviews" on public.reviews;
create policy "customers can view approved reviews"
on public.reviews for select
to anon, authenticated
using (status = 'approved' or user_id = auth.uid() or public.is_pompkin_admin());

drop policy if exists "customers can create own reviews" on public.reviews;
create policy "customers can create own reviews"
on public.reviews for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "customers can update own pending reviews" on public.reviews;
create policy "customers can update own pending reviews"
on public.reviews for update
to authenticated
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "admins can moderate reviews" on public.reviews;
create policy "admins can moderate reviews"
on public.reviews for update
to authenticated
using (public.is_pompkin_admin())
with check (public.is_pompkin_admin());

drop policy if exists "admins can delete reviews" on public.reviews;
create policy "admins can delete reviews"
on public.reviews for delete
to authenticated
using (public.is_pompkin_admin());

-- Review photos.
insert into storage.buckets (id, name, public)
values ('review-photos', 'review-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public can view review photos" on storage.objects;
create policy "public can view review photos"
on storage.objects for select
to public
using (bucket_id = 'review-photos');

drop policy if exists "signed in users can upload review photos" on storage.objects;
create policy "signed in users can upload review photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can update own review photos" on storage.objects;
create policy "users can update own review photos"
on storage.objects for update
to authenticated
using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete own review photos" on storage.objects;
create policy "users can delete own review photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- POMPKIN VOUCHERS
-- Only admins can create/edit/delete vouchers.
create table if not exists public.pompkin_vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(10,2) not null check (discount_value >= 0),
  minimum_subtotal numeric(10,2) not null default 0,
  usage_limit integer,
  times_used integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.pompkin_vouchers enable row level security;

create or replace function public.validate_pompkin_voucher(
  p_code text,
  p_subtotal numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.pompkin_vouchers;
  v_discount numeric := 0;
begin
  select * into v
  from public.pompkin_vouchers
  where upper(code) = upper(trim(p_code))
    and active = true
    and (starts_at is null or now() >= starts_at)
    and (expires_at is null or now() <= expires_at)
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'That voucher is not valid.');
  end if;

  if v.usage_limit is not null and v.times_used >= v.usage_limit then
    return jsonb_build_object('valid', false, 'message', 'That voucher has already reached its usage limit.');
  end if;

  if p_subtotal < v.minimum_subtotal then
    return jsonb_build_object(
      'valid', false,
      'message', 'This voucher needs a minimum order of ₱' || to_char(v.minimum_subtotal, 'FM999999990.00') || '.'
    );
  end if;

  if v.discount_type = 'percent' then
    v_discount := round(p_subtotal * (v.discount_value / 100), 2);
  else
    v_discount := v.discount_value;
  end if;

  v_discount := least(v_discount, p_subtotal);

  return jsonb_build_object(
    'valid', true,
    'message', 'Voucher applied.',
    'voucher_id', v.id,
    'code', v.code,
    'discount_amount', v_discount
  );
end;
$$;

revoke all on function public.validate_pompkin_voucher(text, numeric) from public;
grant execute on function public.validate_pompkin_voucher(text, numeric) to authenticated;
