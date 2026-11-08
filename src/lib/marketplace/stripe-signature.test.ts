import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signForTest, verifyStripeSignature } from "./stripe-signature";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
const NOW = 1_800_000_000;

describe("Stripe webhook signatures", () => {
  it("matches Stripe's documented scheme (HMAC-SHA256 of `t.body`)", async () => {
    const expected = createHmac("sha256", SECRET).update(`${NOW}.${BODY}`).digest("hex");
    expect(await signForTest(BODY, SECRET, NOW)).toBe(`t=${NOW},v1=${expected}`);
  });

  it("accepts a valid, fresh signature", async () => {
    const header = await signForTest(BODY, SECRET, NOW);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW + 10)).toBe(true);
  });

  it("rejects a changed body, wrong secret, old timestamp or missing header", async () => {
    const header = await signForTest(BODY, SECRET, NOW);
    expect(await verifyStripeSignature(BODY.replace("evt_1", "evt_2"), header, SECRET, NOW)).toBe(
      false,
    );
    expect(await verifyStripeSignature(BODY, header, "whsec_other", NOW)).toBe(false);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW + 600)).toBe(false);
    expect(await verifyStripeSignature(BODY, null, SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(BODY, "t=abc,v1=zzz", SECRET, NOW)).toBe(false);
  });
});
