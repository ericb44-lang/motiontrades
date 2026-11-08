// Stripe webhook handler (served by the trade-action function when a Stripe-Signature header is present).
//
// Stripe calls this after someone pays for their shipping label. It:
//   1. checks the call really came from Stripe (signature),
//   2. claims the payment once (so a retry can never buy two labels),
//   3. buys the label from Shippo,
//   4. moves that collector's package to "label created" with the real tracking number,
//   5. refunds automatically if the label can't be bought.
//
// The Stripe account is shared with other businesses, so anything without
// metadata.app === "motiontrades" is ignored.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { verifyStripeSignature } from "../_shared/stripe-signature.ts";
import { buyLabel, refund } from "../_shared/providers.ts";
import { generateLabel, sideOf } from "../_shared/trade-logic.ts";
import type { RateOption } from "../_shared/shipping.ts";
import type { Trade } from "../_shared/types.ts";

interface CheckoutSession {
  id: string;
  payment_status: string;
  payment_intent: string | null;
  metadata?: Record<string, string>;
}

const ok = (msg = "ok") => new Response(msg, { status: 200 });

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const secrets = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = secrets ? JSON.parse(secrets)["default"] : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function moveTradeToLabelCreated(
  db: SupabaseClient,
  tradeId: string,
  userId: string,
  checklist: string[],
  trackingNumber: string,
  carrier: string,
) {
  // Retry a few times in case the other collector changes the trade at the same moment.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from("trades")
      .select("doc, updated_at")
      .eq("id", tradeId)
      .maybeSingle();
    if (error || !data) throw error ?? new Error("Trade not found");
    const trade = data.doc as Trade;
    const side = sideOf(trade, userId);
    if (!side) throw new Error("Payer is not part of this trade");
    if (trade.shipments[side].stage !== "packing") return; // already moved on
    const at = new Date().toISOString();
    const next = generateLabel(trade, side, checklist, at, trackingNumber);
    next.shipments[side] = { ...next.shipments[side], carrier };
    next.timeline = next.timeline.map((e, i) =>
      i === next.timeline.length - 1 ? { ...e, message: `paid for their ${carrier} label` } : e,
    );
    const { data: saved, error: saveErr } = await db
      .from("trades")
      .update({ doc: next, updated_at: next.updatedAt })
      .eq("id", tradeId)
      .eq("updated_at", data.updated_at)
      .select("id");
    if (saveErr) throw saveErr;
    if (saved?.length) return;
  }
  throw new Error("Couldn't save the trade after buying the label");
}

async function handleCompleted(db: SupabaseClient, session: CheckoutSession) {
  if (session.metadata?.["app"] !== "motiontrades") return; // another business on this Stripe account
  if (session.payment_status !== "paid") return;

  // Claim this payment exactly once.
  const { data: claimed, error } = await db
    .from("trade_shipping")
    .update({ payment_status: "paid", updated_at: new Date().toISOString() })
    .eq("stripe_session_id", session.id)
    .eq("payment_status", "pending")
    .select("trade_id, user_id, selected_rate_id, rates, checklist");
  if (error) throw error;

  const row = claimed?.[0] as
    | {
        trade_id: string;
        user_id: string;
        selected_rate_id: string;
        rates: RateOption[];
        checklist: string[];
      }
    | undefined;

  if (!row) {
    // Already handled (Stripe retry), or a stale checkout that was replaced by a newer one.
    const { data: existing } = await db
      .from("trade_shipping")
      .select("trade_id, user_id, payment_status, tracking_number, carrier, checklist")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    if (!existing) {
      if (session.payment_intent)
        await refund(session.payment_intent, "Checkout was replaced by a newer one");
      return;
    }
    // A retry after the label was bought but the trade wasn't updated: finish the job.
    if (existing.payment_status === "paid" && existing.tracking_number) {
      await moveTradeToLabelCreated(
        db,
        existing.trade_id as string,
        existing.user_id as string,
        existing.checklist as string[],
        existing.tracking_number as string,
        (existing.carrier as string | null) ?? "USPS",
      );
    }
    return;
  }

  const rate = row.rates.find((r) => r.rateId === row.selected_rate_id);
  const label = await buyLabel(row.selected_rate_id);

  if (!label.ok) {
    console.error("Label purchase failed", row.trade_id, label.reason);
    if (session.payment_intent)
      await refund(session.payment_intent, `Label purchase failed: ${label.reason}`);
    await db
      .from("trade_shipping")
      .update({
        payment_status: "refunded",
        failure_message:
          "We couldn't create your label, so your payment was refunded. Get new prices and try again.",
        selected_rate_id: null,
        rates: [],
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_session_id", session.id);
    return;
  }

  const carrier = rate?.carrier ?? "USPS";
  await db
    .from("trade_shipping")
    .update({
      shippo_transaction_id: label.transactionId,
      label_url: label.labelUrl,
      tracking_number: label.trackingNumber,
      carrier,
      failure_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id);

  await moveTradeToLabelCreated(
    db,
    row.trade_id,
    row.user_id,
    row.checklist,
    label.trackingNumber,
    carrier,
  );
}

async function handleExpired(db: SupabaseClient, session: CheckoutSession) {
  if (session.metadata?.["app"] !== "motiontrades") return;
  await db
    .from("trade_shipping")
    .update({
      payment_status: "none",
      stripe_session_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id)
    .eq("payment_status", "pending");
}

export async function handleStripeWebhook(req: Request): Promise<Response> {
  const body = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  if (!(await verifyStripeSignature(body, req.headers.get("Stripe-Signature"), secret))) {
    return new Response("Bad signature", { status: 400 });
  }

  const event = JSON.parse(body) as { type: string; data: { object: CheckoutSession } };
  const db = adminClient();
  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await handleCompleted(db, event.data.object);
    } else if (event.type === "checkout.session.expired") {
      await handleExpired(db, event.data.object);
    }
    return ok();
  } catch (e) {
    console.error("Webhook failed", event.type, e);
    // A 500 makes Stripe retry later. The claim step above keeps retries from double-buying.
    return new Response("Error", { status: 500 });
  }
}
