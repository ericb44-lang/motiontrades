import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check, Flag, MessageSquare, Repeat, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CollectorAvatar,
  CollectorLink,
  EmptyState,
  PhaseBadge,
  Stars,
  TierBadge,
} from "@/components/market/bits";
import { ReportDialog } from "@/components/market/ReportDialog";
import {
  AgreementPanel,
  Panel,
  ReportsPanel,
  ReviewPanel,
  ShipmentPanel,
  Timeline,
  TwoSides,
} from "@/components/trade/panels";
import {
  findCollector,
  market,
  reputationFor,
  useMarket,
  useMarketHydrated,
} from "@/lib/marketplace/store";
import {
  getNextAction,
  getTradePhase,
  otherSide,
  sideOf,
  type TradePhase,
} from "@/lib/marketplace/trade-logic";
import type { Side } from "@/lib/marketplace/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trades/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Trade #${params.id.replace("t-", "")} | MOTIONTRADES` },
      {
        name: "description",
        content: "Trade agreement, two-way shipping, delivery confirmation and inspection.",
      },
      { property: "og:title", content: `Trade #${params.id.replace("t-", "")} | MOTIONTRADES` },
      { property: "og:description", content: "Follow this trade from agreement to inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TradePage,
});

const STEPS: { key: TradePhase; label: string }[] = [
  { key: "offer", label: "Offer" },
  { key: "agreement", label: "Agreement" },
  { key: "shipping", label: "Shipping" },
  { key: "in_transit", label: "In transit" },
  { key: "inspection", label: "Inspection" },
  { key: "completed", label: "Complete" },
];

