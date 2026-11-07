import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Eye } from "lucide-react";
import type { Collector, Listing } from "@/lib/marketplace/types";
import { ConditionBadge, FigureImage } from "./bits";

export function ListingCard({
  listing,
  owner,
}: {
  listing: Listing;
  owner?: Collector | undefined;
}) {
  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group clip-chamfer relative flex flex-col overflow-hidden border bg-card shadow-card transition-colors hover:border-primary/60"
    >
      <div className="relative aspect-square overflow-hidden bg-surface">
        <FigureImage
          src={listing.images[0]}
          alt={listing.title}
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 rounded-md bg-background shadow-sm">
          <ConditionBadge condition={listing.condition} />
        </div>
        <div className="absolute right-3 top-3 grid size-8 place-items-center bg-background/70 text-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {listing.brand} · {listing.line}
        </p>
        <h3 className="line-clamp-2 font-display text-sm font-bold leading-snug">
          {listing.title}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>{owner ? `@${owner.username}` : listing.scale}</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3" /> {listing.views.toLocaleString("en-US")}
          </span>
        </div>
      </div>
    </Link>
  );
}
