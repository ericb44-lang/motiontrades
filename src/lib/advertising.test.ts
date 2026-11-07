import { describe, expect, it } from "vitest";
import {
  advertisingConfig,
  isPlacementAllowed,
  shouldShowAdvertisement,
  shouldShowSponsoredBrands,
  sponsoredBrands,
  type AdvertisingPlacement,
} from "./advertising";

describe("advertising placement safeguards", () => {
  it("reserves advertising near Browse and in the homepage marketplace only", () => {
    expect(shouldShowAdvertisement("browse-top", "/browse")).toBe(true);
    expect(shouldShowAdvertisement("home-marketplace", "/")).toBe(true);
    expect(isPlacementAllowed("browse-top", "/")).toBe(false);
  });

  it.each(["/trades", "/trades/trade-123", "/safety", "/join", "/account/security", "/shipping/verification"])(
    "never enables advertising in sensitive workflow %s", (path) => {
      for (const slot of ["browse-top", "home-marketplace", "home-brands"] as AdvertisingPlacement[]) {
        expect(isPlacementAllowed(slot, path)).toBe(false);
        expect(shouldShowAdvertisement(slot, path, { enabled: true, showReservedSpaces: true })).toBe(false);
      }
    },
  );

  it("starts without active advertising or fake advertiser content", () => {
    expect(advertisingConfig.enabled).toBe(false);
    expect(advertisingConfig.sponsoredBrandsEnabled).toBe(false);
    expect(sponsoredBrands).toEqual([]);
    expect(shouldShowSponsoredBrands("/", true, [])).toBe(false);
  });

  it("can disable reserved advertising without redesigning pages", () => {
    expect(shouldShowAdvertisement("browse-top", "/browse", { enabled: false, showReservedSpaces: false })).toBe(false);
    expect(shouldShowAdvertisement("browse-top", "/browse", { enabled: true, showReservedSpaces: false })).toBe(true);
  });

  it("shows real sponsorship only when enabled on the homepage", () => {
    const brands = [{ id: "approved", name: "Approved advertiser", logoUrl: "https://example.org/logo.png", websiteUrl: "https://example.org" }];
    expect(shouldShowSponsoredBrands("/", false, brands)).toBe(false);
    expect(shouldShowSponsoredBrands("/", true, brands)).toBe(true);
    expect(shouldShowSponsoredBrands("/safety", true, brands)).toBe(false);
  });
});