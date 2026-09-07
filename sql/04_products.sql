create table if not exists public.pompkin_products(id text primary key,name text not null,author text,category text,price numeric(10,2) not null default 0,status text,description text,main_image_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.pompkin_products enable row level security;
create policy products_public_read on public.pompkin_products for select using(true);
create policy products_admin_write on public.pompkin_products for all using(public.is_pompkin_admin()) with check(public.is_pompkin_admin());
insert into public.pompkin_products(id,name,author,category,price,status) values('pack','Allynieva Pompkin Pack','allynieva','Pompkin Pack',249,'Sold: 34'),('keychain','Acrylic CD Album Keychain with NFC','allynieva','Keychain',170,'🔥'),('print','SanLias 4R Mini Art Print','allynieva','Prints',70,'🔥'),('sticker','Allynieva Sticker Sheet','allynieva','Stickers',70,'Sold: 5') on conflict(id) do nothing;
