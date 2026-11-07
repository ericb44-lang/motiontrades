/** Presentation-only configuration. No provider scripts, accounts or tracking. */
export const advertisingConfig = {
  enabled: false,
  showReservedSpaces: true,
  sponsoredBrandsEnabled: false,
} as const;

export const advertisingPlacements = {
  "browse-top": { path: "/browse", label: "Advertisement" },
  "home-marketplace": { path: "/", label: "Advertisement" },
  "home-brands": { path: "/", label: "Sponsored" },
} as const;

export type AdvertisingPlacement = keyof typeof advertisingPlacements;

export interface SponsoredBrand {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl: string;
}

/** Populate only with approved, real advertisers and their supplied assets. */
export const sponsoredBrands: readonly SponsoredBrand[] = [];

export function isPlacementAllowed(placement: AdvertisingPlacement, pathname: string): boolean {
  return advertisingPlacements[placement].path === pathname;
}

export function shouldShowAdvertisement(
  placement: AdvertisingPlacement,
  pathname: string,
  settings: { enabled: boolean; showReservedSpaces: boolean } = advertisingConfig,
): boolean {
  return placement !== "home-brands" && isPlacementAllowed(placement, pathname) &&
    (settings.enabled || settings.showReservedSpaces);
}

export function shouldShowSponsoredBrands(
  pathname: string,
  enabled = advertisingConfig.sponsoredBrandsEnabled as boolean,
  brands: readonly SponsoredBrand[] = sponsoredBrands,
): boolean {
  return enabled && isPlacementAllowed("home-brands", pathname) && brands.length > 0;
}

export function isSecureAdvertiserUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}