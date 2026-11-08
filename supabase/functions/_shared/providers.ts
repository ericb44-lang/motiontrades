// Server-only clients for Shippo (labels) and Stripe (payments). Hand-written, not generated.
// Keys come from Edge Function secrets: SHIPPO_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
import type { BoxPreset, Parcel, RateOption, ShippingAddress } from "./shipping.ts";
import { BOX_PRESETS, pickRates } from "./shipping.ts";
import { ActionError } from "./trade-actions.ts";

/* ------------------------------ Shippo ------------------------------ */

const SHIPPO = "https://api.goshippo.com";

function shippoKey(): string {
  const key = Deno.env.get("SHIPPO_API_KEY");
  if (!key) throw new ActionError("Shipping isn't set up yet. Try again soon.", 409);
  return key;
}

async function shippo<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SHIPPO}${path}`, {
    method: "POST",
    headers: { Authorization: `ShippoToken ${shippoKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { detail?: string };
  if (!res.ok) {
    console.error("Shippo error", res.status, JSON.stringify(data));
    throw new ActionError("The shipping service didn't respond. Try again in a minute.", 409);
  }
  return data;
}

const toShippoAddress = (a: ShippingAddress, email?: string) => ({
  name: a.name,
  street1: a.street1,
  street2: a.street2 || undefined,
  city: a.city,
  state: a.state,
  zip: a.zip,
  country: "US",
  ...(email ? { email } : {}),
});

/** Ask Shippo whether an address is deliverable. Throws a readable error if not. */
export async function validateAddress(a: ShippingAddress): Promise<void> {
  const res = await shippo<{
    validation_results?: { is_valid?: boolean; messages?: { text?: string }[] };
  }>("/addresses/", { ...toShippoAddress(a), validate: true });
  const v = res.validation_results;
  if (v && v.is_valid === false) {
    const why = v.messages?.map((m) => m.text).filter(Boolean)[0];
    throw new ActionError(
      `We couldn't verify that address${why ? `: ${why}` : ""}. Double-check the street and ZIP.`,
    );
  }
}

interface ShippoRate {
  object_id: string;
  amount: string;
  currency: string;
  provider: string;
  servicelevel?: { name?: string };
  estimated_days?: number | null;
}

/** Get label prices for a package from `from` to `to`. */
export async function getRates(
  from: ShippingAddress,
  to: ShippingAddress,
  parcel: Parcel,
): Promise<{ shipmentId: string; rates: RateOption[] }> {
  const box = BOX_PRESETS[parcel.box as BoxPreset];
  const res = await shippo<{
    object_id: string;
    rates?: ShippoRate[];
    messages?: { text?: string }[];
  }>("/shipments/", {
    address_from: toShippoAddress(from),
    address_to: toShippoAddress(to),
    parcels: [
      {
        length: String(box.length),
        width: String(box.width),
        height: String(box.height),
        distance_unit: "in",
        weight: String(parcel.weightLb),
        mass_unit: "lb",
      },
    ],
    async: false,
  });
  const rates = pickRates(
    (res.rates ?? [])
      .filter((r) => r.currency === "USD")
      .map((r) => ({
        rateId: r.object_id,
        carrier: r.provider,
        service: r.servicelevel?.name ?? "Standard",
        labelCents: Math.round(Number(r.amount) * 100),
        estimatedDays: r.estimated_days ?? null,
      })),
  );
  if (!rates.length) {
    const why = res.messages?.map((m) => m.text).filter(Boolean)[0];
    throw new ActionError(
      `No shipping options came back${why ? ` (${why})` : ""}. Check the box size and weight.`,
      409,
    );
  }
  return { shipmentId: res.object_id, rates };
}

/** Buy the label for a rate. Returns null (with a reason) if Shippo couldn't make it. */
export async function buyLabel(
  rateId: string,
): Promise<
  | { ok: true; transactionId: string; labelUrl: string; trackingNumber: string }
  | { ok: false; reason: string }
> {
  try {
    const res = await shippo<{
      object_id: string;
      status: string;
      label_url?: string;
      tracking_number?: string;
      messages?: { text?: string }[];
    }>("/transactions/", { rate: rateId, label_file_type: "PDF_4x6", async: false });
    if (res.status === "SUCCESS" && res.label_url && res.tracking_number) {
      return {
        ok: true,
        transactionId: res.object_id,
        labelUrl: res.label_url,
        trackingNumber: res.tracking_number,
      };
    }
    return {
      ok: false,
      reason:
        res.messages
          ?.map((m) => m.text)
          .filter(Boolean)
          .join("; ") || res.status,
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/* ------------------------------ Stripe ------------------------------ */

function stripeKey(): string {
  // Accept the original secret name and the spelling it was saved under.
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? Deno.env.get("STRIPE_SECRETE_KEY");
  if (!key) throw new ActionError("Payments aren't set up yet. Try again soon.", 409);
  return key;
}

/** Stripe's API takes form-encoded bodies with bracket keys, e.g. line_items[0][quantity]. */
function form(
  obj: Record<string, unknown>,
  prefix = "",
  out = new URLSearchParams(),
): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe<T>(
  path: string,
  params: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: form(params),
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error("Stripe error", res.status, data.error?.message);
    throw new ActionError("The payment service didn't respond. Try again in a minute.", 409);
  }
  return data;
}

export interface CheckoutLine {
  name: string;
  cents: number;
}

export async function createCheckout(input: {
  lines: CheckoutLine[];
  email: string | undefined;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; url: string }> {
  const lineItems = Object.fromEntries(
    input.lines.map((l, i) => [
      i,
      {
        quantity: 1,
        price_data: { currency: "usd", unit_amount: l.cents, product_data: { name: l.name } },
      },
    ]),
  );
  return await stripe<{ id: string; url: string }>("/checkout/sessions", {
    mode: "payment",
    line_items: lineItems,
    customer_email: input.email,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: input.metadata,
    payment_intent_data: { metadata: input.metadata },
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
  });
}

export async function refund(paymentIntentId: string, reason: string): Promise<void> {
  await stripe(
    "/refunds",
    { payment_intent: paymentIntentId, metadata: { reason: reason.slice(0, 450) } },
    `refund-${paymentIntentId}`,
  );
}
