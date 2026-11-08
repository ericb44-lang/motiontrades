import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Eye, Flag, Package, Pencil, Repeat, Ruler, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CollectorAvatar,
  CollectorLink,
  ConditionBadge,
  EmptyState,
  FigureImage,
  Stars,
  TierBadge,
} from "@/components/market/bits";
import { ListingCard } from "@/components/market/ListingCard";
import { MakeOfferDialog } from "@/components/market/MakeOfferDialog";
import { ReportDialog } from "@/components/market/ReportDialog";
import {
  findCollector,
  market,
  reputationFor,
  useMarket,
  useMarketHydrated,
} from "@/lib/marketplace/store";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listings/$id")({
  head: () => {
    const title = "Figure for trade | MOTIONTRADES";
    const description =
      "Photos, condition report and included accessories for this action figure. Propose a trade on MOTIONTRADES.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const state = useMarket();
  const hydrated = useMarketHydrated();
  const listing = state.listings.find((l) => l.id === id);
  const [active, setActive] = useState(0);
  const isOwn = !!listing && listing.ownerId === state.currentUserId;

  // Count one view per visit (the database ignores views of your own listing).
  useEffect(() => {
    if (hydrated && listing && !isOwn) market.recordView(listing.id);
  }, [hydrated, listing?.id, isOwn]);

  if (!listing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {hydrated ? (
          <EmptyState
            title="Listing not found"
            body="This figure may have been removed or traded."
            action={
              <Button asChild variant="outline">
                <Link to="/browse">Back to browse</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-10 lg:grid-cols-2">
            <Skeleton className="aspect-square" />
            <Skeleton className="h-64" />
          </div>
        )}
      </div>
    );
  }

  const owner = findCollector(state, listing.ownerId)!;
  const rep = reputationFor(state, owner.id)!;
  const isMine = !!state.currentUserId && listing.ownerId === state.currentUserId;
  const more = state.listings
    .filter((l) => l.ownerId === owner.id && l.id !== listing.id && l.status === "active")
    .slice(0, 4);
  const img = listing.images[Math.min(active, listing.images.length - 1)];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        to="/browse"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to browse
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* Gallery */}
        <div>
          <div className="clip-chamfer relative aspect-square overflow-hidden border bg-surface">
            <FigureImage src={img} alt={listing.title} eager />
            {listing.status !== "active" && (
              <div className="absolute left-4 top-4 bg-background/80 px-3 py-1 font-mono text-xs uppercase tracking-widest backdrop-blur">
                {listing.status.replace("_", " ")}
              </div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {listing.images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "aspect-square overflow-hidden border bg-surface",
                    i === active ? "border-primary" : "border-border opacity-70 hover:opacity-100",
                  )}
                  aria-label={`Photo ${i + 1}`}
                >
                  <FigureImage src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {listing.brand} · {listing.line}
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{listing.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <ConditionBadge condition={listing.condition} />
            <span className="inline-flex items-center gap-1">
              <Eye className="size-4" /> {listing.views.toLocaleString("en-US")} views
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-4" /> Listed {formatDate(listing.createdAt)}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {isMine ? (
              <Button asChild variant="outline" size="lg">
                <Link to="/listings/$id/edit" params={{ id: listing.id }}>
                  <Pencil /> Edit listing
                </Link>
              </Button>
            ) : listing.status === "active" ? (
              <MakeOfferDialog listing={listing}>
                <Button variant="hero" size="lg">
                  <Repeat /> Propose a trade
                </Button>
              </MakeOfferDialog>
            ) : (
              <Button size="lg" disabled>
                Not available for trade
              </Button>
            )}
            {!isMine && state.currentUserId && (
              <ReportDialog targetType="listing" targetId={listing.id}>
                <Button variant="ghost" size="lg">
                  <Flag /> Report listing
                </Button>
              </ReportDialog>
            )}
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden border bg-border sm:grid-cols-4">
            {[
              [Ruler, "Scale", listing.scale],
              [Tag, "Category", listing.category],
              [Calendar, "Year", String(listing.year)],
              [Package, "Accessories", String(listing.accessories.length)],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Ruler;
              return (
                <div key={label as string} className="bg-card p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <I className="size-3" /> {label as string}
                  </dt>
                  <dd className="mt-1 font-semibold">{value as string}</dd>
                </div>
              );
            })}
          </dl>

          <section className="mt-8">
            <h2 className="eyebrow mb-3">Description</h2>
            <p className="leading-relaxed text-muted-foreground">{listing.description}</p>
          </section>

          <section className="mt-8 border-l-2 border-primary bg-surface p-5">
            <h2 className="eyebrow mb-2">Condition report</h2>
            <p className="font-display font-bold">{listing.condition}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {listing.conditionNotes || "No additional notes."}
            </p>
          </section>

          <section className="mt-8">
            <h2 className="eyebrow mb-3">Included accessories</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {listing.accessories.map((a) => (
                <li key={a} className="flex items-center gap-2 border bg-card px-3 py-2 text-sm">
                  <span className="size-1.5 bg-primary" /> {a}
                </li>
              ))}
              {listing.accessories.length === 0 && (
                <li className="text-sm text-muted-foreground">Figure only.</li>
              )}
            </ul>
          </section>

          {listing.lookingFor.length > 0 && (
            <section className="mt-8">
              <h2 className="eyebrow mb-3">Looking for</h2>
              <div className="flex flex-wrap gap-2">
                {listing.lookingFor.map((w) => (
                  <span
                    key={w}
                    className="border border-dashed px-3 py-1 text-sm text-muted-foreground"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Owner */}
          <section className="clip-chamfer mt-8 border bg-card p-5">
            <div className="flex items-center gap-4">
              <CollectorAvatar collector={owner} size="lg" />
              <div className="min-w-0 flex-1">
                <CollectorLink collector={owner} className="text-lg" />
                <p className="text-sm text-muted-foreground">
                  @{owner.username}
                  {owner.region ? ` · ${owner.region}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TierBadge tier={rep.tier} />
                  <Stars value={rep.avgRating} />
                  <span className="text-xs text-muted-foreground">
                    {rep.completedTrades} trades
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-black">{rep.score}</p>
                <p className="text-xs font-medium text-muted-foreground">Rep</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {more.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">More from {owner.displayName}</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {more.map((l) => (
              <ListingCard key={l.id} listing={l} owner={owner} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
