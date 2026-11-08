// Server-side trade actions: WHO may do each step, on top of the trade rules in
// trade-logic.ts. Pure functions (no database, no network), so the same code runs
// in the Supabase edge function and in unit tests.
import * as logic from "./trade-logic";
import type { Inspection, Listing, Report, ReportCategory, Review, Side, Trade } from "./types";

export class ActionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export type TradeStepAction =
  | { action: "accept"; tradeId: string }
  | { action: "decline"; tradeId: string }
  | { action: "withdraw"; tradeId: string }
  | { action: "sign"; tradeId: string }
  | { action: "label"; tradeId: string; checklist: string[] }
  | { action: "dropOff"; tradeId: string }
  | { action: "carrierScan"; tradeId: string }
  | { action: "confirmDelivery"; tradeId: string }
  | {
      action: "inspect";
      tradeId: string;
      result: Inspection["result"];
      checkedAccessories: string[];
      notes: string;
    };

export type ActionRequest =
  | TradeStepAction
  | {
      action: "propose";
      receiverId: string;
      offeredListingIds: string[];
      requestedListingIds: string[];
      message: string;
    }
  | { action: "review"; tradeId: string; rating: number; comment: string }
  | {
      action: "report";
      targetType: Report["targetType"];
      targetId: string;
      category: ReportCategory;
      description: string;
      desiredResolution: string;
    }
  | { action: "advanceReport"; reportId: string };

const TRADE_STEP_ACTIONS = new Set([
  "accept",
  "decline",
  "withdraw",
  "sign",
  "label",
  "dropOff",
  "carrierScan",
  "confirmDelivery",
  "inspect",
]);

export const isTradeStep = (r: ActionRequest): r is TradeStepAction =>
  TRADE_STEP_ACTIONS.has(r.action);

const REPORT_CATEGORIES = Object.keys(logic.REPORT_CATEGORY_LABELS) as ReportCategory[];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, maxItems: number, maxLen: number) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .slice(0, maxItems)
        .map((x) => x.slice(0, maxLen))
    : [];

/** Turn untrusted JSON into a well-formed request, or throw. */
export function parseRequest(body: unknown): ActionRequest {
  if (!body || typeof body !== "object") throw new ActionError("Bad request");
  const b = body as Record<string, unknown>;
  const action = b["action"];
  const tradeId = str(b["tradeId"], 40);
  switch (action) {
    case "accept":
    case "decline":
    case "withdraw":
    case "sign":
    case "dropOff":
    case "carrierScan":
    case "confirmDelivery":
      if (!tradeId) throw new ActionError("Missing trade");
      return { action, tradeId };
    case "label":
      if (!tradeId) throw new ActionError("Missing trade");
      return { action, tradeId, checklist: strList(b["checklist"], 20, 200) };
    case "inspect": {
      if (!tradeId) throw new ActionError("Missing trade");
      const result = b["result"];
      if (result !== "approved" && result !== "issue")
        throw new ActionError("Bad inspection result");
      return {
        action,
        tradeId,
        result,
        checkedAccessories: strList(b["checkedAccessories"], 60, 120),
        notes: str(b["notes"], 1000),
      };
    }
    case "propose": {
      const receiverId = str(b["receiverId"], 64);
      const offeredListingIds = strList(b["offeredListingIds"], 10, 64);
      const requestedListingIds = strList(b["requestedListingIds"], 10, 64);
      if (!receiverId) throw new ActionError("Missing collector");
      if (!offeredListingIds.length || !requestedListingIds.length) {
        throw new ActionError("Pick at least one figure on each side");
      }
      return {
        action,
        receiverId,
        offeredListingIds,
        requestedListingIds,
        message: str(b["message"], 1000),
      };
    }
    case "review": {
      const rating = Number(b["rating"]);
      if (!tradeId) throw new ActionError("Missing trade");
      if (!Number.isInteger(rating) || rating < 1 || rating > 5)
        throw new ActionError("Rating must be 1 to 5 stars");
      return { action, tradeId, rating, comment: str(b["comment"], 1000) };
    }
    case "report": {
      const targetType = b["targetType"];
      const category = b["category"];
      if (targetType !== "trade" && targetType !== "listing" && targetType !== "collector") {
        throw new ActionError("Bad report target");
      }
      if (typeof category !== "string" || !REPORT_CATEGORIES.includes(category as ReportCategory)) {
        throw new ActionError("Pick what went wrong");
      }
      const description = str(b["description"], 2000);
      if (description.length < 10)
        throw new ActionError("Describe the problem in at least 10 characters");
      const targetId = str(b["targetId"], 64);
      if (!targetId) throw new ActionError("Missing report target");
      return {
        action,
        targetType,
        targetId,
        category: category as ReportCategory,
        description,
        desiredResolution: str(b["desiredResolution"], 500),
      };
    }
    case "advanceReport": {
      const reportId = str(b["reportId"], 64);
      if (!reportId) throw new ActionError("Missing report");
      return { action, reportId };
    }
    default:
      throw new ActionError("Unknown action");
  }
}

