import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  FileSignature,
  Plus,
  Repeat,
  ScanSearch,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/market/ListingCard";
import {
  CollectorAvatar,
  EmptyState,
  SectionHeading,
  Stars,
  TierBadge,
} from "@/components/market/bits";
import { findCollector, reputationFor, useMarket } from "@/lib/marketplace/store";
import { getTradePhase } from "@/lib/marketplace/trade-logic";
import { CATEGORIES } from "@/lib/marketplace/types";
import { formatDate } from "@/lib/format";
import { Advertisement, SponsoredBrands } from "@/components/site/Advertising";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MOTIONTRADES | Trade action figures with collectors you can trust" },
      {
        name: "description",
        content:
          "Trade action figures with other collectors. Both sides agree on the deal, ship at the same time and check everything before it's done.",
      },
      {
        property: "og:title",
        content: "MOTIONTRADES | Trade action figures with collectors you can trust",
      },
      {
        property: "og:description",
        content: "Built by a collector who got scammed, so you don't have to worry about it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  {
    icon: Repeat,
    title: "Make an offer",
    body: "Pick one or more of your figures to offer for theirs.",
  },
  {
    icon: FileSignature,
    title: "Sign the deal",
    body: "You both sign off on the figures, the accessories and the condition.",
  },
  {
    icon: Truck,
    title: "Ship together",
    body: "Pack it up and drop it off. Tracking starts once both boxes are moving.",
  },
  {
    icon: ScanSearch,
    title: "Check it over",
    body: "When yours shows up, go through every accessory on the list.",
  },
  {
    icon: ShieldCheck,
    title: "Leave a review",
    body: "Good trades build your rep, so the next one's even easier.",
  },
];

const promises = [
  "You both agree in writing on the figures, accessories and condition",
  "A packing checklist before anyone prints a label",
  "Nobody's package counts until both are dropped off",
  "You check every accessory when your figure arrives",
  "If something's off, report it and the trade freezes until it's fixed",
];

function Index() {
  const state = useMarket();
  const active = state.listings.filter((l) => l.status === "active");
  const fresh = [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const topCollectors = state.collectors
    .map((c) => ({ c, rep: reputationFor(state, c.id)! }))
    .filter(({ rep }) => rep.completedTrades > 0)
    .sort((a, b) => b.rep.score - a.rep.score)
    .slice(0, 4);

  // Public activity: new listings and completed trades. Private offer details stay off the homepage.
  const activity = [
    ...state.listings.map((l) => ({
      at: l.createdAt,
      who: findCollector(state, l.ownerId),
      text: `listed ${l.title}`,
      key: `l-${l.id}`,
    })),
    ...state.trades
      .filter((t) => getTradePhase(t, state.reports) === "completed")
      .map((t) => ({
        at: t.updatedAt,
        who: findCollector(state, t.proposerId),
        text: `completed a trade with ${findCollector(state, t.receiverId)?.displayName ?? "a collector"}`,
        key: `t-${t.id}`,
      })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  return (
    <div>
      {/* Introduction */}
      <section className="relative overflow-hidden border-b bg-surface">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.15fr_1fr]">
          <div className="animate-rise">
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              Trade your figures without worrying about getting{" "}
              <span className="text-primary">scammed.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-muted-foreground sm:text-lg">
              I lost figures I loved to a bad trade once, so I built this. You and the other
              collector agree on exactly what's being swapped, ship at the same time, and check
              everything before the trade is done.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/listings/new">
                  <Plus /> {active.length ? "List a figure" : "Create the first listing"}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/safety">How trading works</Link>
              </Button>
            </div>
          </div>

          <div className="clip-chamfer animate-rise border bg-card p-6 shadow-card [animation-delay:120ms] sm:p-8">
            <p className="font-bold">Every trade on here gets:</p>
            <ul className="mt-5 space-y-4">
              {promises.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
              Labels are bought right on the site, so neither of you ships until you're both ready.
            </p>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-b bg-surface">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-4 sm:px-6">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              to="/browse"
              search={{ category: c }}
              className="clip-chamfer-sm shrink-0 border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {c}
            </Link>
          ))}
        </div>
      </section>

      {/* Latest listings */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          title="Just listed"
          action={
            fresh.length > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link to="/browse">
                  View all <ArrowRight />
                </Link>
              </Button>
            )
          }
        />
        <div className="mt-8">
          {fresh.length ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {fresh.map((l) => (
                <ListingCard key={l.id} listing={l} owner={findCollector(state, l.ownerId)} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing listed yet."
              body="We just opened. List something and you'll be the first figure people see."
              action={
                <Button asChild variant="hero">
                  <Link to="/listings/new">
                    <Plus /> Create the first listing
                  </Link>
                </Button>
              }
            />
          )}
        </div>
      </section>

      {/* How it works */}
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <Advertisement placement="home-marketplace" />
      </div>
      <SponsoredBrands />

      <section className="border-y bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading
            title="How a trade works"
            action={
              <Button asChild variant="link">
                <Link to="/safety">
                  The full safety rundown <ArrowRight />
                </Link>
              </Button>
            }
          />
          <ol className="mt-10 grid gap-px overflow-hidden border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.title} className="relative bg-card p-6">
                <span className="text-sm font-bold text-primary">{i + 1}</span>
                <s.icon className="mt-4 size-6 text-foreground" />
                <h3 className="mt-4 text-sm font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Recent activity */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading title="What's happening" />
        <div className="mt-8">
          {activity.length ? (
            <ul className="divide-y border bg-card">
              {activity.map((a) => (
                <li key={a.key} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {a.who && <CollectorAvatar collector={a.who} size="sm" />}
                  <p className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{a.who?.displayName ?? "A collector"}</span>{" "}
                    <span className="text-muted-foreground">{a.text}</span>
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Pretty quiet so far."
              body="New listings and finished trades will pop up here."
            />
          )}
        </div>
      </section>

      {/* Top collectors — only once real trades have been completed */}
      {topCollectors.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <SectionHeading title="Collectors with the best rep" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topCollectors.map(({ c, rep }) => (
              <Link
                key={c.id}
                to="/collectors/$username"
                params={{ username: c.username }}
                className="clip-chamfer group border bg-card p-5 transition-colors hover:border-primary/60"
              >
                <div className="flex items-center gap-3">
                  <CollectorAvatar collector={c} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold group-hover:text-primary-glow">
                      {c.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">@{c.username}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="font-display text-3xl font-black">{rep.score}</p>
                    <p className="text-xs font-medium text-muted-foreground">Rep score</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <TierBadge tier={rep.tier} />
                    <Stars value={rep.avgRating} />
                  </div>
                </div>
                <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                  {rep.completedTrades} completed trades
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
