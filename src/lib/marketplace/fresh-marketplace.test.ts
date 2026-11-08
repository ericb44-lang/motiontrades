import { describe, expect, it } from "vitest";
import { createEmptyState } from "./seed";
import { validateCollectorProfile, validateEmail } from "./trade-logic";

describe("fresh marketplace", () => {
  it("starts with zero collectors, listings, trades, reviews and reports, and nobody signed in", () => {
    const s = createEmptyState();
    expect(s.currentUserId).toBeNull();
    expect(s.collectors).toHaveLength(0);
    expect(s.listings).toHaveLength(0);
    expect(s.trades).toHaveLength(0);
    expect(s.reviews).toHaveLength(0);
    expect(s.reports).toHaveLength(0);
  });
});

describe("collector registration", () => {
  it("accepts a valid new profile", () => {
    expect(validateCollectorProfile({ displayName: "Massimo", username: "massimo_b" }, [])).toEqual(
      {},
    );
  });

  it("rejects a username that is already taken", () => {
    expect(
      validateCollectorProfile({ displayName: "Massimo", username: "Massimo_B" }, ["massimo_b"])
        .username,
    ).toBeDefined();
  });

  it("rejects usernames with spaces or symbols", () => {
    expect(
      validateCollectorProfile({ displayName: "Massimo", username: "mass imo!" }, []).username,
    ).toBeDefined();
  });
});

describe("sign-up email", () => {
  it("accepts a normal email", () => {
    expect(validateEmail("collector@example.com", [])).toBeUndefined();
  });

  it("requires an email", () => {
    expect(validateEmail("   ", [])).toBeDefined();
  });

  it("rejects malformed emails", () => {
    for (const bad of [
      "collector",
      "collector@",
      "@example.com",
      "a b@example.com",
      "collector@example",
    ]) {
      expect(validateEmail(bad, [])).toBeDefined();
    }
  });

  it("rejects an email already used by another profile, ignoring case", () => {
    expect(validateEmail("Collector@Example.com", ["collector@example.com"])).toBeDefined();
  });
});
