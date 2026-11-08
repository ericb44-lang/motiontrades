-- Packing photos: each collector uploads a photo of the open box right before sealing it.
-- Private bucket. Only the two collectors in the trade (and admins) can see a trade's photos.
-- Path: <trade id>/<user id>/<uuid>.jpg. Photos can't be changed or deleted (they're evidence).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('packing-photos', 'packing-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Collectors upload packing photos for their own trades" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'packing-photos'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.trades t
      where t.id = (storage.foldername(name))[1]
        and (select auth.uid()) in (t.proposer_id, t.receiver_id)
    )
  );

create policy "Both collectors in a trade see its packing photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'packing-photos'
    and (
      exists (
        select 1 from public.trades t
        where t.id = (storage.foldername(name))[1]
          and (select auth.uid()) in (t.proposer_id, t.receiver_id)
      )
      or (select public.is_admin())
    )
  );

-- The photo the collector chose for this payment (copied into the trade when the label is bought).
alter table public.trade_shipping add column packing_photo text;
