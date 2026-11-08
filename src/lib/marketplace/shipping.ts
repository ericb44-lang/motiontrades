// Shipping labels and pricing. Pure functions shared by the browser and the edge functions.
//
// Each collector pays for their OWN label: label cost + MOTIONTRADES service fee + card processing.
// Card processing is sized so that after Stripe's fee (2.9% + 30¢) and Shippo's per-label fee,
// MOTIONTRADES keeps the full service fee and the label cost is covered.

export const SERVICE_FEE_CENTS = 150;
/** Shippo's per-label fee on the pay-as-you-go plan (after 30 free labels a month). */
export const SHIPPO_LABEL_FEE_CENTS = 7;
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED_CENTS = 30;

export interface PriceBreakdown {
  labelCents: number;
  serviceFeeCents: number;
  processingCents: number;
  totalCents: number;
}

export function priceBreakdown(labelCents: number): PriceBreakdown {
  if (!Number.isInteger(labelCents) || labelCents <= 0) throw new Error("Invalid label price");
  const mustKeep = labelCents + SERVICE_FEE_CENTS + SHIPPO_LABEL_FEE_CENTS;
  const totalCents = Math.ceil((mustKeep + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT));
  return {
    labelCents,
    serviceFeeCents: SERVICE_FEE_CENTS,
    processingCents: totalCents - labelCents - SERVICE_FEE_CENTS,
    totalCents,
  };
}

export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/* ------------------------------ addresses ------------------------------ */

export interface ShippingAddress {
  name: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
}

export const EMPTY_ADDRESS: ShippingAddress = {
  name: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
};

export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "PR",
] as const;

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Normalize untrusted input into an address, or throw with a message a person can act on. */
export function parseAddress(input: unknown): ShippingAddress {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const a: ShippingAddress = {
    name: clean(b["name"], 60),
    street1: clean(b["street1"], 80),
    street2: clean(b["street2"], 80),
    city: clean(b["city"], 50),
    state: clean(b["state"], 2).toUpperCase(),
    zip: clean(b["zip"], 10),
  };
  const errors = addressErrors(a);
  const first = Object.values(errors)[0];
  if (first) throw new Error(first);
  return a;
}

export function addressErrors(a: ShippingAddress): Partial<Record<keyof ShippingAddress, string>> {
  const e: Partial<Record<keyof ShippingAddress, string>> = {};
  if (a.name.trim().length < 2) e.name = "Enter the name for the label";
  if (a.street1.trim().length < 3) e.street1 = "Enter your street address";
  if (a.city.trim().length < 2) e.city = "Enter your city";
  if (!(US_STATES as readonly string[]).includes(a.state.trim().toUpperCase()))
    e.state = "Pick your state";
  if (!/^\d{5}(-\d{4})?$/.test(a.zip.trim())) e.zip = "Enter a 5-digit ZIP code";
  return e;
}

/* ------------------------------ packages ------------------------------ */

export const BOX_PRESETS = {
  small: { label: "Small box (9 × 6 × 4 in)", length: 9, width: 6, height: 4 },
  medium: { label: "Medium box (12 × 9 × 6 in)", length: 12, width: 9, height: 6 },
  large: { label: "Large box (16 × 12 × 8 in)", length: 16, width: 12, height: 8 },
  xl: { label: "Extra large (20 × 16 × 10 in)", length: 20, width: 16, height: 10 },
} as const;

export type BoxPreset = keyof typeof BOX_PRESETS;

export interface Parcel {
  box: BoxPreset;
  /** Packed weight in pounds, including the box. */
  weightLb: number;
}

export function parseParcel(input: unknown): Parcel {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const box = b["box"];
  if (typeof box !== "string" || !(box in BOX_PRESETS)) throw new Error("Pick a box size");
  const weightLb = Number(b["weightLb"]);
  if (!Number.isFinite(weightLb) || weightLb <= 0) throw new Error("Enter the packed weight");
  if (weightLb > 70) throw new Error("Packages over 70 lb can't ship this way");
  return { box: box as BoxPreset, weightLb: Math.round(weightLb * 100) / 100 };
}

/* ------------------------------ rates ------------------------------ */

/** A shipping option offered to the sender (from Shippo). */
export interface RateOption {
  rateId: string;
  carrier: string;
  service: string;
  labelCents: number;
  estimatedDays: number | null;
}

/** Keep the most useful options: cheapest first, a few per carrier, max 6. */
export function pickRates(options: RateOption[]): RateOption[] {
  const sorted = [...options]
    .filter((o) => o.labelCents > 0)
    .sort((a, b) => a.labelCents - b.labelCents);
  const perCarrier = new Map<string, number>();
  const out: RateOption[] = [];
  for (const o of sorted) {
    const n = perCarrier.get(o.carrier) ?? 0;
    if (n >= 3) continue;
    perCarrier.set(o.carrier, n + 1);
    out.push(o);
    if (out.length === 6) break;
  }
  return out;
}

/** Where Stripe may send people back to after paying. Prevents redirects to other sites. */
export function isAllowedReturnUrl(url: string, allowedOrigins: string[]): boolean {
  try {
    const u = new URL(url);
    return allowedOrigins.some((o) => {
      if (o.endsWith(":*"))
        return u.origin.startsWith(o.slice(0, -2) + ":") || u.origin === o.slice(0, -2);
      return u.origin === o;
    });
  } catch {
    return false;
  }
}

export const DEFAULT_ALLOWED_ORIGINS = [
  "https://motion-trades.com",
  "https://www.motion-trades.com",
  "https://ericb44-lang.github.io",
  "http://localhost:*",
];

/** Public tracking page for a carrier and tracking number. */
export function trackingUrl(carrier: string, tracking: string): string {
  const t = encodeURIComponent(tracking);
  switch (carrier.toLowerCase()) {
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${t}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(`${carrier} tracking ${tracking}`)}`;
  }
}

/** What the browser can see of its own shipping record. Never includes the other collector's address. */
export interface MyShipping {
  tradeId: string;
  address: ShippingAddress | null;
  parcel: Parcel | null;
  rates: RateOption[];
  selectedRateId: string | null;
  paymentStatus: "none" | "pending" | "paid" | "refunded" | "failed";
  amountTotalCents: number | null;
  labelUrl: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  failureMessage: string | null;
}
