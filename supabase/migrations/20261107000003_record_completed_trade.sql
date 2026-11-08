-- Called only by the trade-action edge function (service role) when a trade completes.
create or replace function public.record_completed_trade(a uuid, b uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles set completed_trades = completed_trades + 1 where id in (a, b);
$$;

revoke execute on function public.record_completed_trade(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_completed_trade(uuid, uuid) to service_role;