/** The caller's side of the trade, or a 403 if they aren't in it. */
export function requireSide(trade: Trade, userId: string): Side {
  const side = logic.sideOf(trade, userId);
  if (!side) throw new ActionError("You're not part of this trade", 403);
  return side;
}

/** Run one trade step as `userId`. The caller can only act for their own side. */
export function applyTradeStep(
  trade: Trade,
  userId: string,
  req: TradeStepAction,
  at: string,
  trackingCode: string,
): Trade {
  const mine = requireSide(trade, userId);
  const theirs = logic.otherSide(mine);
  try {
    switch (req.action) {
      case "accept":
        return logic.acceptOffer(trade, userId, at);
      case "decline":
        return logic.declineOffer(trade, userId, at);
      case "withdraw":
        return logic.withdrawOffer(trade, userId, at);
      case "sign":
        return logic.signAgreement(trade, mine, at);
      case "label":
        return logic.generateLabel(trade, mine, req.checklist, at, trackingCode);
      case "dropOff":
        return logic.markDroppedOff(trade, mine, at);
      case "carrierScan":
        return logic.advanceCarrier(trade, mine, at);
      // Delivery and inspection are done by the RECIPIENT of the other side's package.
      case "confirmDelivery":
        return logic.confirmDelivery(trade, theirs, at);
      case "inspect":
        return logic.submitInspection(trade, theirs, {
          result: req.result,
          checkedAccessories: req.checkedAccessories,
          notes: req.notes,
          at,
        });
    }
  } catch (e) {
    if (e instanceof ActionError) throw e;
    throw new ActionError((e as Error).message, 409);
  }
}

/** Build a new offer after checking both sides' figures are real, active and owned by the right people. */
export function buildProposal(input: {
  id: string;
  proposerId: string;
  receiverId: string;
  offered: Listing[];
  requested: Listing[];
  offeredIds: string[];
  requestedIds: string[];
  message: string;
  at: string;
}): Trade {
  const { id, proposerId, receiverId, offered, requested, at } = input;
  if (proposerId === receiverId) throw new ActionError("You can't trade with yourself");
  const check = (ids: string[], found: Listing[], owner: string, whose: string) => {
    if (new Set(ids).size !== ids.length) throw new ActionError("The same figure was picked twice");
    for (const lid of ids) {
      const l = found.find((x) => x.id === lid);
      if (!l || l.ownerId !== owner)
        throw new ActionError(`One of ${whose} figures wasn't found`, 404);
      if (l.status !== "active")
        throw new ActionError(`"${l.title}" isn't available for trade right now`, 409);
    }
  };
  check(input.offeredIds, offered, proposerId, "your");
  check(input.requestedIds, requested, receiverId, "their");
  const byId = (list: Listing[], ids: string[]) => ids.map((x) => list.find((l) => l.id === x)!);
  const fresh = () => ({
    stage: "awaiting_agreement" as const,
    history: [{ stage: "awaiting_agreement" as const, at }],
    packingChecklist: [],
  });
  return {
    id,
    proposerId,
    receiverId,
    proposerItems: byId(offered, input.offeredIds).map(logic.toTradeItem),
    receiverItems: byId(requested, input.requestedIds).map(logic.toTradeItem),
    message: input.message,
    status: "pending",
    createdAt: at,
    updatedAt: at,
    shipments: { proposer: fresh(), receiver: fresh() },
    timeline: [{ at, actorId: proposerId, message: "proposed a trade" }],
    reviewedBy: [],
  };
}

