// MOTIONTRADES trade-action edge function.
//
// Also receives Stripe webhooks (see stripe-webhook.ts).
//
// Every trade, review and report write goes through here. It:
//   1. checks who is calling (their login token),
//   2. loads the current trade from the database,
//   3. runs the shared, unit-tested rules (../_shared/trade-actions.ts),
//   4. saves the result only if nobody changed the trade in the meantime.
//
// The files in ../_shared are copied from src/lib/marketplace by `npm run sync:edge`.
// Edit the originals in src/, never the copies.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  ActionError,
  advanceReportState,
  applyTradeStep,
  buildProposal,
  buildReview,
  isTradeStep,
  markCompleteIfDone,
  newTrackingCode,
  newTradeId,
  noteReportOnTrade,
  parseRequest,
  requireSide,
  resolveTradeAfterReport,
  tradeListingIds,
} from "../_shared/trade-actions.ts";
import { PACKING_CHECKLIST, collectorIdFor, otherSide } from "../_shared/trade-logic.ts";
import {
  DEFAULT_ALLOWED_ORIGINS,
  SERVICE_FEE_CENTS,
  isAllowedReturnUrl,
  priceBreakdown,
  type RateOption,
  type ShippingAddress,
} from "../_shared/shipping.ts";
import {
  createCheckout,
  expireCheckout,
  getCheckout,
  getRates,
  validateAddress,
} from "../_shared/providers.ts";
import { handleStripeWebhook } from "./stripe-webhook.ts";
import { rowToListing, rowToReport, type ListingRow, type ReportRow } from "../_shared/rows.ts";
import type { Report, Trade } from "../_shared/types.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const secrets = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = secrets ? JSON.parse(secrets)["default"] : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadTrade(
  db: SupabaseClient,
  id: string,
): Promise<{ trade: Trade; updatedAt: string }> {
  const { data, error } = await db
    .from("trades")
    .select("doc, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ActionError("Trade not found", 404);
  return { trade: data.doc as Trade, updatedAt: data.updated_at as string };
}

async function tradeReports(db: SupabaseClient, tradeId: string): Promise<Report[]> {
  const { data, error } = await db
    .from("reports")
    .select("*")
    .eq("target_type", "trade")
    .eq("target_id", tradeId);
  if (error) throw error;
  return (data as ReportRow[]).map(rowToReport);
}

/** Save only if the row is unchanged since we read it (two people clicking at once). */
async function saveTrade(db: SupabaseClient, trade: Trade, expectedUpdatedAt: string) {
  const { data, error } = await db
    .from("trades")
    .update({ doc: trade, status: trade.status, updated_at: trade.updatedAt })
    .eq("id", trade.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new ActionError("This trade just changed. Refresh and try again.", 409);
}

async function setListingStatus(db: SupabaseClient, ids: string[], status: string) {
  if (!ids.length) return;
  const { error } = await db.from("listings").update({ status }).in("id", ids);
  if (error) throw error;
}

interface ShippingRow {
  trade_id: string;
  user_id: string;
  address: ShippingAddress | null;
  rates: RateOption[];
  payment_status: "none" | "pending" | "paid" | "refunded" | "failed";
  stripe_session_id: string | null;
}

async function shippingRows(db: SupabaseClient, tradeId: string): Promise<ShippingRow[]> {
  const { data, error } = await db
    .from("trade_shipping")
    .select("trade_id, user_id, address, rates, payment_status, stripe_session_id")
    .eq("trade_id", tradeId);
  if (error) throw error;
  return data as ShippingRow[];
}

async function upsertShipping(
  db: SupabaseClient,
  tradeId: string,
  userId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await db
    .from("trade_shipping")
    .upsert({ trade_id: tradeId, user_id: userId, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function displayName(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return (data?.display_name as string | undefined) ?? "The other collector";
}

const allowedOrigins = () => [
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

/** After any change: if the trade just finished, close it out. */
async function finishIfComplete(
  db: SupabaseClient,
  trade: Trade,
  savedUpdatedAt: string,
  at: string,
) {
  const done = markCompleteIfDone(trade, await tradeReports(db, trade.id), at);
  if (!done) return;
  await saveTrade(db, done, savedUpdatedAt);
  await setListingStatus(db, tradeListingIds(done), "traded");
  const { error } = await db.rpc("record_completed_trade", {
    a: done.proposerId,
    b: done.receiverId,
  });
  if (error) throw error;
}

async function handle(req: Request): Promise<Response> {
  const db = adminClient();

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const me = auth.user?.id;
  const myEmail = auth.user?.email ?? undefined;
  if (!me) throw new ActionError("Log in to do that", 403);

  const body = parseRequest(await req.json().catch(() => null));
  const at = new Date().toISOString();

  if (isTradeStep(body)) {
    const { trade, updatedAt } = await loadTrade(db, body.tradeId);
    const next = applyTradeStep(trade, me, body, at, newTrackingCode());

    if (body.action === "accept") {
      // Both sides' figures must still be available when the offer is accepted.
      const ids = tradeListingIds(trade);
      const { data, error } = await db.from("listings").select("id, status").in("id", ids);
      if (error) throw error;
      const unavailable = ids.filter((id) => data.find((l) => l.id === id)?.status !== "active");
      if (unavailable.length)
        throw new ActionError("One of these figures isn't available anymore", 409);
    }

    await saveTrade(db, next, updatedAt);
    if (body.action === "accept") await setListingStatus(db, tradeListingIds(next), "in_trade");
    if (body.action === "inspect") await finishIfComplete(db, next, next.updatedAt, at);
    return json({ ok: true, tradeId: next.id });
  }

  switch (body.action) {
    case "propose": {
      const ids = [...body.offeredListingIds, ...body.requestedListingIds];
      const { data, error } = await db.from("listings").select("*").in("id", ids);
      if (error) throw error;
      const listings = (data as ListingRow[]).map(rowToListing);
      const trade = buildProposal({
        id: newTradeId(),
        proposerId: me,
        receiverId: body.receiverId,
        offered: listings,
        requested: listings,
        offeredIds: body.offeredListingIds,
        requestedIds: body.requestedListingIds,
        message: body.message,
        at,
      });
      const { error: insertError } = await db.from("trades").insert({
        id: trade.id,
        proposer_id: trade.proposerId,
        receiver_id: trade.receiverId,
        status: trade.status,
        doc: trade,
        created_at: at,
        updated_at: at,
      });
      if (insertError) throw insertError;
      return json({ ok: true, tradeId: trade.id });
    }

    case "review": {
      const { trade, updatedAt } = await loadTrade(db, body.tradeId);
      const { review, trade: next } = buildReview(
        trade,
        me,
        await tradeReports(db, trade.id),
        body.rating,
        body.comment,
        at,
      );
      const { error } = await db.from("reviews").insert({
        collector_id: review.collectorId,
        author_id: review.authorId,
        trade_id: review.tradeId,
        rating: review.rating,
        comment: review.comment,
        created_at: at,
      });
      if (error) throw error;
      await saveTrade(db, next, updatedAt);
      return json({ ok: true });
    }

    case "report": {
      let tradeToNote: { trade: Trade; updatedAt: string } | null = null;
      if (body.targetType === "trade") {
        tradeToNote = await loadTrade(db, body.targetId);
        noteReportOnTrade(tradeToNote.trade, me, body.category, at); // throws if not part of the trade
      }
      const { data, error } = await db
        .from("reports")
        .insert({
          reporter_id: me,
          target_type: body.targetType,
          target_id: body.targetId,
          category: body.category,
          description: body.description,
          desired_resolution: body.desiredResolution,
          status: "open",
          updates: [{ at, message: "Report received. Both collectors were notified." }],
          created_at: at,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (tradeToNote) {
        await saveTrade(
          db,
          noteReportOnTrade(tradeToNote.trade, me, body.category, at),
          tradeToNote.updatedAt,
        );
      }
      return json({ ok: true, reportId: data.id });
    }

    case "saveAddress": {
      const { trade, updatedAt } = await loadTrade(db, body.tradeId);
      requireSide(trade, me);
      if (trade.status !== "accepted")
        throw new ActionError("You can add your address once the offer is accepted", 409);
      const rows = await shippingRows(db, trade.id);
      const mine = rows.find((r) => r.user_id === me);
      const theirs = rows.find((r) => r.user_id !== me);
      if (mine && (mine.payment_status === "pending" || mine.payment_status === "paid")) {
        throw new ActionError(
          "You've already paid for your label, so your address can't change on this trade.",
          409,
        );
      }
      if (theirs?.payment_status === "paid") {
        throw new ActionError(
          "The other collector already bought a label to your saved address.",
          409,
        );
      }
      if (theirs?.payment_status === "pending") {
        throw new ActionError(
          "The other collector is paying for their label right now. Try again in a few minutes.",
          409,
        );
      }
      await validateAddress(body.address);
      await upsertShipping(db, trade.id, me, {
        address: body.address,
        shippo_shipment_id: null,
        rates: [],
        selected_rate_id: null,
      });
      // Their prices were for your old address; make them fetch new ones.
      if (theirs)
        await upsertShipping(db, trade.id, theirs.user_id, {
          shippo_shipment_id: null,
          rates: [],
          selected_rate_id: null,
        });
      if (!mine?.address) {
        const noted: Trade = {
          ...trade,
          updatedAt: at,
          timeline: [
            ...trade.timeline,
            { at, actorId: me, message: "added their shipping address" },
          ],
        };
        await saveTrade(db, noted, updatedAt);
      }
      return json({ ok: true });
    }

    case "getRates": {
      const { trade } = await loadTrade(db, body.tradeId);
      const side = requireSide(trade, me);
      if (trade.shipments[side].stage !== "packing") {
        throw new ActionError(
          "Shipping prices open once you've both signed and before your label is bought.",
          409,
        );
      }
      const rows = await shippingRows(db, trade.id);
      const mine = rows.find((r) => r.user_id === me);
      const theirs = rows.find((r) => r.user_id !== me);
      if (!mine?.address) throw new ActionError("Add your shipping address first", 409);
      if (mine.payment_status === "pending" || mine.payment_status === "paid") {
        throw new ActionError("You've already started paying for your label.", 409);
      }
      if (!theirs?.address) {
        const name = await displayName(db, collectorIdFor(trade, otherSide(side)));
        throw new ActionError(
          `Waiting for ${name} to add their shipping address. We'll update this page when they do.`,
          409,
        );
      }
      const { shipmentId, rates } = await getRates(mine.address, theirs.address, body.parcel);
      await upsertShipping(db, trade.id, me, {
        parcel: body.parcel,
        shippo_shipment_id: shipmentId,
        rates,
        selected_rate_id: null,
      });
      return json({ ok: true, rates });
    }

    case "checkout": {
      if (!isAllowedReturnUrl(body.returnUrl, allowedOrigins()))
        throw new ActionError("Bad return address");
      const { trade } = await loadTrade(db, body.tradeId);
      const side = requireSide(trade, me);
      if (trade.shipments[side].stage !== "packing")
        throw new ActionError("Your label is already taken care of.", 409);
      if (!PACKING_CHECKLIST.every((c) => body.checklist.includes(c))) {
        throw new ActionError("Finish the packing checklist first", 409);
      }
      const mine = (await shippingRows(db, trade.id)).find((r) => r.user_id === me);
      if (!mine) throw new ActionError("Add your shipping address first", 409);
      if (mine.payment_status === "paid")
        throw new ActionError("You've already paid for this label.", 409);

      // The packing photo must be one this collector uploaded for this trade.
      const photoFolder = `${trade.id}/${me}`;
      const photoName = body.packingPhoto.slice(photoFolder.length + 1);
      if (!body.packingPhoto.startsWith(`${photoFolder}/`) || !photoName || photoName.includes("/"))
        throw new ActionError("Add a photo of your packed box first");
      const { data: found, error: photoErr } = await db.storage
        .from("packing-photos")
        .list(photoFolder, { search: photoName, limit: 1 });
      if (photoErr) throw photoErr;
      if (!found?.some((f) => f.name === photoName))
        throw new ActionError("Your packing photo didn't finish uploading. Add it again.", 409);

      // Never let someone pay twice: check the last checkout before starting a new one.
      if (mine.payment_status === "pending" && mine.stripe_session_id) {
        const last = await getCheckout(mine.stripe_session_id);
        if (last.status === "open") {
          await expireCheckout(mine.stripe_session_id);
        }
        const now = last.status === "open" ? await getCheckout(mine.stripe_session_id) : last;
        if (now.status === "complete") {
          throw new ActionError(
            "Your payment already went through. Your label is being created, and this page will update in a moment.",
            409,
          );
        }
      }
      const rate = mine.rates.find((r) => r.rateId === body.rateId);
      if (!rate)
        throw new ActionError("Those prices expired. Get new shipping prices and try again.", 409);

      const price = priceBreakdown(rate.labelCents);
      const session = await createCheckout({
        lines: [
          { name: `Shipping label: ${rate.carrier} ${rate.service}`, cents: price.labelCents },
          { name: "MOTIONTRADES service fee", cents: SERVICE_FEE_CENTS },
          { name: "Card processing", cents: price.processingCents },
        ],
        email: myEmail,
        successUrl: body.returnUrl,
        cancelUrl: body.returnUrl,
        metadata: { app: "motiontrades", trade_id: trade.id, user_id: me, rate_id: rate.rateId },
      });
      await upsertShipping(db, trade.id, me, {
        stripe_session_id: session.id,
        payment_status: "pending",
        amount_total_cents: price.totalCents,
        label_cents: price.labelCents,
        selected_rate_id: rate.rateId,
        checklist: body.checklist,
        packing_photo: body.packingPhoto,
        failure_message: null,
      });
      return json({ ok: true, url: session.url });
    }

    case "advanceReport": {
      const { data: profile } = await db
        .from("profiles")
        .select("is_admin")
        .eq("id", me)
        .maybeSingle();
      if (!profile?.is_admin) throw new ActionError("Only the safety team can do that", 403);
      const { data: row, error } = await db
        .from("reports")
        .select("*")
        .eq("id", body.reportId)
        .maybeSingle();
      if (error) throw error;
      if (!row) throw new ActionError("Report not found", 404);
      const next = advanceReportState(rowToReport(row as ReportRow), at);
      const { error: upErr } = await db
        .from("reports")
        .update({ status: next.status, updates: next.updates })
        .eq("id", next.id);
      if (upErr) throw upErr;
      if (next.status === "resolved" && next.targetType === "trade") {
        const { trade, updatedAt } = await loadTrade(db, next.targetId);
        const resolved = resolveTradeAfterReport(trade, at);
        await saveTrade(db, resolved, updatedAt);
        await finishIfComplete(db, resolved, resolved.updatedAt, at);
      }
      return json({ ok: true });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  // Stripe payment notifications arrive here too; they're verified by signature, not login.
  if (req.headers.has("Stripe-Signature")) return await handleStripeWebhook(req);
  try {
    return await handle(req);
  } catch (e) {
    if (e instanceof ActionError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong on our end. Try again." }, 500);
  }
});
