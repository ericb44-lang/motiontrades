// Pure trade rules. No storage, no React — so the same rules can run on a
// future server and be unit tested in isolation.
import {
  SHIP_STAGES,
  type Agreement,
  type Collector,
  type Inspection,
  type Listing,
  type Report,
  type Review,
  type ShipStage,
  type Shipment,
  type Side,
  type Trade,
  type TradeItem,
} from "./types";

export const SHIP_WINDOW_DAYS = 5;
export const INSPECTION_WINDOW_HOURS = 48;

export const PACKING_CHECKLIST = [
  "Figure wrapped in protective sleeve or bubble wrap",
  "Every accessory listed in the agreement is bagged and included",
  "Photos taken of the figure and accessories before sealing",
  "Condition matches what is written in the agreement",
  "Box is rigid and items cannot shift inside",
] as const;

export const SHIP_STAGE_LABELS: Record<ShipStage, string> = {
  awaiting_agreement: "Awaiting agreement",
  packing: "Packing & photos",
  label_created: "Label created",
  dropped_off: "Dropped off",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

export type TradePhase =
  | "offer"
  | "declined"
  | "withdrawn"
  | "agreement"
  | "shipping"
  | "in_transit"
  | "inspection"
  | "disputed"
  | "completed";

export const PHASE_LABELS: Record<TradePhase, string> = {
  offer: "Offer pending",
  declined: "Declined",
  withdrawn: "Withdrawn",
  agreement: "Agreement",
  shipping: "Shipping",
  in_transit: "In transit",
  inspection: "Inspection",
  disputed: "Problem reported",
  completed: "Completed",
};

export const otherSide = (side: Side): Side => (side === "proposer" ? "receiver" : "proposer");

export function sideOf(trade: Trade, userId: string): Side | null {
  if (trade.proposerId === userId) return "proposer";
  if (trade.receiverId === userId) return "receiver";
  return null;
}

export const collectorIdFor = (trade: Trade, side: Side) =>
  side === "proposer" ? trade.proposerId : trade.receiverId;

export const itemsSentBy = (trade: Trade, side: Side): TradeItem[] =>
  side === "proposer" ? trade.proposerItems : trade.receiverItems;

export const stageIndex = (stage: ShipStage) => SHIP_STAGES.indexOf(stage);

export const hasReached = (shipment: Shipment, stage: ShipStage) =>
  stageIndex(shipment.stage) >= stageIndex(stage);

export const bothSigned = (trade: Trade) =>
  Boolean(trade.agreement?.signatures.proposer && trade.agreement?.signatures.receiver);

export const openReportsFor = (trade: Trade, reports: Report[]) =>
  reports.filter((r) => r.targetType === "trade" && r.targetId === trade.id && r.status !== "resolved");

export function getTradePhase(trade: Trade, reports: Report[] = []): TradePhase {
  if (trade.status === "pending") return "offer";
  if (trade.status === "declined") return "declined";
  if (trade.status === "withdrawn") return "withdrawn";
  if (openReportsFor(trade, reports).length > 0) return "disputed";
  if (!bothSigned(trade)) return "agreement";
  const { proposer, receiver } = trade.shipments;
  if (proposer.inspection?.result === "approved" && receiver.inspection?.result === "approved") {
    return "completed";
  }
  if (hasReached(proposer, "delivered") && hasReached(receiver, "delivered")) return "inspection";
  if (hasReached(proposer, "dropped_off") && hasReached(receiver, "dropped_off")) return "in_transit";
  return "shipping";
}

export const isClosedPhase = (phase: TradePhase) =>
  phase === "declined" || phase === "withdrawn" || phase === "completed";

export interface NextAction {
  actor: "you" | "them" | "none";
  label: string;
}

/** What the given user should do next on this trade (or who we are waiting on). */
export function getNextAction(trade: Trade, userId: string, reports: Report[] = []): NextAction {
  const me = sideOf(trade, userId);
  if (!me) return { actor: "none", label: "Not your trade" };
  const them = otherSide(me);
  const phase = getTradePhase(trade, reports);

  switch (phase) {
    case "offer":
      return me === "receiver"
        ? { actor: "you", label: "Review this trade offer" }
        : { actor: "them", label: "Waiting for a response to your offer" };
    case "declined":
      return { actor: "none", label: "Offer was declined" };
    case "withdrawn":
      return { actor: "none", label: "Offer was withdrawn" };
    case "disputed":
      return { actor: "none", label: "Problem report under review" };
    case "agreement":
      return trade.agreement?.signatures[me]
        ? { actor: "them", label: "Waiting for the other collector to sign" }
        : { actor: "you", label: "Sign the written trade agreement" };
    case "completed":
      return trade.reviewedBy.includes(userId)
        ? { actor: "none", label: "Trade complete" }
        : { actor: "you", label: "Leave a review for this trade" };
  }

  const mine = trade.shipments[me];
  const incoming = trade.shipments[them];

  if (mine.stage === "packing") return { actor: "you", label: "Complete the packing checklist" };
  if (mine.stage === "label_created") return { actor: "you", label: "Drop off your package" };
  if (hasReached(incoming, "delivered") && !incoming.deliveryConfirmedAt) {
    return { actor: "you", label: "Confirm your package arrived" };
  }
  if (incoming.deliveryConfirmedAt && !incoming.inspection) {
    return { actor: "you", label: "Inspect the figure you received" };
  }
  if (!hasReached(incoming, "dropped_off")) {
    return { actor: "them", label: "Waiting for the other collector to ship" };
  }
  if (hasReached(mine, "delivered") && !mine.inspection) {
    return { actor: "them", label: "Waiting for the other collector's inspection" };
  }
  return { actor: "none", label: "Both boxes are on the way. Tracking is below." };
}

/* ------------------------------------------------------------------ */
/* State transitions. Each returns a new Trade or throws a clear error. */
/* ------------------------------------------------------------------ */

const pushStage = (s: Shipment, stage: ShipStage, at: string): Shipment => ({
  ...s,
  stage,
  history: [...s.history, { stage, at }],
});

const touch = (trade: Trade, at: string, message: string, actorId?: string): Trade => ({
  ...trade,
  updatedAt: at,
  timeline: [...trade.timeline, actorId ? { at, actorId, message } : { at, message }],
});

export function buildAgreement(trade: Trade, at: string): Agreement {
  return {
    createdAt: at,
    shipWindowDays: SHIP_WINDOW_DAYS,
    inspectionWindowHours: INSPECTION_WINDOW_HOURS,
    terms: [
      "Each collector ships exactly the figures, accessories and condition written in this agreement.",
      `Both packages must be dropped off within ${SHIP_WINDOW_DAYS} days of the final signature.`,
      "Each collector photographs their figure and accessories before sealing the package.",
      "Tracking goes live for both sides once both packages are dropped off.",
      `Each recipient confirms delivery and has ${INSPECTION_WINDOW_HOURS} hours to inspect.`,
      "If something does not match, the recipient reports a problem before approving.",
      "The trade completes only when both collectors approve their inspection.",
    ],
    signatures: {},
  };
}

export function acceptOffer(trade: Trade, userId: string, at: string): Trade {
  if (trade.status !== "pending") throw new Error("Only pending offers can be accepted");
  if (trade.receiverId !== userId) throw new Error("Only the receiving collector can accept");
  return touch(
    { ...trade, status: "accepted", agreement: buildAgreement(trade, at) },
    at,
    "accepted the offer, and the trade agreement is ready",
    userId,
  );
}

export function declineOffer(trade: Trade, userId: string, at: string): Trade {
  if (trade.status !== "pending") throw new Error("Only pending offers can be declined");
  if (trade.receiverId !== userId) throw new Error("Only the receiving collector can decline");
  return touch({ ...trade, status: "declined" }, at, "declined the offer", userId);
}

export function withdrawOffer(trade: Trade, userId: string, at: string): Trade {
  if (trade.status !== "pending") throw new Error("Only pending offers can be withdrawn");
  if (trade.proposerId !== userId) throw new Error("Only the proposing collector can withdraw");
  return touch({ ...trade, status: "withdrawn" }, at, "withdrew the offer", userId);
}

export function signAgreement(trade: Trade, side: Side, at: string): Trade {
  if (trade.status !== "accepted" || !trade.agreement) throw new Error("No agreement to sign");
  if (trade.agreement.signatures[side]) throw new Error("Already signed");
  const signatures = { ...trade.agreement.signatures, [side]: at };
  let next: Trade = { ...trade, agreement: { ...trade.agreement, signatures } };
  if (signatures.proposer && signatures.receiver) {
    next = {
      ...next,
      shipments: {
        proposer: pushStage(next.shipments.proposer, "packing", at),
        receiver: pushStage(next.shipments.receiver, "packing", at),
      },
    };
  }
  next = touch(next, at, "signed the trade agreement", collectorIdFor(trade, side));
  return bothSigned(next) ? touch(next, at, "Both signed. Time to pack.") : next;
}

export function generateLabel(trade: Trade, side: Side, checklist: string[], at: string, code: string): Trade {
  const s = trade.shipments[side];
  if (s.stage !== "packing") throw new Error("Package is not in the packing stage");
  const missing = PACKING_CHECKLIST.filter((c) => !checklist.includes(c));
  if (missing.length) throw new Error("Complete every packing checklist item first");
  return touch(
    {
      ...trade,
      shipments: {
        ...trade.shipments,
        [side]: { ...pushStage(s, "label_created", at), packingChecklist: [...checklist], trackingCode: code },
      },
    },
    at,
    "completed the packing checklist and created a simulated label",
    collectorIdFor(trade, side),
  );
}

export function markDroppedOff(trade: Trade, side: Side, at: string): Trade {
  const s = trade.shipments[side];
  if (s.stage !== "label_created") throw new Error("Create a label before dropping off");
  let next = touch(
    { ...trade, shipments: { ...trade.shipments, [side]: pushStage(s, "dropped_off", at) } },
    at,
    "dropped off a package",
    collectorIdFor(trade, side),
  );
  if (hasReached(next.shipments[otherSide(side)], "dropped_off")) {
    next = touch(next, at, "Both boxes dropped off. Tracking is live for both of you.");
  }
  return next;
}

/** Two-way safety: carrier tracking only moves once BOTH packages are dropped off. */
export function canAdvanceCarrier(trade: Trade, side: Side) {
  const s = trade.shipments[side];
  return (
    hasReached(trade.shipments.proposer, "dropped_off") &&
    hasReached(trade.shipments.receiver, "dropped_off") &&
    stageIndex(s.stage) >= stageIndex("dropped_off") &&
    s.stage !== "delivered"
  );
}

export function advanceCarrier(trade: Trade, side: Side, at: string): Trade {
  if (!canAdvanceCarrier(trade, side)) throw new Error("Tracking unlocks once both packages are dropped off");
  const s = trade.shipments[side];
  const nextStage = SHIP_STAGES[stageIndex(s.stage) + 1]!;
  return touch(
    { ...trade, shipments: { ...trade.shipments, [side]: pushStage(s, nextStage, at) } },
    at,
    `got a carrier scan: their package is ${SHIP_STAGE_LABELS[nextStage].toLowerCase()}`,
    collectorIdFor(trade, side),
  );
}

/** `side` is the SENDER of the package; the other side confirms it. */
export function confirmDelivery(trade: Trade, side: Side, at: string): Trade {
  const s = trade.shipments[side];
  if (s.stage !== "delivered") throw new Error("Package has not been delivered yet");
  if (s.deliveryConfirmedAt) throw new Error("Delivery already confirmed");
  return touch(
    { ...trade, shipments: { ...trade.shipments, [side]: { ...s, deliveryConfirmedAt: at } } },
    at,
    "confirmed a package arrived and started inspection",
    collectorIdFor(trade, otherSide(side)),
  );
}

export function submitInspection(trade: Trade, side: Side, inspection: Inspection): Trade {
  const s = trade.shipments[side];
  if (!s.deliveryConfirmedAt) throw new Error("Confirm delivery before inspecting");
  if (s.inspection) throw new Error("Inspection already submitted");
  if (inspection.result === "approved") {
    const required = itemsSentBy(trade, side).flatMap((i) => i.accessories);
    const missing = required.filter((a) => !inspection.checkedAccessories.includes(a));
    if (missing.length) throw new Error("Check off every accessory before approving, or report a problem");
  }
  return touch(
    { ...trade, shipments: { ...trade.shipments, [side]: { ...s, inspection } } },
    inspection.at,
    inspection.result === "approved"
      ? "approved the inspection of the figure received"
      : "flagged an issue during inspection",
    collectorIdFor(trade, otherSide(side)),
  );
}

/* ------------------------------------------------------------------ */
/* Reputation                                                          */
/* ------------------------------------------------------------------ */

export type ReputationTier = "New" | "Rising" | "Trusted" | "Elite";

export interface Reputation {
  score: number;
  avgRating: number;
  reviewCount: number;
  completedTrades: number;
  disputeRate: number;
  tier: ReputationTier;
}

/**
 * Score out of 100:
 *  60 pts — average review rating (neutral 30 if no reviews yet)
 *  20 pts — trade volume, capped at 40 completed trades
 *  10 pts — on-time shipping rate
 *  10 pts — dispute-free record (each dispute per completed trade costs 5x)
 */
export function computeReputation(
  collector: Collector,
  reviews: Review[],
  extraCompleted = 0,
): Reputation {
  const mine = reviews.filter((r) => r.collectorId === collector.id);
  const reviewCount = mine.length;
  const avgRating = reviewCount ? mine.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;
  const completedTrades = collector.stats.completedTrades + extraCompleted;
  const disputeRate = completedTrades ? collector.stats.disputes / completedTrades : 0;

  const ratingPts = reviewCount ? (avgRating / 5) * 60 : 30;
  const volumePts = (Math.min(completedTrades, 40) / 40) * 20;
  const shipPts = collector.stats.onTimeShipRate * 10;
  const disputePts = completedTrades ? Math.max(0, 1 - disputeRate * 5) * 10 : 5;
  const score = Math.round(ratingPts + volumePts + shipPts + disputePts);

  let tier: ReputationTier = "New";
  if (score >= 90 && completedTrades >= 25) tier = "Elite";
  else if (score >= 75 && completedTrades >= 5) tier = "Trusted";
  else if (completedTrades >= 1) tier = "Rising";

  return { score, avgRating, reviewCount, completedTrades, disputeRate, tier };
}

/** Snapshot a listing into the written agreement, so later edits can't change the terms. */
export const toTradeItem = (l: Listing): TradeItem => ({
  listingId: l.id,
  title: l.title,
  image: l.images[0] ?? "",
  condition: l.condition,
  conditionNotes: l.conditionNotes,
  accessories: [...l.accessories],
});

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Validate a new collector profile. Returns field errors (empty object when valid). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Checks a sign-up email: required, plausible format, not already used by another profile. */
export function validateEmail(email: string, takenEmails: string[]): string | undefined {
  const e = email.trim().toLowerCase();
  if (!e) return "Enter your email address";
  if (e.length > 254 || !EMAIL_RE.test(e)) return "Enter a valid email address, like name@example.com";
  if (takenEmails.map((t) => t.toLowerCase()).includes(e)) return "A profile with that email already exists";
  return undefined;
}

export function validateCollectorProfile(
  input: { displayName: string; username: string },
  takenUsernames: string[],
): Partial<Record<"displayName" | "username", string>> {
  const e: Partial<Record<"displayName" | "username", string>> = {};
  if (input.displayName.trim().length < 2) e.displayName = "Enter a display name (2+ characters)";
  const u = input.username.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) e.username = "3–20 characters: lowercase letters, numbers or underscores";
  else if (takenUsernames.includes(u)) e.username = "That username is already taken";
  return e;
}
