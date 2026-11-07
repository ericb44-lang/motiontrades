import { Link } from "@tanstack/react-router";
import { ArrowRight, Repeat } from "lucide-react";
import { CollectorAvatar, FigureImage, PhaseBadge } from "@/components/market/bits";
import { findCollector, useMarket } from "@/lib/marketplace/store";
import { getNextAction, getTradePhase, otherSide, sideOf, itemsSentBy } from "@/lib/marketplace/trade-logic";
import type { Trade, TradeItem } from "@/lib/marketplace/types";
import { formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

function Thumbs({ items }: { items: TradeItem[] }) {
  return (
    <div className="flex -space-x-3">
      {items.slice(0, 3).map((i) => (
        <div key={i.listingId} className="size-12 overflow-hidden border-2 border-card bg-surface sm:size-14">
          <FigureImage src={i.image} alt={i.title} />
        </div>
      ))}
    </div>
  );
}

export function TradeRow({ trade }: { trade: Trade }) {
  const state = useMarket();
  const me = sideOf(trade, state.currentUserId ?? "")!;
  const them = otherSide(me);
  const other = findCollector(state, me === "proposer" ? trade.receiverId : trade.proposerId)!;
  const phase = getTradePhase(trade, state.reports);
  const next = getNextAction(trade, state.currentUserId ?? "", state.reports);
  const youGive = itemsSentBy(trade, me);
  const youGet = itemsSentBy(trade, them);

  return (
    <Link
      to="/trades/$id"
      params={{ id: trade.id }}
      className={cn(
        "group grid items-center gap-4 border bg-card p-4 transition-colors hover:border-primary/60 md:grid-cols-[auto_1fr_auto]",
        next.actor === "you" && "border-l-2 border-l-primary",
      )}
    >
      <div className="flex items-center gap-3">
        <Thumbs items={youGive} />
        <Repeat className="size-4 shrink-0 text-primary" />
        <Thumbs items={youGet} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">#{trade.id.replace("t-", "")}</span>
          <PhaseBadge phase={phase} />
          {me === "receiver" && phase === "offer" && <span className="text-xs text-warning">Incoming</span>}
        </div>
        <p className="mt-1 truncate text-sm font-semibold">
          {youGive.map((i) => i.title).join(", ")} <span className="text-muted-foreground">for</span>{" "}
          {youGet.map((i) => i.title).join(", ")}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <CollectorAvatar collector={other} size="sm" className="size-5 text-[0.5rem]" />
          <span>with {other.displayName}</span>
          <span>· Updated {formatShort(trade.updatedAt)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className={cn("text-sm", next.actor === "you" ? "font-semibold text-primary-glow" : "text-muted-foreground")}>
          {next.label}
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
      </div>
    </Link>
  );
}
