import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOWED_ORIGINS,
  EMPTY_ADDRESS,
  isAllowedReturnUrl,
  SERVICE_FEE_CENTS,
  SHIPPO_LABEL_FEE_CENTS,
  parseAddress,
  parseParcel,
  pickRates,
  priceBreakdown,
} from "./shipping";

/** What Stripe actually deducts (2.9% + 30¢, rounded to the cent). */
const stripeFee = (total: number) => Math.round(total * 0.029) + 30;

describe("price breakdown", () => {
  it.each([350, 800, 1234, 2599, 9900])(
    "covers the label and keeps the full $1.50 on a %i¢ label",
    (label) => {
      const p = priceBreakdown(label);
      expect(p.labelCents + p.serviceFeeCents + p.processingCents).toBe(p.totalCents);
      const youKeep = p.totalCents - stripeFee(p.totalCents) - label - SHIPPO_LABEL_FEE_CENTS;
      expect(youKeep).toBeGreaterThanOrEqual(SERVICE_FEE_CENTS);
      expect(youKeep).toBeLessThanOrEqual(SERVICE_FEE_CENTS + 2); // no more than 2¢ extra
    },
  );

  it("an $8 label totals $10.17", () => {
    expect(priceBreakdown(800)).toEqual({
      labelCents: 800,
      serviceFeeCents: 150,
      processingCents: 67,
      totalCents: 1017,
    });
  });

  it("rejects nonsense prices", () => {
    expect(() => priceBreakdown(0)).toThrow();
    expect(() => priceBreakdown(8.5)).toThrow();
  });
});

describe("addresses", () => {
  const good = {
    name: "Pat Collector",
    street1: "123 Main St",
    street2: "",
    city: "Ogden",
    state: "ut",
    zip: "84401",
  };

  it("accepts and tidies a normal address", () => {
    expect(parseAddress({ ...good, city: "  Ogden  " })).toEqual({ ...good, state: "UT" });
  });

  it("explains what's missing", () => {
    expect(() => parseAddress(EMPTY_ADDRESS)).toThrow(/name/);
    expect(() => parseAddress({ ...good, zip: "8440" })).toThrow(/ZIP/);
    expect(() => parseAddress({ ...good, state: "ZZ" })).toThrow(/state/);
  });
});

describe("packages", () => {
  it("needs a known box and a sane weight", () => {
    expect(parseParcel({ box: "medium", weightLb: "2.5" })).toEqual({
      box: "medium",
      weightLb: 2.5,
    });
    expect(() => parseParcel({ box: "huge", weightLb: 1 })).toThrow();
    expect(() => parseParcel({ box: "small", weightLb: 0 })).toThrow();
    expect(() => parseParcel({ box: "small", weightLb: 90 })).toThrow(/70 lb/);
  });
});

describe("rate picking", () => {
  it("sorts cheapest first and caps each carrier at 3", () => {
    const r = (id: string, carrier: string, cents: number) => ({
      rateId: id,
      carrier,
      service: id,
      labelCents: cents,
      estimatedDays: 3,
    });
    const picked = pickRates([
      r("a", "USPS", 900),
      r("b", "USPS", 500),
      r("c", "USPS", 700),
      r("d", "USPS", 600),
      r("e", "UPS", 1200),
    ]);
    expect(picked.map((p) => p.rateId)).toEqual(["b", "d", "c", "e"]);
  });
});

describe("return links after paying", () => {
  it("only allows the site's own addresses", () => {
    expect(
      isAllowedReturnUrl(
        "https://ericb44-lang.github.io/motiontrades/#/trades/t-1",
        DEFAULT_ALLOWED_ORIGINS,
      ),
    ).toBe(true);
    expect(isAllowedReturnUrl("http://localhost:3000/trades/t-1", DEFAULT_ALLOWED_ORIGINS)).toBe(
      true,
    );
    expect(isAllowedReturnUrl("https://evil.example/phish", DEFAULT_ALLOWED_ORIGINS)).toBe(false);
    expect(
      isAllowedReturnUrl("https://ericb44-lang.github.io.evil.example/", DEFAULT_ALLOWED_ORIGINS),
    ).toBe(false);
    expect(isAllowedReturnUrl("not a url", DEFAULT_ALLOWED_ORIGINS)).toBe(false);
  });
});
