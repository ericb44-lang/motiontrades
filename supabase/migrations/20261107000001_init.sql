-- MOTIONTRADES initial schema.
--
-- Who can do what:
--   * Profiles, listings, reviews: anyone can read (public marketplace).
--   * Profiles: a signed-in user edits only their own (never stats or admin flag).
--   * Listings: owners create/edit/pause/delete their own, only while not in a trade.
--   * Trades and reports: only the two collectors involved (and admins) can read.
--     All trade/report/review WRITES go through the `trade-action` edge function,
--     which runs the same tested rules as src/lib/marketplace/trade-logic.ts.
--   * Email lives only in auth.users (private), never in a public table.

-- ------------------------------------------------------------------
-- Profiles
-- ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 2 and 40),
  region text not null default '' check (char_length(region) <= 40),
  bio text not null default '' check (char_length(bio) <= 280),
  favorite_lines text[] not null default '{}' check (cardinality(favorite_lines) <= 6),
  avatar_hue integer not null default 7 check (avatar_hue between 0 and 359),
  completed_trades integer not null default 0,
  disputes integer not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are public" on public.profiles
  for select to anon, authenticated using (true);

create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Column-level grants: users may change only these fields on their own row.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, region, bio, favorite_lines) on public.profiles to authenticated;

-- Admin check used by policies and the edge function.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

-- Create the profile from sign-up metadata when an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname text := lower(trim(coalesce(meta ->> 'username', '')));
  lines text[];
begin
  select coalesce(array_agg(left(trim(x), 40)), '{}')
    into lines
    from (select jsonb_array_elements_text(coalesce(meta -> 'favorite_lines', '[]'::jsonb)) as x limit 6) s
    where trim(x) <> '';

  insert into public.profiles (id, username, display_name, region, bio, favorite_lines, avatar_hue)
  values (
    new.id,
    uname,
    left(trim(coalesce(meta ->> 'display_name', uname)), 40),
    left(trim(coalesce(meta ->> 'region', '')), 40),
    left(trim(coalesce(meta ->> 'bio', '')), 280),
    lines,
    abs(hashtext(uname)) % 360
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up form check a username before creating the account.
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(trim(name)) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where p.username = lower(trim(name)));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- ------------------------------------------------------------------
-- Listings
-- ------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  line text not null check (char_length(line) between 1 and 50),
  brand text not null check (char_length(brand) between 1 and 50),
  year integer not null check (year between 1960 and 2035),
  scale text not null check (scale in ('4"', '6"', '7"', '1/12', '1/6')),
  category text not null check (category in ('Sci-Fi', 'Fantasy', 'Mecha', 'Adventure', 'Cyberpunk', 'Space')),
  condition text not null check (condition in ('Mint in Box', 'Near Mint', 'Excellent', 'Good', 'Fair')),
  condition_notes text not null default '' check (char_length(condition_notes) <= 600),
  description text not null check (char_length(description) between 20 and 2000),
  accessories text[] not null default '{}' check (cardinality(accessories) <= 30),
  looking_for text[] not null default '{}' check (cardinality(looking_for) <= 20),
  -- Storage paths in the listing-photos bucket, first one is the cover.
  images text[] not null check (cardinality(images) between 1 and 10),
  status text not null default 'active' check (status in ('active', 'paused', 'in_trade', 'traded')),
  views integer not null default 0,
  created_at timestamptz not null default now()
);

create index listings_owner_idx on public.listings (owner_id);
create index listings_status_created_idx on public.listings (status, created_at desc);

-- Every photo path must sit in the owner's own folder: "<owner uuid>/<file>".
create or replace function public.listing_images_owned(owner uuid, imgs text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(split_part(i, '/', 1) = owner::text and i !~ '\.\.'), false)
  from unnest(imgs) as i;
$$;

alter table public.listings
  add constraint listings_images_owned check (public.listing_images_owned(owner_id, images));

alter table public.listings enable row level security;

create policy "Visible listings are public" on public.listings
  for select to anon, authenticated
  using (status <> 'paused' or owner_id = (select auth.uid()));

create policy "Owners create listings" on public.listings
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'active');

create policy "Owners edit listings that are not in a trade" on public.listings
  for update to authenticated
  using (owner_id = (select auth.uid()) and status in ('active', 'paused'))
  with check (owner_id = (select auth.uid()) and status in ('active', 'paused'));

create policy "Owners delete listings that are not in a trade" on public.listings
  for delete to authenticated
  using (owner_id = (select auth.uid()) and status in ('active', 'paused'));

revoke insert, update, delete on public.listings from anon, authenticated;
grant insert (title, line, brand, year, scale, category, condition, condition_notes, description,
              accessories, looking_for, images) on public.listings to authenticated;
grant update (title, line, brand, year, scale, category, condition, condition_notes, description,
              accessories, looking_for, images, status) on public.listings to authenticated;
grant delete on public.listings to authenticated;

-- View counter without giving anyone write access to `views`.
create or replace function public.increment_listing_views(listing uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.listings set views = views + 1
  where id = listing and status <> 'paused' and owner_id is distinct from (select auth.uid());
$$;

grant execute on function public.increment_listing_views(uuid) to anon, authenticated;

-- ------------------------------------------------------------------
-- Trades (whole trade document in `doc`, written only by the edge function)
-- ------------------------------------------------------------------
create table public.trades (
  id text primary key,
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  doc jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposer_id <> receiver_id)
);

create index trades_proposer_idx on public.trades (proposer_id);
create index trades_receiver_idx on public.trades (receiver_id);

alter table public.trades enable row level security;

create policy "Collectors see their own trades" on public.trades
  for select to authenticated
  using ((select auth.uid()) in (proposer_id, receiver_id) or (select public.is_admin()));

revoke insert, update, delete on public.trades from anon, authenticated;

-- ------------------------------------------------------------------
-- Reviews
-- ------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  collector_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  trade_id text references public.trades (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (author_id, trade_id),
  check (collector_id <> author_id)
);

create index reviews_collector_idx on public.reviews (collector_id);

alter table public.reviews enable row level security;

create policy "Reviews are public" on public.reviews
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.reviews from anon, authenticated;

-- ------------------------------------------------------------------
-- Reports
-- ------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('trade', 'listing', 'collector')),
  target_id text not null,
  category text not null check (category in ('not_as_described', 'missing_accessories', 'damaged_in_transit',
                                             'not_shipped', 'counterfeit', 'communication', 'other')),
  description text not null check (char_length(description) between 10 and 2000),
  desired_resolution text not null default '' check (char_length(desired_resolution) <= 500),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved')),
  updates jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index reports_reporter_idx on public.reports (reporter_id);
create index reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

-- Reporter, the other collector on a reported trade, and admins can see a report.
create policy "Involved collectors see reports" on public.reports
  for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select public.is_admin())
    or (
      target_type = 'trade'
      and exists (
        select 1 from public.trades t
        where t.id = reports.target_id and (select auth.uid()) in (t.proposer_id, t.receiver_id)
      )
    )
  );

revoke insert, update, delete on public.reports from anon, authenticated;

-- ------------------------------------------------------------------
-- Live updates for trades and listings (respects the policies above)
-- ------------------------------------------------------------------
alter publication supabase_realtime add table public.trades, public.listings, public.reports;

-- ------------------------------------------------------------------
-- Photo storage: public read, users write only inside their own folder
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Users upload photos to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users manage their own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete their own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