function TradePage() {
  const { id } = Route.useParams();
  const state = useMarket();
  const hydrated = useMarketHydrated();
  const trade = state.trades.find((t) => t.id === id);
  const mySide = trade && state.currentUserId ? sideOf(trade, state.currentUserId) : null;

  if (!trade || !mySide) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {hydrated ? (
          <EmptyState
            title="Trade not found"
            body="This trade doesn't exist or you're not part of it."
            action={
              <Button asChild variant="outline">
                <Link to="/trades">Back to My Trades</Link>
              </Button>
            }
          />
        ) : (
          <Skeleton className="h-96" />
        )}
      </div>
    );
  }

  const theirSide = otherSide(mySide);
  const people: Record<Side, NonNullable<ReturnType<typeof findCollector>>> = {
    proposer: findCollector(state, trade.proposerId)!,
    receiver: findCollector(state, trade.receiverId)!,
  };
  const other = people[theirSide];
  const rep = reputationFor(state, other.id)!;
  const phase = getTradePhase(trade, state.reports);
  const next = getNextAction(trade, state.currentUserId ?? "", state.reports);
  const reports = state.reports.filter((r) => r.targetType === "trade" && r.targetId === trade.id);
  const names = { proposer: people.proposer.displayName, receiver: people.receiver.displayName };
  const nameOf = (cid?: string) =>
    cid === state.currentUserId ? "You" : state.collectors.find((c) => c.id === cid)?.displayName;
  const stepIdx = STEPS.findIndex((s) => s.key === phase);
  const accepted = trade.status === "accepted";

  const respond = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        to="/trades"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> My Trades
      </Link>

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black sm:text-3xl">Trade #{trade.id.replace("t-", "")}</h1>
            <PhaseBadge phase={phase} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {mySide === "proposer" ? "You proposed to " : "Proposed by "}
            <CollectorLink collector={other} /> · {formatDate(trade.createdAt)}
          </p>
        </div>
        {accepted && phase !== "completed" && (
          <ReportDialog targetType="trade" targetId={trade.id}>
            <Button variant="outline" size="sm">
              <Flag /> Report a problem
            </Button>
          </ReportDialog>
        )}
      </div>

      {/* Progress */}
      {stepIdx >= 0 && (
        <ol className="mt-8 grid grid-cols-6 gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <div className={cn("h-1", i <= stepIdx ? "bg-primary" : "bg-muted")} />
              <p
                className={cn(
                  "mt-2 hidden text-xs font-semibold sm:block",
                  i <= stepIdx ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </p>
            </li>
          ))}
        </ol>
      )}

      {/* Next action banner */}
      <div
        className={cn(
          "mt-6 flex items-center gap-3 border p-4",
          phase === "disputed"
            ? "border-destructive/50 bg-destructive/10"
            : next.actor === "you"
              ? "border-primary/50 bg-primary/10"
              : "bg-surface",
        )}
      >
        {phase === "disputed" ? (
          <AlertTriangle className="size-5 text-destructive" />
        ) : (
          <span
            className={cn(
              "size-2",
              next.actor === "you" ? "bg-primary animate-pulse-crimson" : "bg-muted-foreground",
            )}
          />
        )}
        <p className="font-semibold">
          {next.actor === "you" ? "Your move: " : ""}
          {next.label}
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Offer stage */}
          {!accepted && (
            <Panel title={phase === "offer" ? "Trade offer" : "Offer"} icon={Repeat}>
              <TwoSides trade={trade} names={names} />
              {trade.message && (
                <div className="mt-6 flex gap-3 border-t pt-5 text-sm">
                  <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-muted-foreground">“{trade.message}”</p>
                </div>
              )}
              {phase === "offer" && (
                <div className="mt-6 flex flex-wrap gap-3 border-t pt-5">
                  {mySide === "receiver" ? (
                    <>
                      <Button
                        variant="hero"
                        onClick={() =>
                          void respond(
                            () => market.acceptOffer(trade.id),
                            "Offer accepted. Your agreement is ready.",
                          )
                        }
                      >
                        <Check /> Accept offer
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void respond(() => market.declineOffer(trade.id), "Offer declined")
                        }
                      >
                        <X /> Decline
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void respond(() => market.withdrawOffer(trade.id), "Offer withdrawn")
                      }
                    >
                      <X /> Withdraw offer
                    </Button>
                  )}
                </div>
              )}
            </Panel>
          )}

          {accepted && trade.agreement && (
            <AgreementPanel trade={trade} mySide={mySide} people={people} />
          )}

          {accepted && (
            <div className="grid gap-6 xl:grid-cols-2">
              <ShipmentPanel trade={trade} senderSide={mySide} mySide={mySide} people={people} />
              <ShipmentPanel trade={trade} senderSide={theirSide} mySide={mySide} people={people} />
            </div>
          )}

          <ReportsPanel reports={reports} />

          {phase === "completed" && (
            <ReviewPanel
              trade={trade}
              otherName={other.displayName}
              reviewed={trade.reviewedBy.includes(state.currentUserId ?? "")}
            />
          )}
        </div>

        <aside className="space-y-6">
          <div className="clip-chamfer border bg-card p-5">
            <p className="eyebrow mb-4">Trading with</p>
            <div className="flex items-center gap-3">
              <CollectorAvatar collector={other} size="lg" />
              <div className="min-w-0">
                <CollectorLink collector={other} />
                <p className="text-xs text-muted-foreground">{other.region}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <TierBadge tier={rep.tier} />
                </div>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t pt-4 text-center">
              <div>
                <dt className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                  Rep
                </dt>
                <dd className="font-display text-lg font-bold">{rep.score}</dd>
              </div>
              <div>
                <dt className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                  Trades
                </dt>
                <dd className="font-display text-lg font-bold">{rep.completedTrades}</dd>
              </div>
              <div>
                <dt className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                  Rating
                </dt>
                <dd className="pt-1">
                  <Stars value={rep.avgRating} className="justify-center" />
                </dd>
              </div>
            </dl>
          </div>

          <div className="border bg-card p-5">
            <p className="eyebrow mb-4">Activity</p>
            <Timeline trade={trade} nameOf={nameOf} />
          </div>
        </aside>
      </div>
    </div>
  );
}