export const tradeListingIds = (t: Trade) =>
  [...t.proposerItems, ...t.receiverItems].map((i) => i.listingId);

/** Adds the "trade complete" line once both inspections are approved. Returns null if not newly complete. */
export function markCompleteIfDone(trade: Trade, reports: Report[], at: string): Trade | null {
  if (logic.getTradePhase(trade, reports) !== "completed") return null;
  if (trade.timeline.some((e) => e.message.startsWith("Both sides approved"))) return null;
  return {
    ...trade,
    updatedAt: at,
    timeline: [...trade.timeline, { at, message: "Both sides approved. Trade complete!" }],
  };
}

/** Check a review is allowed, and return the review row plus the updated trade. */
export function buildReview(
  trade: Trade,
  userId: string,
  reports: Report[],
  rating: number,
  comment: string,
  at: string,
): { review: Omit<Review, "id">; trade: Trade } {
  const mine = requireSide(trade, userId);
  if (logic.getTradePhase(trade, reports) !== "completed")
    throw new ActionError("You can review once the trade is complete", 409);
  if (trade.reviewedBy.includes(userId))
    throw new ActionError("You already reviewed this trade", 409);
  const other = logic.collectorIdFor(trade, logic.otherSide(mine));
  return {
    review: {
      collectorId: other,
      authorId: userId,
      tradeId: trade.id,
      rating: rating as Review["rating"],
      comment,
      createdAt: at,
    },
    trade: { ...trade, reviewedBy: [...trade.reviewedBy, userId] },
  };
}

/** Timeline line added to a trade when someone reports a problem on it. */
export function noteReportOnTrade(
  trade: Trade,
  userId: string,
  category: ReportCategory,
  at: string,
): Trade {
  requireSide(trade, userId);
  return {
    ...trade,
    updatedAt: at,
    timeline: [
      ...trade.timeline,
      {
        at,
        actorId: userId,
        message: `reported a problem: ${logic.REPORT_CATEGORY_LABELS[category]}`,
      },
    ],
  };
}

/** Safety team moves a report forward: open, then under review, then resolved. */
export function advanceReportState(report: Report, at: string): Report {
  if (report.status === "resolved") throw new ActionError("This report is already resolved", 409);
  const status = report.status === "open" ? "under_review" : "resolved";
  const message =
    status === "under_review"
      ? "Trade safety team is reviewing packing photos from both sides."
      : `Resolved: ${report.desiredResolution || "both collectors agreed on a resolution"}.`;
  return { ...report, status, updates: [...report.updates, { at, message }] };
}

/** When a trade report is resolved, flagged inspections count as approved so the trade can close. */
export function resolveTradeAfterReport(trade: Trade, at: string): Trade {
  const shipments = { ...trade.shipments };
  (["proposer", "receiver"] as Side[]).forEach((side) => {
    const sh = shipments[side];
    if (sh.inspection?.result === "issue") {
      shipments[side] = {
        ...sh,
        inspection: {
          ...sh.inspection,
          result: "approved",
          notes: `${sh.inspection.notes} (Resolved through a report.)`,
        },
      };
    }
  });
  return {
    ...trade,
    shipments,
    updatedAt: at,
    timeline: [...trade.timeline, { at, message: "Problem report resolved" }],
  };
}

export const newTradeId = () => `t-${Math.random().toString(36).slice(2, 8)}`;
export const newTrackingCode = () => `MT-${Math.floor(100000 + Math.random() * 899999)}`;
