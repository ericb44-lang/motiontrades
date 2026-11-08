-- The sign-up trigger function runs only from the trigger, never via the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- is_admin() is only needed by signed-in users' row policies.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Intentionally public (documented here so the advisor warnings are expected):
--   username_available(text)        sign-up form username check, returns only true/false
--   increment_listing_views(uuid)   bumps a view counter, can't change anything else

create index reviews_trade_idx on public.reviews (trade_id);
