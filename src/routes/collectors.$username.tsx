import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Flag, MapPin, PackageCheck, ShieldAlert, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CollectorAvatar, EmptyState, Stars, TierBadge } from "@/components/market/bits";
import { ListingCard } from "@/components/market/ListingCard";
import { ReportDialog } from "@/components/market/ReportDialog";
import {
  findCollector,
  findCollectorByUsername,
  reputationFor,
  useMarket,
  useMarketHydrated,
} from "@/lib/marketplace/store";
import { formatDate, formatMonthYear } from "@/lib/format";

export const Route = createFileRoute("/collectors/$username")({
  head: ({ params }) => {
    const title = `@${params.username} | MOTIONTRADES`;
    const description = `Listings, reviews and trade reputation for @${params.username} on MOTIONTRADES.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: CollectorPage,
});

function CollectorPage() {
  const { username } = Route.useParams();
  const state = useMarket();
  const hydrated = useMarketHydrated();
  const c = findCollectorByUsername(state, username);

  if (!c) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {hydrated ? (
          <EmptyState
            title="Collector not found"
            body="No collector goes by that name."
            action={
              <Button asChild variant="outline">
                <Link to="/browse">Browse figures</Link>
              </Button>
            }
          />
        ) : (
          <Skeleton className="h-64" />
        )}
      </div>
    );
  }

  const rep = reputationFor(state, c.id)!;
  const isMe = !!state.currentUserId && c.id === state.currentUserId;
  const listings = state.listings.filter((l) => l.ownerId === c.id && l.status === "active");
  const reviews = state.reviews
    .filter((r) => r.collectorId === c.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => r.rating === n).length,
  }));

  const factors = [
    {
      icon: Star,
      label: "Average rating",
      value: rep.reviewCount ? `${rep.avgRating.toFixed(2)} / 5` : "No reviews yet",
    },
    { icon: PackageCheck, label: "Completed trades", value: String(rep.completedTrades) },
    {
      icon: Truck,
      label: "On-time shipping",
      value: rep.completedTrades ? `${Math.round(c.stats.onTimeShipRate * 100)}%` : "No trades yet",
    },
    { icon: ShieldAlert, label: "Dispute rate", value: `${(rep.disputeRate * 100).toFixed(1)}%` },
  ];

  return (
    <div>
      <section className="relative overflow-hidden border-b bg-surface">
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <CollectorAvatar collector={c} size="xl" />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black sm:text-4xl">{c.displayName}</h1>
                <TierBadge tier={rep.tier} />
              </div>
              <p className="mt-1 text-muted-foreground">@{c.username}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {c.region && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" /> {c.region}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-4" /> Joined {formatMonthYear(c.joinedAt)}
                </span>
              </div>
              <p className="mt-4 max-w-xl">{c.bio}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {c.favoriteLines.map((f) => (
                  <span key={f} className="border bg-card/60 px-2 py-0.5 text-xs">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="clip-chamfer flex items-center gap-5 border border-primary/40 bg-card/80 p-5 backdrop-blur">
            <ScoreRing score={rep.score} />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Reputation score</p>
              <Stars value={rep.avgRating} className="mt-2" />
              <p className="mt-1 text-xs text-muted-foreground">{rep.reviewCount} reviews</p>
              {!isMe && state.currentUserId && (
                <ReportDialog targetType="collector" targetId={c.id}>
                  <button className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                    <Flag className="size-3" /> Report collector
                  </button>
                </ReportDialog>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden border bg-border md:grid-cols-4">
          {factors.map((f) => (
            <div key={f.label} className="bg-card p-5">
              <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <f.icon className="size-3.5 text-primary" /> {f.label}
              </dt>
              <dd className="mt-2 font-display text-xl font-bold">{f.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Score blends review rating (60), trade volume (20), on-time shipping (10) and dispute-free
          record (10).
        </p>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_360px]">
          <section>
            <h2 className="text-xl font-bold">
              {isMe ? "Your active listings" : "Active listings"} ({listings.length})
            </h2>
            {listings.length ? (
              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
                {listings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            ) : (
              <div className="mt-6">
                <EmptyState
                  title={isMe ? "You haven't listed any figures yet." : "No active listings"}
                  body={
                    isMe
                      ? "List a figure to start getting trade offers."
                      : "Check back later for new figures."
                  }
                  action={
                    isMe ? (
                      <Button asChild variant="hero">
                        <Link to="/listings/new">List a figure</Link>
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-bold">Reviews</h2>
            <div className="mt-6 space-y-1.5">
              {dist.map((d) => (
                <div key={d.n} className="flex items-center gap-3 text-xs">
                  <span className="w-6 text-muted-foreground">{d.n}★</span>
                  <div className="h-1.5 flex-1 bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: reviews.length ? `${(d.count / reviews.length) * 100}%` : 0 }}
                    />
                  </div>
                  <span className="w-4 text-right text-muted-foreground">{d.count}</span>
                </div>
              ))}
            </div>
            <ul className="mt-6 space-y-4">
              {reviews.map((r) => {
                const author = findCollector(state, r.authorId);
                return (
                  <li key={r.id} className="border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      {author ? (
                        <Link
                          to="/collectors/$username"
                          params={{ username: author.username }}
                          className="flex items-center gap-2 text-sm font-semibold hover:text-primary-glow"
                        >
                          <CollectorAvatar collector={author} size="sm" /> {author.displayName}
                        </Link>
                      ) : (
                        <span />
                      )}
                      <Stars value={r.rating} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{r.comment}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                  </li>
                );
              })}
              {reviews.length === 0 && (
                <li className="text-sm text-muted-foreground">No reviews yet.</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative size-24">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="butt"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
          className="stroke-primary"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-2xl font-black">
        {score}
      </span>
    </div>
  );
}
