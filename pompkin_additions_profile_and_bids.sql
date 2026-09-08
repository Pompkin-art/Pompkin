-- Pompkin additions: profile repair + bidding. Safe after the clean rebuild.
create or replace function public.handle_new_pompkin_user() returns trigger language plpgsql security definer set search_path=public as $$
declare b text; u text; begin b:=left(coalesce(nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'username',''),'[^A-Za-z0-9_]','','g'),''),nullif(regexp_replace(split_part(coalesce(new.email,''),'@',1),'[^A-Za-z0-9_]','','g'),''),'pompkin_user'),24); if length(b)<3 then b:='pompkin_user'; end if; u:=b; if exists(select 1 from public.profiles where username=u) then u:=left(b,18)||'_'||substr(replace(gen_random_uuid()::text,'-',''),1,5); end if; insert into public.profiles(id,username,full_name,email,bio,mobile) values(new.id,u,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',split_part(coalesce(new.email,''),'@',1),'Pompkin customer'),new.email,'','') on conflict(id) do nothing; return new; end; $$;
do $$ begin if not exists(select 1 from pg_trigger where tgname='on_auth_user_created_pompkin_profile') then create trigger on_auth_user_created_pompkin_profile after insert on auth.users for each row execute function public.handle_new_pompkin_user(); end if; end $$;
do $$ declare x record; b text; u text; begin for x in select au.* from auth.users au left join public.profiles p on p.id=au.id where p.id is null loop b:=left(coalesce(nullif(regexp_replace(coalesce(x.raw_user_meta_data->>'username',''),'[^A-Za-z0-9_]','','g'),''),nullif(regexp_replace(split_part(coalesce(x.email,''),'@',1),'[^A-Za-z0-9_]','','g'),''),'pompkin_user'),24);if length(b)<3 then b:='pompkin_user';end if;u=b;if exists(select 1 from public.profiles where username=u) then u:=left(b,18)||'_'||substr(replace(gen_random_uuid()::text,'-',''),1,5);end if;insert into public.profiles(id,username,full_name,email,bio,mobile) values(x.id,u,coalesce(x.raw_user_meta_data->>'full_name',x.raw_user_meta_data->>'name',split_part(coalesce(x.email,''),'@',1),'Pompkin customer'),x.email,'','') on conflict(id) do nothing;end loop;end $$;
create table if not exists public.pompkin_auctions(id uuid primary key default gen_random_uuid(),title text not null,description text,image_url text,starting_bid numeric(12,2) not null default 0,current_bid numeric(12,2) not null default 0,minimum_increment numeric(12,2) not null default 10,starts_at timestamptz not null default now(),ends_at timestamptz not null,status text not null default 'draft',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),constraint pompkin_auctions_status_check check(status in('draft','active','ended','cancelled')),constraint pompkin_auctions_increment_check check(minimum_increment>0),constraint pompkin_auctions_dates_check check(ends_at>starts_at));
create table if not exists public.pompkin_bids(id uuid primary key default gen_random_uuid(),auction_id uuid not null references public.pompkin_auctions(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,amount numeric(12,2) not null check(amount>0),created_at timestamptz not null default now());
alter table public.pompkin_auctions enable row level security;alter table public.pompkin_bids enable row level security;
drop policy if exists "Anyone can view active auctions" on public.pompkin_auctions;drop policy if exists "Admins can manage auctions" on public.pompkin_auctions;create policy "Anyone can view active auctions" on public.pompkin_auctions for select using(status='active' and starts_at<=now() and ends_at>now());create policy "Admins can manage auctions" on public.pompkin_auctions for all using(public.is_pompkin_admin()) with check(public.is_pompkin_admin());drop policy if exists "Users can view bids" on public.pompkin_bids;drop policy if exists "Users can insert bids" on public.pompkin_bids;
create or replace function public.place_pompkin_bid(p_auction_id uuid,p_amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$ declare a public.pompkin_auctions%rowtype;m numeric(12,2);bid_id uuid;begin if auth.uid() is null then raise exception 'Please log in before placing a bid.';end if;if p_amount is null or p_amount<=0 then raise exception 'Enter a valid bid amount.';end if;select * into a from public.pompkin_auctions where id=p_auction_id for update;if not found then raise exception 'This auction could not be found.';end if;if a.status<>'active' or a.starts_at>now() or a.ends_at<=now() then raise exception 'This auction is not currently open.';end if;m:=case when a.current_bid>0 then a.current_bid+a.minimum_increment else a.starting_bid end;if p_amount<m then raise exception 'Your bid must be at least ₱%.',to_char(m,'FM999999990.00');end if;insert into public.pompkin_bids(auction_id,user_id,amount) values(a.id,auth.uid(),p_amount) returning id into bid_id;update public.pompkin_auctions set current_bid=p_amount,updated_at=now() where id=a.id;return jsonb_build_object('id',bid_id,'amount',p_amount,'auction_id',a.id);end; $$;grant execute on function public.place_pompkin_bid(uuid,numeric) to authenticated;
create index if not exists pompkin_auctions_status_idx on public.pompkin_auctions(status);create index if not exists pompkin_auctions_ends_at_idx on public.pompkin_auctions(ends_at);create index if not exists pompkin_bids_auction_id_idx on public.pompkin_bids(auction_id);

-- Gallery features: likes + comments for active and previous auctions.
create table if not exists public.pompkin_auction_likes (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.pompkin_auctions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (auction_id, user_id)
);

create table if not exists public.pompkin_auction_comments (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.pompkin_auctions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_text text not null,
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pompkin_auction_comments_status_check
    check (status in ('approved','hidden'))
);

alter table public.pompkin_auction_likes enable row level security;
alter table public.pompkin_auction_comments enable row level security;

drop policy if exists "Anyone can view auction likes" on public.pompkin_auction_likes;
create policy "Anyone can view auction likes"
on public.pompkin_auction_likes
for select using (true);

drop policy if exists "Users can manage their own auction likes" on public.pompkin_auction_likes;
create policy "Users can manage their own auction likes"
on public.pompkin_auction_likes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Anyone can view approved auction comments" on public.pompkin_auction_comments;
create policy "Anyone can view approved auction comments"
on public.pompkin_auction_comments
for select using (status = 'approved');

drop policy if exists "Users can add their own auction comments" on public.pompkin_auction_comments;
create policy "Users can add their own auction comments"
on public.pompkin_auction_comments
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can edit their own auction comments" on public.pompkin_auction_comments;
create policy "Users can edit their own auction comments"
on public.pompkin_auction_comments
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Admins can manage auction comments" on public.pompkin_auction_comments;
create policy "Admins can manage auction comments"
on public.pompkin_auction_comments
for all
using (public.is_pompkin_admin())
with check (public.is_pompkin_admin());

-- Keep previous auctions visible as part of the gallery.
drop policy if exists "Anyone can view gallery auctions" on public.pompkin_auctions;
create policy "Anyone can view gallery auctions"
on public.pompkin_auctions
for select
using (
  (status = 'active' and starts_at <= now() and ends_at > now())
  or status = 'ended'
);

create or replace view public.pompkin_auction_comments_public as
select
  c.id,
  c.auction_id,
  c.comment_text,
  c.created_at,
  coalesce(p.username, 'Pompkin user') as username
from public.pompkin_auction_comments c
left join public.profiles p on p.id = c.user_id
where c.status = 'approved';

grant select on public.pompkin_auction_comments_public to anon, authenticated;

create or replace function public.toggle_pompkin_auction_like(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  liked boolean;
  total integer;
begin
  if auth.uid() is null then
    raise exception 'Please log in to like an artwork.';
  end if;

  if exists (
    select 1
    from public.pompkin_auction_likes
    where auction_id = p_auction_id
      and user_id = auth.uid()
  ) then
    delete from public.pompkin_auction_likes
    where auction_id = p_auction_id
      and user_id = auth.uid();
    liked := false;
  else
    insert into public.pompkin_auction_likes(auction_id, user_id)
    values (p_auction_id, auth.uid());
    liked := true;
  end if;

  select count(*)::integer
  into total
  from public.pompkin_auction_likes
  where auction_id = p_auction_id;

  return jsonb_build_object('liked', liked, 'count', total);
end;
$$;

grant execute on function public.toggle_pompkin_auction_like(uuid) to authenticated;

create index if not exists pompkin_auction_likes_auction_id_idx
on public.pompkin_auction_likes(auction_id);

create index if not exists pompkin_auction_comments_auction_id_idx
on public.pompkin_auction_comments(auction_id);

create index if not exists pompkin_auction_comments_created_at_idx
on public.pompkin_auction_comments(created_at desc);
