-- Shipping labels and payments, one row per collector per trade.
--
-- Privacy: a collector can read ONLY their own row. Their address is never readable by the
-- other collector through the API; it only appears printed on the labels for that trade.
-- All writes go through the edge functions (trade-action, stripe-webhook).

create table public.trade_shipping (
  trade_id text not null references public.trades (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  address jsonb,
  parcel jsonb,
  shippo_shipment_id text,
  rates jsonb not null default '[]',
  selected_rate_id text,
  checklist text[] not null default '{}',
  stripe_session_id text unique,
  payment_status text not null default 'none'
    check (payment_status in ('none', 'pending', 'paid', 'refunded', 'failed')),
  amount_total_cents integer,
  label_cents integer,
  shippo_transaction_id text,
  label_url text,
  tracking_number text,
  carrier text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trade_id, user_id)
);

create index trade_shipping_user_idx on public.trade_shipping (user_id);

alter table public.trade_shipping enable row level security;

create policy "Collectors see only their own shipping record" on public.trade_shipping
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.trade_shipping from anon, authenticated;
revoke select on public.trade_shipping from anon;

-- Live updates so the page notices when a label is ready (respects the policy above).
alter publication supabase_realtime add table public.trade_shipping;
