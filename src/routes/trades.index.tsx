import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  PackageSearch,
  Repeat,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, TierBadge } from "@/components/market/bits";
import { RequireCollector } from "@/components/market/RequireCollector";
import { TradeRow } from "@/components/trade/TradeRow";
import { REPORT_CATEGORY_LABELS, reputationFor, useMarket } from "@/lib/marketplace/store";
import { getNextAction, getTradePhase, isClosedPhase, sideOf } from "@/lib/marketplace/trade-logic";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/trades/")({
  head: () => ({
    meta: [
      { title: "My trades | MOTIONTRADES" },
      {
        name: "description",
        content:
          "Track offers, agreements, shipping, inspections and reports across all your trades.",
      },
      { property: "og:title", content: "My trades | MOTIONTRADES" },
      {
        property: "og:description",
        content: "Every offer, agreement, shipment and inspection in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TradesDashboard,
});

function TradesDashboard() {
  return (
    <RequireCollector body="Make a quick profile first, then you can start trading.">
      {(c) => <Dashboard me={c.id} username={c.username} />}
    </RequireCollector>
  );
}

function Dashboard({ me, username }: { me: string; username: string }) {
  const state = useMarket();
  const rep = reputationFor(state, me)!;

  const groups = useMemo(() => {
    const mine = state.trades
      .filter((t) => sideOf(t, me))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const withPhase = mine.map((t) => ({
      t,
      phase: getTradePhase(t, state.reports),
      next: getNextAction(t, me, state.reports),
    }));
    return {
      action: withPhase.filter((x) => x.next.actor === "you").map((x) => x.t),
      incoming: withPhase
        .filter((x) => x.phase === "offer" && x.t.receiverId === me)
        .map((x) => x.t),
      outgoing: withPhase
        .filter((x) => x.phase === "offer" && x.t.proposerId === me)
        .map((x) => x.t),
      active: withPhase
        .filter((x) => !isClosedPhase(x.phase) && x.phase !== "offer")
        .map((x) => x.t),
      transit: withPhase.filter((x) => x.phase === "shipping" || x.phase === "in_transit").length,
      completed: withPhase.filter((x) => x.phase === "completed").map((x) => x.t),
      closed: withPhase
        .filter((x) => x.phase === "declined" || x.phase === "withdrawn")
        .map((x) => x.t),
      all: mine.length,
    };
  }, [state.trades, state.reports, me]);

  const myReports = state.reports.filter((r) => r.reporterId === me);

  const stats = [
    { icon: Zap, label: "Needs your action", value: groups.action.length, accent: true },
    { icon: Inbox, label: "Open offers", value: groups.incoming.length + groups.outgoing.length },
    { icon: PackageSearch, label: "Shipping & transit", value: groups.transit },
    { icon: CheckCircle2, label: "Completed", value: groups.completed.length },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">My trades</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/browse">
            <Repeat /> Find a trade
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_300px]">
        <dl className="grid grid-cols-2 gap-px overflow-hidden border bg-border md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card p-5">
              <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <s.icon className={s.accent ? "size-3.5 text-primary" : "size-3.5"} /> {s.label}
              </dt>
              <dd
                className={
                  s.accent && s.value
                    ? "mt-2 font-display text-3xl font-black text-primary-glow"
                    : "mt-2 font-display text-3xl font-black"
                }
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
        <Link
          to="/collectors/$username"
          params={{ username }}
          className="clip-chamfer flex items-center justify-between gap-4 border border-primary/30 bg-gradient-to-br from-primary/15 to-card p-5 hover:border-primary"
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground">Your reputation</p>
            <p className="mt-1 font-display text-4xl font-black">{rep.score}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <TierBadge tier={rep.tier} />
            <span className="text-xs text-muted-foreground">
              {rep.completedTrades} trades · {rep.avgRating.toFixed(1)}★
            </span>
          </div>
        </Link>
      </div>

      {groups.all === 0 && (
        <div className="mt-10">
          <EmptyState
            title="No trades yet."
            body="Find a figure you want and make an offer. Everything about your trades shows up here."
            action={
              <Button asChild variant="hero">
                <Link to="/browse">
                  <Repeat /> Browse figures
                </Link>
              </Button>
            }
          />
        </div>
      )}

      {(groups.all > 0 || myReports.length > 0) && (
        <Tabs defaultValue={groups.action.length ? "action" : "active"} className="mt-10">
          <TabsList className="h-auto w-full flex-wrap justify-start bg-surface">
            <TabsTrigger value="action">
              Action needed <Count n={groups.action.length} hot />
            </TabsTrigger>
            <TabsTrigger value="offers">
              Offers <Count n={groups.incoming.length + groups.outgoing.length} />
            </TabsTrigger>
            <TabsTrigger value="active">
              Active <Count n={groups.active.length} />
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed <Count n={groups.completed.length} />
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed <Count n={groups.closed.length} />
            </TabsTrigger>
            <TabsTrigger value="reports">
              Reports <Count n={myReports.length} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="action" className="mt-6">
            <List
              trades={groups.action}
              empty="You're all caught up. Nothing needs your attention right now."
            />
          </TabsContent>
          <TabsContent value="offers" className="mt-6 space-y-8">
            {groups.incoming.length + groups.outgoing.length === 0 ? (
              <EmptyState
                title="No offers yet."
                body="Offers you send or receive will show up here."
              />
            ) : (
              <>
                <div>
                  <h2 className="eyebrow mb-3">Incoming · {groups.incoming.length}</h2>
                  <List trades={groups.incoming} empty="No incoming offers yet." />
                </div>
                <div>
                  <h2 className="eyebrow mb-3">Sent · {groups.outgoing.length}</h2>
                  <List
                    trades={groups.outgoing}
                    empty="You haven't sent any offers. Browse listings to propose one."
                  />
                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="active" className="mt-6">
            <List trades={groups.active} empty="You don't have any active trades yet." />
          </TabsContent>
          <TabsContent value="completed" className="mt-6">
            <List trades={groups.completed} empty="No completed trades yet." />
          </TabsContent>
          <TabsContent value="closed" className="mt-6">
            <List trades={groups.closed} empty="No declined or withdrawn offers." />
          </TabsContent>
          <TabsContent value="reports" className="mt-6 space-y-3">
            {myReports.length === 0 && (
              <EmptyState
                title="No reports"
                body="Problems you report on trades or listings show up here."
              />
            )}
            {myReports.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-4 border bg-card p-4">
                <AlertTriangle className="size-5 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{REPORT_CATEGORY_LABELS[r.category]}</p>
                  <p className="truncate text-sm text-muted-foreground">{r.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.targetType === "trade"
                      ? `Trade #${r.targetId.replace("t-", "")}`
                      : `Listing ${r.targetId}`}{" "}
                    · Filed {formatDate(r.createdAt)}
                  </p>
                </div>
                <Badge
                  variant={
                    r.status === "resolved"
                      ? "success"
                      : r.status === "under_review"
                        ? "warning"
                        : "destructive"
                  }
                >
                  {r.status.replace("_", " ")}
                </Badge>
                {r.targetType === "trade" && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/trades/$id" params={{ id: r.targetId }}>
                      View trade
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}

      <div className="mt-12 flex items-start gap-3 border border-dashed p-5 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          Every trade follows the same path: written agreement → packing checklist → dual drop-off →
          tracking → delivery confirmation → inspection.{" "}
          <Link to="/safety" className="text-primary-glow underline-offset-4 hover:underline">
            How trade safety works
          </Link>
        </p>
      </div>
    </div>
  );
}

function Count({ n, hot }: { n: number; hot?: boolean }) {
  if (!n) return null;
  return (
    <span
      className={
        hot
          ? "ml-1.5 rounded-full bg-primary px-1.5 text-[0.65rem] text-primary-foreground"
          : "ml-1.5 text-xs text-muted-foreground"
      }
    >
      {n}
    </span>
  );
}

function List({
  trades,
  empty,
}: {
  trades: import("@/lib/marketplace/types").Trade[];
  empty: string;
}) {
  if (!trades.length) return <EmptyState title="Nothing here" body={empty} />;
  return (
    <div className="space-y-3">
      {trades.map((t) => (
        <TradeRow key={t.id} trade={t} />
      ))}
    </div>
  );
}
