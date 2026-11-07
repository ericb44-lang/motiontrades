import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  advertisingConfig,
  advertisingPlacements,
  isSecureAdvertiserUrl,
  shouldShowAdvertisement,
  shouldShowSponsoredBrands,
  sponsoredBrands,
  type AdvertisingPlacement,
} from "@/lib/advertising";
import { cn } from "@/lib/utils";

/** Future provider adapters supply content here; reserved slots never load scripts. */
export function Advertisement({
  placement,
  className,
  children,
}: {
  placement: Exclude<AdvertisingPlacement, "home-brands">;
  className?: string;
  children?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!shouldShowAdvertisement(placement, pathname)) return null;

  return (
    <aside
      aria-label={advertisingPlacements[placement].label}
      data-ad-placement={placement}
      data-ad-state={advertisingConfig.enabled ? "enabled" : "reserved"}
      className={cn("min-w-0", className)}
    >
      <p className="mb-2 text-center text-xs text-muted-foreground">Advertisement</p>
      <div className="flex min-h-[100px] w-full min-w-0 items-center justify-center overflow-hidden border bg-surface px-3 sm:min-h-[120px] sm:px-6">
        <div className="w-full min-w-0 max-w-[970px] [&_iframe]:max-w-full [&_img]:max-w-full">
          {advertisingConfig.enabled ? children : null}
        </div>
      </div>
    </aside>
  );
}

export function SponsoredBrands() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const approvedBrands = sponsoredBrands.filter(
    (brand) => isSecureAdvertiserUrl(brand.websiteUrl) && isSecureAdvertiserUrl(brand.logoUrl),
  );
  if (
    !shouldShowSponsoredBrands(pathname, advertisingConfig.sponsoredBrandsEnabled, approvedBrands)
  )
    return null;

  return (
    <section aria-label="Sponsored brands" className="border-y bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p className="mb-3 text-xs text-muted-foreground">Sponsored</p>
        <h2 className="text-xl font-bold">Brand partners</h2>
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {approvedBrands.map((brand) => (
            <li key={brand.id} className="min-w-0">
              <a
                href={brand.websiteUrl}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-md border bg-card p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="h-12 w-full object-contain"
                  loading="lazy"
                />
                <span className="max-w-full break-words text-sm font-medium">{brand.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
